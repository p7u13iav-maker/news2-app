import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchHeadlines } from "@/lib/newsApi";
import { NEWS_TAG } from "@/lib/news";
import { fetchAllHoroscopes, todayKey } from "@/lib/zodiac";

/**
 * Vercel Cron target (see vercel.json). Runs once daily at 6:30 JST and:
 *
 *  1. Forces a fresh fetch of the RSS feeds (NHK + Nikkei + BBC + Guardian).
 *  2. Calls revalidateTag("news") so the next page request re-renders.
 *  3. Warms the horoscope cache by fetching all 12 signs (validates the API).
 *
 * The actual Gemini translation happens lazily on first page load of
 * /summary or /horoscope for the day (the cron just warms the raw data).
 */
export async function GET() {
  const started = Date.now();
  try {
    const count = (await fetchHeadlines()).length;
    revalidateTag(NEWS_TAG, "max");

    // Warm the horoscope raw-data path (validates API reachability).
    let horoscopeOk = false;
    try {
      const raw = await fetchAllHoroscopes("daily");
      horoscopeOk = Object.keys(raw).length === 12;
    } catch {
      // Non-fatal: horoscope will still work on demand.
    }

    return NextResponse.json({
      ok: true,
      count,
      date: todayKey(),
      horoscopeOk,
      ms: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message, ms: Date.now() - started },
      { status: 500 },
    );
  }
}
