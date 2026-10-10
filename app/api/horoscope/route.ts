import { getGemini, isGeminiConfigured } from "@/lib/gemini";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import {
  fetchAllHoroscopes,
  todayKey,
  ZODIAC_SIGNS,
  type Period,
  type ZodiacKey,
} from "@/lib/zodiac";

/**
 * Daily in-memory cache for translated horoscopes.
 * Key: `${date}-${period}` — generated once per day per period.
 * The cron at 6:30 warms the daily cache; subsequent loads hit cache.
 */
const horoscopeCache = new Map<
  string,
  { ts: number; data: Record<ZodiacKey, string> }
>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/horoscope  { period: "daily" | "weekly" | "monthly" }
 *
 * 1. Fetches raw English horoscopes for all 12 signs from freehoroscopeapi.com.
 * 2. Translates them to Japanese via Gemini (single batched call).
 * 3. Caches the result for the rest of the day.
 *
 * Returns JSON: { ok, date, period, horoscopes: { aries: "...", ... } }
 */
export async function POST(req: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY is not set." },
      { status: 500 },
    );
  }

  let period: Period = "daily";
  try {
    const body = await req.json();
    if (body.period) period = body.period;
  } catch {
    // default to daily
  }

  const cacheKey = `horoscope-${todayKey()}-${period}`;
  const cached = horoscopeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DAILY_CACHE_MS) {
    return NextResponse.json({
      ok: true,
      date: todayKey(),
      period,
      horoscopes: cached.data,
    });
  }

  try {
    // Step 1: Fetch raw English horoscopes for all 12 signs.
    const raw = await fetchAllHoroscopes(period);

    // Build the translation prompt.
    const lines = ZODIAC_SIGNS.map((s) => {
      const r = raw[s.key];
      if (!r) throw new Error(`Missing horoscope for ${s.key}`);
      return `${s.key}: ${r.horoscope}`;
    });

    // Step 2: Translate + summarize to Japanese via Gemini (single call).
    // Keep each sign to 2 short sentences (~40-60 chars) so all 12 fit on one
    // screen without scrolling.
    const { text } = await generateText({
      model: getGemini(),
      system: `あなたは星座占い翻訳者です。12星座の今日の占いを日本語に翻訳・要約してください。
出力はJSONのみ。各星座のキーに対応する日本語の文字列を値に持つオブジェクトを出力。
例: {"aries":"今日の短い占い","taurus":"..."}
※ 各星座は**2文以内・60文字以内**の短い要約にしてください。
※ 自然な日本語で、占いの雰囲気を保ってください。
※ 出力はJSONオブジェクトのみ。それ以外のテキストは含めないでください。`,
      prompt: `以下の12星座の今日の占いを、各60文字以内の日本語要約にしてください:

${lines.join("\n")}`,
      temperature: 0.3,
      maxOutputTokens: 1200,
      maxRetries: 1,
      timeout: 60_000,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
          structuredOutputs: true,
        },
      },
    });

    // Robustly extract the JSON object from the response.
    let parsed: Record<string, unknown>;
    try {
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      const start = cleaned.indexOf("{");
      if (start === -1) throw new Error("No JSON object found");
      let depth = 0;
      let end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      let jsonStr: string;
      if (end !== -1) {
        jsonStr = cleaned.slice(start, end + 1);
      } else {
        // Truncated: repair by closing open braces.
        jsonStr = cleaned.slice(start);
        const qCount = (jsonStr.match(/"/g) || []).length;
        if (qCount % 2 === 1) {
          const lc = jsonStr.lastIndexOf('",');
          if (lc > 0) jsonStr = jsonStr.slice(0, lc + 1);
        }
        jsonStr = jsonStr.replace(/,\s*$/, "");
        const oc =
          (jsonStr.match(/\{/g) || []).length -
          (jsonStr.match(/\}/g) || []).length;
        for (let i = 0; i < Math.max(0, oc); i++) jsonStr += "}";
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to parse translation response as JSON.",
          raw: text.slice(0, 500),
        },
        { status: 500 },
      );
    }

    // Build the result: map each zodiac key to its translated string.
    const horoscopes: Record<ZodiacKey, string> = {} as Record<
      ZodiacKey,
      string
    >;
    for (const s of ZODIAC_SIGNS) {
      const val = parsed[s.key];
      horoscopes[s.key] =
        typeof val === "string"
          ? val
          : typeof val === "object" && val !== null && "summary" in val
            ? String((val as Record<string, unknown>).summary)
            : String(val ?? raw[s.key]?.horoscope ?? "");
    }

    // Cache for the rest of the day.
    horoscopeCache.set(cacheKey, { ts: Date.now(), data: horoscopes });

    return NextResponse.json({
      ok: true,
      date: todayKey(),
      period,
      horoscopes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Horoscope generation failed: " + msg },
      { status: 500 },
    );
  }
}
