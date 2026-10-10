import { oitoma, oitomaModel, isOitomaConfigured } from "@/lib/oitoma";
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
  if (!isOitomaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OITOMA_API_KEY is not set." },
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

    // Ask the AI to categorize and summarize.
    const { text } = await generateText({
      model: oitoma(oitomaModel),
      system: `あなたはニュース要約の専門家です。提供されたニュース記事の見出しを、以下の3つのカテゴリに分類して要約してください。

カテゴリ:
1. 国内の出来事: 日本の国内で起きた出来事・事件・災害・社会ニュース
2. 国外の出来事: 日本国外(海外・国際)で起きた出来事
3. 経済ニュース: 日本を含む世界の経済・ビジネス・金融・株式・企業関連のニュース

ルール:
- 各カテゴリについて、箇条書き(1項目1文)で2〜5項目の短いサマリーを作成
- 各項目は15〜35文字程度の簡潔な一文
- 見出しの意味を正確に反映し、捏造しない
- 該当する記事がなければそのカテゴリは空配列にする
- 出力は必ず以下のJSON形式のみ(余計なテキスト・markdown不要):
{"domestic":["...","..."],"international":["..."],"economy":["..."]}`,
      prompt: `以下のニュース記事の見出しを要約してください:

${newsText}`,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    // Parse the AI's JSON response.
    let parsed: { domestic: string[]; international: string[]; economy: string[] };
    try {
      // The model may wrap JSON in markdown code fences; strip them.
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: if JSON parse fails, return the raw text as a single bullet.
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to parse AI response as JSON.",
          raw: text,
        },
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
