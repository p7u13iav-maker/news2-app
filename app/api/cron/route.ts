import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchHeadlines } from "@/lib/newsApi";
import { NEWS_TAG } from "@/lib/news";
import { todayKey } from "@/lib/zodiac";

/**
 * Vercel Cron target (see vercel.json). Runs once daily at 6:30 JST and:
 *
 *  1. Forces a fresh fetch of the RSS feeds (NHK + Nikkei + BBC + Guardian).
 *  2. Calls revalidateTag("news") so the next page request re-renders.
 *  3. Warms the horoscope raw-data path (fetches all 12 signs).
 *  4. Warms the market data path (fetches all 6 Yahoo Finance series).
 *
 * The Gemini translations (summary/horoscope) happen lazily on first page
 * load of the day. Market data is cached in-memory for 24h per instance,
 * so the first page load after 6:30 triggers a fresh Yahoo fetch.
 */
export async function GET() {
  const started = Date.now();
  try {
    const count = (await fetchHeadlines()).length;
    revalidateTag(NEWS_TAG, "max");

    // Warm the horoscope cache by calling the internal horoscope API
    // (Sigastra, Japanese, no AI). This populates the 24h daily cache.
    let horoscopeOk = false;
    try {
      const res = await fetch("http://localhost/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "daily" }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const j = await res.json();
        horoscopeOk = j.ok === true;
      }
    } catch {
      // Non-fatal: horoscope will still work on demand.
    }

    // Warm the market data path (fetches all 6 series from Yahoo Finance).
    let marketOk = false;
    try {
      const res = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      marketOk = res.ok;
    } catch {
      // Non-fatal: market data will still work on demand.
    }

    return NextResponse.json({
      ok: true,
      count,
      date: todayKey(),
      horoscopeOk,
      marketOk,
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
