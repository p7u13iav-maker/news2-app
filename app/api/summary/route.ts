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
      system: `ニュース見出しを3カテゴリに分類し、JSONで要約してください。

カテゴリ:
- domestic: 国内の出来事(事件・災害・社会)
- international: 国外・国際
- economy: 経済・ビジネス・金融

出力はJSONのみ。各カテゴリ2〜4項目、1項目20〜40文字。
{
  "domestic": ["項目"],
  "international": ["項目"],
  "economy": ["項目"]
}`,
      prompt: `以下のニュース記事の見出しを要約してください:

${newsText}`,
      temperature: 0.2,
      // Keep output short but allow enough room for 3 categories x 3-4 items.
      maxOutputTokens: 600,
    });

    // Extract the JSON object from the AI's response. The model may wrap it
    // in markdown code fences or prepend text, so we find the first balanced
    // { ... } block. If the JSON is truncated (no closing brace), we attempt
    // to repair it by closing any open brackets/braces.
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
      let jsonStr: string;
      if (end !== -1) {
        jsonStr = cleaned.slice(start, end + 1);
      } else {
        // Truncated: close any open brackets and braces.
        jsonStr = cleaned.slice(start);
        // Remove any trailing incomplete string (unterminated ").
        const quoteCount = (jsonStr.match(/"/g) || []).length;
        if (quoteCount % 2 === 1) {
          // Find the last complete string and cut after it.
          const lastComplete = jsonStr.lastIndexOf('",');
          if (lastComplete > 0) jsonStr = jsonStr.slice(0, lastComplete + 1);
          else {
            const lastBrace = jsonStr.lastIndexOf('"');
            if (lastBrace > 0) jsonStr = jsonStr.slice(0, lastBrace);
          }
        }
        // Count open [ and { and close them.
        const openBrackets = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
        const openBraces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
        // Remove trailing comma if present.
        jsonStr = jsonStr.replace(/,\s*$/, "");
        for (let i = 0; i < Math.max(0, openBrackets); i++) jsonStr += "]";
        for (let i = 0; i < Math.max(0, openBraces); i++) jsonStr += "}";
      }
      parsed = JSON.parse(jsonStr);
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
