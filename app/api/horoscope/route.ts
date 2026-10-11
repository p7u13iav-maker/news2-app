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
      horoscopes[s.key] = item?.text ?? "";
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
