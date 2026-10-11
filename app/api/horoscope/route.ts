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
 * Sigastra returns full-length comments (300-700 chars). To display without
 * scrolling on a signage screen, we truncate to the first N characters,
 * cutting at a natural sentence boundary (。or 、) so the text reads cleanly.
 */
const MAX_CHARS = 120;

function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  // Try to cut at the last sentence boundary within the limit.
  const window = text.slice(0, max);
  const lastPeriod = window.lastIndexOf("。");
  const lastComma = window.lastIndexOf("、");
  const cut = Math.max(lastPeriod, lastComma);
  if (cut > max * 0.5) {
    // Cut at the boundary, keeping the trailing punctuation.
    return window.slice(0, cut + 1);
  }
  // No good boundary found — hard cut at max chars.
  return window;
}

/**
 * POST /api/horoscope  { period: "daily" | "weekly" | "monthly" }
 *
 * 1. Fetches Japanese horoscopes for all 12 signs from Sigastra.
 * 2. Caches the result for the rest of the day.
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
    const res = await fetch(sigastraUrl(period), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Sigastra API ${res.status}`);
    }
    const json = await res.json();

    // Map each zodiac key to its Japanese text.
    const horoscopes: Record<ZodiacKey, string> = {} as Record<
      ZodiacKey,
      string
    >;
    for (const s of ZODIAC_SIGNS) {
      const item = json.items?.find(
        (it: { sign?: string }) =>
          it.sign?.toLowerCase() === s.key ||
          it.sign?.toLowerCase() === s.key.charAt(0).toUpperCase() + s.key.slice(1),
      );
      const raw = item?.text ?? "";
      horoscopes[s.key] = truncateAtBoundary(raw, MAX_CHARS);
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
