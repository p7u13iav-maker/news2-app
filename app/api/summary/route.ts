import { getGemini, geminiModel, isGeminiConfigured } from "@/lib/gemini";
import { generateText } from "ai";
import { fetchHeadlines } from "@/lib/newsApi";
import { NextResponse } from "next/server";

/**
 * POST /api/summary
 *
 * Fetches the latest NHK + Nikkei headlines, then uses OITOMA AI to
 * summarize them into three categories:
 *   - 国内の出来事 (yesterday's domestic events)
 *   - 国外の出来事 (yesterday's international events)
 *   - 経済ニュース (world economy including Japan)
 *
 * Returns JSON: { ok, date, summary: { domestic, international, economy } }
 * Each category is an array of short bullet-point strings.
 */
export async function POST() {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    // Fetch the latest headlines (NHK + Nikkei, top ~14).
    const articles = await fetchHeadlines();
    if (articles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No news articles found." },
        { status: 500 },
      );
    }

    // Build a compact text input for the AI.
    const newsText = articles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
      .join("\n");

    // Ask the AI to categorize and summarize. We strongly instruct JSON-only
    // output and then robustly extract the JSON object from the response
    // (which may be wrapped in markdown code fences).
    const { text } = await generateText({
      model: getGemini(),
      system: `あなたはニュース要約の専門家です。以下の指示を厳密に従ってください。

【出力形式】
絶対に JSON オブジェクトのみを出力してください。
- 最初に { を、最後に } を書いてください。
- markdown のコードフェンス(三重バッククォート)は使用しないでください。
- 説明・前置き・後書きは一切書かないでください。

【JSON の構造】
{
  "domestic": ["項目1", "項目2"],
  "international": ["項目1", "項目2"],
  "economy": ["項目1", "項目2"]
}

【カテゴリ】
- domestic: 日本の国内で起きた出来事・事件・災害・社会ニュース
- international: 日本国外(海外・国際)で起きた出来事
- economy: 日本を含む世界の経済・ビジネス・金融・株式・企業関連

【ルール】
- 各カテゴリは2〜5項目の文字列配列。各項目は15〜35文字の簡潔な一文
- 見出しの意味を正確に反映し、捏造しない
- 該当なければ空配列 []`,
      prompt: `以下のニュース記事の見出しを要約してください:

${newsText}`,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    // Extract the JSON object from the AI's response. The model may wrap it
    // in markdown code fences or prepend text, so we find the first balanced
    // { ... } block.
    let parsed: { domestic: string[]; international: string[]; economy: string[] };
    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      if (start === -1) throw new Error("No JSON object found");
      let depth = 0;
      let end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end === -1) throw new Error("Unbalanced JSON braces");
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to parse AI response as JSON.", raw: text },
        { status: 500 },
      );
    }

    // Today's date in JST (Asia/Tokyo).
    const dateStr = new Date().toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    return NextResponse.json({
      ok: true,
      date: dateStr,
      summary: {
        domestic: parsed.domestic || [],
        international: parsed.international || [],
        economy: parsed.economy || [],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Summary generation failed: " + msg },
      { status: 500 },
    );
  }
}
