import { fetchHeadlines } from "@/lib/newsApi";
import { translateHeadline } from "@/lib/translateHeadline";
import { NextResponse } from "next/server";

/**
 * POST /api/summary
 *
 * No AI. Categorizes headlines by source:
 *   - domestic: NHK + Nikkei (Japanese sources)
 *   - international: BBC + Guardian (English sources, translated to Japanese)
 *   - economy: Nikkei Business (economy-focused source)
 *
 * Each category shows max 5 items, truncated to 40 chars at sentence boundary.
 *
 * Returns JSON: { ok, date, summary: { domestic, international, economy } }
 */

// In-memory cache for daily summaries.
const summaryCache = new Map<string, { ts: number; data: object }>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

/** Truncate to max chars at sentence boundary (。or 、). */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const window = s.slice(0, max);
  const lastPeriod = window.lastIndexOf("。");
  const lastComma = window.lastIndexOf("、");
  const cut = Math.max(lastPeriod, lastComma);
  if (cut > max * 0.5) return window.slice(0, cut + 1);
  return window;
}

const MAX_ITEMS = 5;
const MAX_CHARS = 40;

export async function POST() {
  // Daily cache: key by JST date.
  const cacheKey = "summary-" +
    new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DAILY_CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const articles = await fetchHeadlines();
    if (articles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No news articles found." },
        { status: 500 },
      );
    }

    // Categorize by source.
    const domestic: string[] = [];
    const international: string[] = [];
    const economy: string[] = [];

    for (const a of articles) {
      const isEnglish = a.source === "BBC" || a.source === "Guardian";
      const title = isEnglish
        ? translateHeadline(a.title)
        : a.title;
      const item = truncate(title, MAX_CHARS);

      if (a.source === "NHK") {
        if (domestic.length < MAX_ITEMS) domestic.push(item);
      } else if (isEnglish) {
        if (international.length < MAX_ITEMS) international.push(item);
      } else if (a.source === "日経ビジネス") {
        // Nikkei Business → economy
        if (economy.length < MAX_ITEMS) economy.push(item);
      } else if (a.source === "日経新聞") {
        // Nikkei main → domestic (could also be economy, but keep simple)
        if (domestic.length < MAX_ITEMS) domestic.push(item);
      }
    }

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
        domestic,
        international,
        economy,
      },
    };

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
