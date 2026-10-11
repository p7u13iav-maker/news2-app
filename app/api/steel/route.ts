import { NextResponse } from "next/server";
import { fetchJisfProduction } from "@/lib/jisfProduction";
import { fetchWorldSteelProduction } from "@/lib/worldSteel";
import {
  fetchSupplyDemand,
  type SupplyDemandSummary,
  type SupplyDemandMonth,
} from "@/lib/supplyDemand";
import {
  fetchOrderStatistics,
  type OrderMonth,
} from "@/lib/orderStatistics";
import { fetchJisfComment, type JisfComment } from "@/lib/jisfComment";

/**
 * GET /api/steel
 *
 * Fetches steel industry indicators:
 *   1. Japan crude steel & pig iron production (JISF monthly Excel)
 *   2. World crude steel production (worldsteel via statorigin.org, CC BY 4.0)
 *   3. Related stock prices (Nippon Steel, JFE, Daido Steel, Nikkei 225)
 *   4. WTI crude oil price
 *
 * Returns JSON with production data, stock prices, and a rule-based comment.
 */

const FETCH_TIMEOUT_MS = 15_000;

interface StockPoint {
  t: number;
  v: number;
}

interface StockData {
  key: string;
  label: string;
  unit: string;
  ok: boolean;
  last: number;
  diff: number;
  points: StockPoint[];
}

const STOCKS: { key: string; label: string; symbol: string; unit: string }[] = [
  { key: "nipponSteel", label: "日本製鉄", symbol: "5401.T", unit: "円" },
  { key: "jfe", label: "JFE", symbol: "5411.T", unit: "円" },
  { key: "daido", label: "大和鋼", symbol: "5471.T", unit: "円" },
  { key: "nikkei", label: "日経平均", symbol: "^N225", unit: "円" },
  { key: "wti", label: "WTI原油", symbol: "CL=F", unit: "$" },
];

async function fetchStock(symbol: string): Promise<StockPoint[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=1mo&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    const points: StockPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const v = closes[i];
      if (typeof v === "number" && !Number.isNaN(v)) {
        points.push({ t: ts[i], v });
      }
    }
    return points.length > 1 ? points : null;
  } catch {
    return null;
  }
}

// In-memory daily cache.
const steelCache = new Map<
  string,
  { ts: number; data: object }
>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Build a rule-based comment from the data. */
function buildComment(
  production: { year: number; month: number; pigIron: number; crudeSteel: number; yoy: number }[],
  worldSteel: { year: number; month: number; worldCrudeSteel: number; yoy: number }[],
  stocks: StockData[],
): string[] {
  const lines: string[] = [];

  // Japan production comment.
  if (production.length >= 2) {
    const latest = production[production.length - 1];
    const prev = production[production.length - 2];
    const mom =
      prev.crudeSteel > 0
        ? ((latest.crudeSteel - prev.crudeSteel) / prev.crudeSteel) * 100
        : 0;
    lines.push(
      `日本粗鋼生産は${latest.year}年${latest.month}月に${latest.crudeSteel.toFixed(1)}万トン(前月比${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%、前年同月比${latest.yoy >= 0 ? "+" : ""}${latest.yoy.toFixed(1)}%)。`,
    );
  }

  // World production comment.
  if (worldSteel.length >= 1) {
    const latest = worldSteel[worldSteel.length - 1];
    lines.push(
      `世界粗鋼生産は${latest.year}年${latest.month}月に${latest.worldCrudeSteel.toFixed(1)}百万トン(前年同月比${latest.yoy >= 0 ? "+" : ""}${latest.yoy.toFixed(1)}%)。`,
    );
  }

  // Stock comment.
  const ns = stocks.find((s) => s.key === "nipponSteel");
  const jfe = stocks.find((s) => s.key === "jfe");
  if (ns?.ok && jfe?.ok) {
    const nsDir = ns.diff >= 0 ? "上昇" : "下落";
    const jfeDir = jfe.diff >= 0 ? "上昇" : "下落";
    lines.push(
      `関連銘柄は日本製鉄が${nsDir}(${ns.last.toLocaleString("ja-JP")}円)、JFEが${jfeDir}(${jfe.last.toLocaleString("ja-JP")}円)。`,
    );
  }

  // Oil comment.
  const wti = stocks.find((s) => s.key === "wti");
  if (wti?.ok) {
    const wtiDir = wti.diff >= 0 ? "上昇" : "下落";
    lines.push(`WTI原油は${wtiDir}(${wti.last.toFixed(1)}ドル)。`);
  }

  return lines.length > 0 ? lines : ["データを取得中です。"];
}

export async function GET() {
  const cacheKey = "steel-" + todayKey();
  const cached = steelCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DAILY_CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch all data sources in parallel.
    const [production, worldSteel, supplyDemand, orders, jisfComment, stockResults] =
      await Promise.all([
        fetchJisfProduction(12).catch(() => []),
        fetchWorldSteelProduction(12).catch(() => []),
        fetchSupplyDemand(12).catch(
          () => ({ summary: null, trend: [] }),
        ),
        fetchOrderStatistics(12).catch(() => []),
        fetchJisfComment().catch(() => null),
        Promise.all(
          STOCKS.map(async (s) => {
            const points = await fetchStock(s.symbol);
            const last = points?.[points.length - 1]?.v ?? 0;
            const first = points?.[0]?.v ?? 0;
            return {
              key: s.key,
              label: s.label,
              unit: s.unit,
              ok: Boolean(points && points.length > 1),
              last,
              diff: last - first,
              points: points ?? [],
            } as StockData;
          }),
        ),
      ]);

    const comment = buildComment(production, worldSteel, stockResults);

    const data = {
      ok: true,
      fetchedAt: Date.now(),
      production,
      worldSteel,
      supplyDemand,
      orders,
      jisfComment,
      stocks: stockResults,
      comment,
    };

    steelCache.set(cacheKey, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch steel data: " + msg },
      { status: 500 },
    );
  }
}
