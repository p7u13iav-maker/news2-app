import { getGemini, geminiModel, isGeminiConfigured } from "@/lib/gemini";
import { generateText } from "ai";
import { fetchHeadlines } from "@/lib/newsApi";
import { NextResponse } from "next/server";

// In-memory cache for daily summaries (avoids re-calling Gemini on every load).
const summaryCache = new Map<string, { ts: number; data: object }>();

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

  // Simple in-memory cache: key by date so we don't re-summarize the same
  // day's news on every page load. Cache for 30 minutes.
  const cacheKey = "summary-" +
    new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
    return NextResponse.json(cached.data);
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

    // Ask the AI to categorize and summarize. We use structuredOutputs: true
    // (Gemini's native structured output) + thinkingBudget: 0 (no thinking)
    // to get fast, reliable JSON output. We then robustly extract the JSON
    // from the response text.
    const { text } = await generateText({
      model: getGemini(),
      system: `ニュース見出しを3カテゴリに分類し、JSONで出力してください。
各カテゴリ2〜4項目、1項目20〜40文字の短い要約。
カテゴリ: domestic(国内), international(国外), economy(経済)
出力はJSONのみ。`,
      prompt: `以下の見出しを要約してください:

${newsText}`,
      temperature: 0.2,
      maxOutputTokens: 600,
      maxRetries: 1,
      timeout: 50_000,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
          structuredOutputs: true,
        },
      },
    });

    // Extract the JSON object from the response (may be wrapped in code fences).
    let parsed: { domestic: string[]; international: string[]; economy: string[] };
    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      if (start === -1) throw new Error("No JSON object found");
      let depth = 0, end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      let jsonStr: string;
      if (end !== -1) {
        jsonStr = cleaned.slice(start, end + 1);
      } else {
        // Truncated: repair by closing open brackets/braces.
        jsonStr = cleaned.slice(start);
        const qCount = (jsonStr.match(/"/g) || []).length;
        if (qCount % 2 === 1) {
          const lc = jsonStr.lastIndexOf('",');
          if (lc > 0) jsonStr = jsonStr.slice(0, lc + 1);
        }
        jsonStr = jsonStr.replace(/,\s*$/, "");
        const ob = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
        const oc = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
        for (let i = 0; i < Math.max(0, ob); i++) jsonStr += "]";
        for (let i = 0; i < Math.max(0, oc); i++) jsonStr += "}";
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

    const result = {
      ok: true,
      date: dateStr,
      summary: {
        domestic: parsed.domestic || [],
        international: parsed.international || [],
        economy: parsed.economy || [],
      },
    };
    // Cache the result for 30 minutes.
    summaryCache.set(cacheKey, { ts: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Summary generation failed: " + msg },
      { status: 500 },
    );
  }
}
