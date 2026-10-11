"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { buildMarketComment } from "@/lib/marketComment";

interface Point {
  t: number;
  v: number;
}

interface MarketData {
  key: string;
  label: string;
  unit: "%" | "円" | "";
  symbol: string;
  ok: boolean;
  points: Point[];
}

interface MarketResponse {
  ok: boolean;
  fetchedAt: number;
  markets: MarketData[];
}

/** Build an SVG path string from points, scaled to the given viewBox. */
function buildPath(
  points: Point[],
  w: number,
  h: number,
  pad: number,
): string {
  if (points.length < 2) return "";
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const x0 = pad;
  const x1 = w - pad;
  const y0 = pad;
  const y1 = h - pad;
  const n = points.length;
  return points
    .map((p, i) => {
      const x = n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1);
      const y = y1 - ((y1 - y0) * (p.v - min)) / range;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({
  points,
  up,
  height = 30,
}: {
  points: Point[];
  up: boolean;
  height?: number;
}) {
  const W = 100;
  const H = height;
  const PAD = 2;
  const d = buildPath(points, W, H, PAD);
  if (!d) return null;
  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)";
  const lastVals = points.map((p) => p.v);
  const min = Math.min(...lastVals);
  const max = Math.max(...lastVals);
  const range = max - min || 1;
  const lastV = lastVals[lastVals.length - 1];
  const lastY = H - PAD - ((H - 2 * PAD) * (lastV - min)) / range;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <path d={`${d} L${W - PAD},${H} L${PAD},${H} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={W - PAD} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

// Indexes / stocks that should be shown as whole numbers (no decimals).
const INTEGER_KEYS = new Set(["sp500", "nasdaq", "nikkei", "jfe"]);

function fmt(v: number, integer = false): string {
  if (!Number.isFinite(v)) return "-";
  if (integer) {
    return v.toLocaleString("ja-JP", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
  }
  return v.toLocaleString("ja-JP", {
    maximumFractionDigits: v < 10 ? 3 : 1,
    minimumFractionDigits: v < 10 ? 2 : 0,
  });
}

function fmtDate(t: number): string {
  const d = new Date(t * 1000);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export default function MarketSparklines({
  size = "compact",
}: {
  size?: "compact" | "large";
}) {
  const large = size === "large";
  const [data, setData] = useState<MarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const json = (await res.json()) as MarketResponse;
      if (json.ok) {
        setData(json);
      } else {
        setError("市場データを取得できませんでした。");
      }
    } catch {
      setError("市場データを取得できませんでした。");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markets = data?.markets ?? [];

  // Rule-based commentary derived from the fetched series (no AI).
  const comment = useMemo(
    () => (data && markets.length > 0 ? buildMarketComment(markets) : ""),
    [data, markets],
  );

  // Group the 6 series into 3 columns (yields / US stocks / JP stocks),
  // each column holding two cards stacked vertically.
  const groups: { title: string; icon: string; keys: string[] }[] = [
    { title: "金利", icon: "🇺🇸", keys: ["us10y", "us2y"] },
    { title: "米国株", icon: "🇺🇸", keys: ["sp500", "nasdaq"] },
    { title: "日本株", icon: "🇯🇵", keys: ["nikkei", "jfe"] },
  ];
  const byKey: Record<string, MarketData> = {};
  for (const m of markets) byKey[m.key] = m;

  const renderCard = (m: MarketData) => {
    const pts = m.points;
    const first = pts[0]?.v;
    const last = pts[pts.length - 1]?.v;
    const diff = first && last ? last - first : 0;
    const up = diff >= 0;
    const sign = up ? "+" : "";
    return (
      <div
        key={m.key}
        className={`flex flex-col justify-center rounded-xl border border-white/5 bg-slate-900/40 ${
          large ? "gap-2 p-4" : "gap-1 p-3"
        }`}
      >
        <div className="flex items-baseline justify-between">
          <span
            className={`font-medium text-white/60 ${
              large ? "text-lg" : "text-xs"
            }`}
          >
            {m.label}
          </span>
          <span
            className={`font-mono tabular-nums ${
              large ? "text-base" : "text-xs"
            } ${up ? "text-emerald-400" : "text-red-400"}`}
          >
            {sign}
            {fmt(diff, INTEGER_KEYS.has(m.key))}
            {m.unit}
          </span>
        </div>
        <div
          className={`flex items-center justify-between ${
            large ? "gap-4" : "gap-2"
          }`}
        >
          <div
            className={`shrink-0 ${large ? "h-14 w-1/2" : "h-8 w-20"}`}
          >
            {m.ok && pts.length >= 2 ? (
              <Sparkline points={pts} up={up} height={large ? 56 : 30} />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-white/30">
                -
              </div>
            )}
          </div>
          <div className="text-right">
            <p
              className={`font-mono font-semibold tabular-nums leading-none text-white ${
                large ? "text-2xl" : "text-lg"
              }`}
            >
              {last != null ? fmt(last, INTEGER_KEYS.has(m.key)) : "-"}
              {m.unit || (m.key === "nikkei" || m.key === "jfe" ? "円" : "")}
            </p>
            {pts.length >= 2 && (
              <p
                className={`text-white/40 ${
                  large ? "mt-1.5 text-xs" : "text-[10px]"
                }`}
              >
                {fmtDate(pts[0].t)}〜{fmtDate(pts[pts.length - 1].t)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 ${
        large ? "p-6" : "p-4"
      }`}
    >
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2
          className={`flex items-center gap-2 font-bold tracking-tight ${
            large ? "text-2xl" : "text-base"
          }`}
        >
          <span className={large ? "text-2xl" : "text-lg"}>📊</span> 市場データ
          (3ヶ月)
        </h2>
        <div className="flex items-center gap-4">
          {data && byKey["usdjpy"] && byKey["usdjpy"].ok && (
            <span
              className={`rounded-full bg-amber-500/20 px-3 py-1 font-mono font-semibold tabular-nums text-amber-300 ${
                large ? "text-base" : "text-xs"
              }`}
            >
              💱 円/ドル {fmt(byKey["usdjpy"].points[byKey["usdjpy"].points.length - 1]?.v ?? 0)}円
            </span>
          )}
          <span className={large ? "text-sm text-white/40" : "text-xs text-white/40"}>
            {data
              ? new Date(data.fetchedAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "取得中…"}
          </span>
        </div>
      </div>

      {error && (
        <p className="py-4 text-center text-sm text-white/40">{error}</p>
      )}

      {!data && !error && (
        <p className="py-4 text-center text-sm text-white/40">読み込み中…</p>
      )}

      {data && comment && (
        <div
          className={`mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 ${
            large ? "text-lg leading-relaxed" : "text-sm leading-relaxed"
          }`}
        >
          <span className="mr-2">💬</span>
          <span className="text-white/85">{comment}</span>
        </div>
      )}

      {data && (
        <div
          className={`grid grid-cols-3 ${large ? "gap-4" : "gap-3"}`}
        >
          {groups.map((g) => (
            <div
              key={g.title}
              className={`flex flex-col rounded-xl border border-white/5 bg-white/5 ${
                large ? "gap-3 p-3" : "gap-2 p-2"
              }`}
            >
              <div
                className={`flex items-center gap-1.5 ${
                  large ? "px-2 pt-1" : "px-1 pt-0.5"
                }`}
              >
                <span className={large ? "text-base" : "text-xs"}>{g.icon}</span>
                <span
                  className={`font-semibold tracking-wide text-white/70 ${
                    large ? "text-base" : "text-xs"
                  }`}
                >
                  {g.title}
                </span>
              </div>
              {g.keys.map((k) => (byKey[k] ? renderCard(byKey[k]) : null))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
