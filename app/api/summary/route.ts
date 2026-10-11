import { NextResponse } from "next/server";
import { translateHeadline } from "@/lib/translateHeadline";

/**
 * POST /api/summary  (AI-free)
 *
 * Summarizes the past 24h of news movement across 3 categories:
 *   - domestic:      NHK cat0 (主要) + cat1 (社会) + Nikkei business
 *   - international: BBC World + Guardian World
 *   - economy:       NHK cat5 (経済) + Nikkei business + BBC Business
 *                    + auto-generated market data line (from /api/market)
 *
 * No AI. Uses RSS feeds directly + keyword-based EN→JA translation.
 *
 * Returns: { ok, date, summary: { domestic[], international[], economy[] } }
 */

const summaryCache = new Map<string, { ts: number; data: object }>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 10_000;
const HOURS_BACK = 24;
const MAX_ITEMS = 5;
const MAX_CHARS = 35;

/** RSS feeds. label is used for categorization. */
const FEEDS = [
  // Domestic (Japanese)
  { label: "NHK", cat: "domestic", url: "https://news.web.nhk/n-data/conf/na/rss/cat0.xml" },
  { label: "NHK", cat: "domestic", url: "https://news.web.nhk/n-data/conf/na/rss/cat1.xml" },
  { label: "日経新聞", cat: "domestic", url: "https://assets.wor.jp/rss/rdf/nikkei/business.rdf" },
  // International (English → translated)
  { label: "BBC", cat: "international", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { label: "Guardian", cat: "international", url: "https://www.theguardian.com/world/rss" },
  // Economy
  { label: "NHK", cat: "economy", url: "https://news.web.nhk/n-data/conf/na/rss/cat5.xml" },
  { label: "日経新聞", cat: "economy", url: "https://assets.wor.jp/rss/rdf/nikkei/business.rdf" },
  { label: "BBC", cat: "economy", url: "http://feeds.bbci.co.uk/news/business/rss.xml" },
];

/** Decode HTML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function unwrapCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

function tagValue(xml: string, tag: string): string | null {
  const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

interface Item {
  title: string;
  publishedAt: number;
}

/** Parse RSS XML into items. */
function parseFeed(xml: string): Item[] {
  const items: Item[] = [];
  const blocks = xml.split(/<item(?:\s[^>]*)?[\s>]/).slice(1);
  for (const block of blocks) {
    const closeIdx = block.indexOf("</item>");
    const itemXml = "<item>" + (closeIdx >= 0 ? block.slice(0, closeIdx) : block);
    const rawTitle = tagValue(itemXml, "title");
    if (!rawTitle) continue;
    const title = decodeEntities(unwrapCdata(rawTitle)).trim();
    if (!title) continue;
    const rawDate = tagValue(itemXml, "pubDate") ?? tagValue(itemXml, "dc:date") ?? "";
    const publishedAt = rawDate
      ? new Date(rawDate).getTime()
      : Date.now();
    if (!Number.isNaN(publishedAt)) items.push({ title, publishedAt });
  }
  return items;
}

/** Fetch and parse a single RSS feed. */
async function fetchFeed(url: string): Promise<Item[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MorningNewsBot/1.0; +https://news2-app-p7u13iav.vercel.app)",
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Truncate to max chars at sentence boundary. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const window = s.slice(0, max);
  const lastPeriod = window.lastIndexOf("。");
  const lastComma = window.lastIndexOf("、");
  const cut = Math.max(lastPeriod, lastComma);
  if (cut > max * 0.5) return window.slice(0, cut + 1);
  return window;
}

/** Fetch market data line from /api/market. */
async function fetchMarketLine(): Promise<string> {
  try {
    const res = await fetch("/api/market", { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return "";
    const j = await res.json();
    if (!j.ok || !j.markets) return "";
    const byKey: Record<string, { last?: number; diff?: number }> = {};
    for (const m of j.markets) {
      const pts = m.points ?? [];
      const first = pts[0]?.v;
      const last = pts[pts.length - 1]?.v;
      if (first != null && last != null) {
        byKey[m.key] = { last, diff: last - first };
      }
    }
    const nk = byKey["nikkei"];
    if (nk?.last != null && nk.diff != null) {
      const sign = nk.diff >= 0 ? "+" : "";
      return `日経平均 ${Math.round(nk.last).toLocaleString("ja-JP")}円 (${sign}${Math.round(nk.diff).toLocaleString("ja-JP")}円)`;
    }
  } catch {
    return "";
  }
  return "";
}

export async function POST() {
  // Daily cache.
  const cacheKey =
    "summary-" + new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DAILY_CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch all feeds in parallel.
    const results = await Promise.all(
      FEEDS.map(async (f) => ({
        cat: f.cat,
        isEnglish: f.label === "BBC" || f.label === "Guardian",
        items: await fetchFeed(f.url),
      })),
    );

    // Filter to past 24h, dedupe, categorize.
    const cutoff = Date.now() - HOURS_BACK * 60 * 60 * 1000;
    const seen = new Set<string>();

    const domestic: string[] = [];
    const international: string[] = [];
    const economy: string[] = [];

    for (const { cat, isEnglish, items } of results) {
      const sorted = [...items].sort((a, b) => b.publishedAt - a.publishedAt);
      for (const item of sorted) {
        if (item.publishedAt < cutoff) continue;
        if (seen.has(item.title)) continue;
        seen.add(item.title);

        let title = item.title;
        if (isEnglish) title = translateHeadline(title);
        title = truncate(title, MAX_CHARS);

        if (cat === "domestic" && domestic.length < MAX_ITEMS) {
          domestic.push(title);
        } else if (cat === "international" && international.length < MAX_ITEMS) {
          international.push(title);
        } else if (cat === "economy" && economy.length < MAX_ITEMS) {
          economy.push(title);
        }
      }
    }

    // Prepend market data line to economy if available.
    const marketLine = await fetchMarketLine();
    if (marketLine) {
      economy.unshift(marketLine);
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
      summary: { domestic, international, economy },
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
