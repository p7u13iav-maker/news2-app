import { NextResponse } from "next/server";

/**
 * GET /api/market
 *
 * Fetches 3-month daily close data for a set of market indices / bond yields
 * from the Yahoo Finance chart API (no API key required) and returns it as
 * JSON. The summary page renders these as sparklines.
 *
 * Note: Yahoo's chart API does not send CORS headers, so we fetch server-side
 * (Vercel) and hand the data to the client.
 */

interface MarketItem {
  key: string;
  label: string;
  unit: "%" | "";
  symbol: string;
}

const MARKET: MarketItem[] = [
  { key: "us10y", label: "米国債 10年金利", unit: "%", symbol: "^TNX" },
  { key: "us2y", label: "米国債 2年金利", unit: "%", symbol: "^FVX" },
  { key: "sp500", label: "S&P 500", unit: "", symbol: "^GSPC" },
  { key: "nasdaq", label: "NASDAQ", unit: "", symbol: "^IXIC" },
  { key: "nikkei", label: "日経平均", unit: "", symbol: "^N225" },
  { key: "topix", label: "TOPIX", unit: "", symbol: "9010.T" },
];

const FETCH_TIMEOUT_MS = 12_000;

/** One data point: Unix epoch seconds + closing price. */
interface Point {
  t: number;
  v: number;
}

async function fetchSeries(symbol: string): Promise<Point[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=3mo&interval=1d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const r = json.chart?.result?.[0];
    const ts = r?.timestamp;
    const closes = r?.indicators?.quote?.[0]?.close;
    if (!ts || !closes) return null;
    const points: Point[] = [];
    for (let i = 0; i < ts.length; i++) {
      const v = closes[i];
      if (typeof v === "number" && !Number.isNaN(v)) {
        points.push({ t: ts[i], v });
      }
    }
    return points.length > 1 ? points : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(
    MARKET.map(async (item) => {
      const points = await fetchSeries(item.symbol);
      return {
        key: item.key,
        label: item.label,
        unit: item.unit,
        symbol: item.symbol,
        ok: Boolean(points),
        points: points ?? [],
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    fetchedAt: Date.now(),
    markets: results,
  });
}
