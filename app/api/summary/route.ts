import { getGemini, geminiModel, isGeminiConfigured } from "@/lib/gemini";
import { generateText, Output } from "ai";
import { z } from "zod";
import { fetchHeadlines } from "@/lib/newsApi";
import { NextResponse } from "next/server";

const summarySchema = z.object({
  domestic: z.array(z.string()),
  international: z.array(z.string()),
  economy: z.array(z.string()),
});

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

    // Ask the AI to categorize and summarize. We use Output.object with a Zod
    // schema to force structured JSON output, which is the most reliable way
    // to get valid JSON from any model (including thinking models that ignore
    // plain-text "output JSON only" instructions).
    // Ask the AI to categorize and summarize. We use Output.object with a Zod
    // schema to force structured JSON output. We also disable thinking
    // (thinkingBudget: 0) since structured output requires the model to
    // produce direct JSON rather than reasoning first.
    const { text } = await generateText({
      model: getGemini(),
      output: Output.object({ schema: summarySchema }),
      system: `ニュース見出しを3カテゴリに分類し、各カテゴリ2〜4項目の短い要約(20〜40文字)を作成してください。
カテゴリ: domestic(国内), international(国外), economy(経済)`,
      prompt: `以下の見出しを要約してください:

${newsText}`,
      temperature: 0.2,
      maxOutputTokens: 600,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      },
    });

    // Parse the JSON (Output.object guarantees valid JSON in `text`).
    let parsed: { domestic: string[]; international: string[]; economy: string[] };
    try {
      parsed = JSON.parse(text);
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
