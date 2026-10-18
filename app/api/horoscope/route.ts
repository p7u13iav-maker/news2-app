import { NextResponse } from "next/server";
import {
  todayKey,
  ZODIAC_SIGNS,
  type Period,
  type ZodiacKey,
} from "@/lib/zodiac";

/**
 * Daily in-memory cache for horoscopes.
 * Key: `${date}-${period}` — fetched once per day per period.
 * Data source: Sigastra (https://sigastra.com) — free, no key, 15 languages
 * including Japanese. No AI/translation needed.
 */
const horoscopeCache = new Map<
  string,
  { ts: number; data: Record<ZodiacKey, string> }
>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

/** Sigastra API endpoint for a given period (daily/weekly/monthly). */
function sigastraUrl(period: Period): string {
  return `https://sigastra.com/api/v1/${period}?lang=ja`;
}

/**
 * Sigastra returns full-length comments (100-700 chars). To display without
 * scrolling on a signage screen, we keep only the first 4 sentences
 * (up to the 4th "。"), counted from the original un-truncated text.
 * If there are fewer than 4 sentences, we keep all.
 */
function keepFourSentences(text: string): string {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "。") {
      count++;
      if (count === 4) {
        return text.slice(0, i + 1);
      }
    }
  }
  // Fewer than 4 sentences — return as-is.
  return text;
}

/**
 * POST /api/horoscope  { period: "daily" | "weekly" | "monthly" }
 *
 * 1. Fetches Japanese horoscopes for all 12 signs from Sigastra.
 * 2. Truncates each comment to MAX_CHARS at a sentence boundary.
 * 3. Caches the result for the rest of the day.
 *
 * Returns JSON: { ok, date, period, horoscopes: { aries: "...", ... } }
 */
export async function POST(req: Request) {
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
    // Sigastra requires a Referer header for server-side calls (since
    // 2026-10-15). Sending our own production domain as the Referer is
    // accepted and returns 200. Without it, the API returns 401
    // "key_required".
    const res = await fetch(sigastraUrl(period), {
      headers: {
        Referer: "https://news2-app-p7u13iav.vercel.app/",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Sigastra API ${res.status}`);
    }
    const json = await res.json();

    // Map each zodiac key to its truncated Japanese text.
    const horoscopes: Record<ZodiacKey, string> = {} as Record<
      ZodiacKey,
      string
    >;
    for (const s of ZODIAC_SIGNS) {
      const item = json.items?.find(
        (it: { sign?: string }) =>
          it.sign?.toLowerCase() === s.key ||
          it.sign?.toLowerCase() ===
            s.key.charAt(0).toUpperCase() + s.key.slice(1),
      );
      const raw = item?.text ?? "";
      horoscopes[s.key] = keepFourSentences(raw);
    }

    // Verify we got at least some data.
    const filled = Object.values(horoscopes).filter(
      (v) => v && v.length > 0,
    ).length;
    if (filled === 0) {
      throw new Error("No horoscope data returned from Sigastra");
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
      { ok: false, error: "Failed to fetch horoscopes: " + msg },
      { status: 500 },
    );
  }
}
