"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { buildMarketComment } from "@/lib/marketComment";

interface Point {
  t: number;
  v: number;
  o: number;
  h: number;
  l: number;
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

const INTEGER_KEYS = new Set(["sp500", "nasdaq", "nikkei", "jfe"]);

function fmt(v: number, integer = false): string {
  if (!Number.isFinite(v)) return "-";
  if (integer) {
    return v.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
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

function fmtAxis(v: number, unit: string): string {
  if (unit === "%") return v.toFixed(1);
  if (unit === "円") return v < 10 ? v.toFixed(1) : String(Math.round(v));
  if (v >= 10000) return (v / 1000).toFixed(0) + "k";
  return String(Math.round(v));
}

/**
 * Sparkline chart with Y-axis labels.
 *
 * The SVG uses preserveAspectRatio="none" to stretch to fill the container.
 * Y-axis labels are HTML elements positioned with the same percentage offsets
 * as the SVG's internal padding, so they align with the grid lines.
 */
function Sparkline({
  points,
  up,
  unit,
}: {
  points: Point[];
  up: boolean;
  unit: string;
}) {
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = points.length;

  // SVG viewBox: 100×40, with 3-unit padding on all sides.
  const W = 100;
  const H = 40;
  const PAD = 3;
  const x0 = PAD;
  const x1 = W - PAD;
  const y0 = PAD;
  const y1 = H - PAD;

  const xOf = (i: number) => (n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1));
  const yOf = (v: number) => y1 - ((y1 - y0) * (v - min)) / range;

  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";

  const d = points
    .map((p, i) => {
      const x = xOf(i);
      const y = yOf(p.v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  if (!d) return null;

  const lastY = yOf(points[n - 1].v);

  // Grid line positions as % of container height.
  // SVG PAD=3 out of H=40 → 7.5% from top/bottom.
  const padPct = (PAD / H) * 100; // 7.5
  const gridTops = [padPct, 50, 100 - padPct]; // [7.5, 50, 92.5]
  const tickVals = [max, (max + min) / 2, min];

  return (
    <div className="flex h-full w-full gap-2">
      {/* Y-axis labels — same height as chart, labels at grid positions. */}
      <div className="relative w-10 shrink-0">
        {tickVals.map((v, i) => (
          <span
            key={i}
            className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none text-white/40"
            style={{ top: `${gridTops[i]}%` }}
          >
            {fmtAxis(v, unit)}
          </span>
        ))}
      </div>
      {/* Chart. */}
      <div className="relative min-w-0 flex-1">
        {gridTops.map((top, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-px bg-white/[0.08]"
            style={{ top: `${top}%` }}
          />
        ))}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d={`${d} L${x1},${y1} L${x0},${y1} Z`}
            fill={fill}
            stroke="none"
          />
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={x1} cy={lastY} r={2} fill={stroke} />
        </svg>
      </div>
    </div>
  );
}

/**
 * Large USD/JPY hero bar. Shows the current rate in big numbers with the
 * 3-month change, a mini sparkline, and a date range.
 */
function FxHero({
  market,
  large,
}: {
  market: MarketData;
  large: boolean;
}) {
  const pts = market.points;
  const first = pts[0]?.v;
  const last = pts[pts.length - 1]?.v;
  const diff = first && last ? last - first : 0;
  const up = diff >= 0;
  const sign = up ? "+" : "";

  // Mini sparkline (reuse the same geometry as Sparkline but wider).
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = pts.length;
  const W = 100;
  const H = 30;
  const PAD = 2;
  const xOf = (i: number) => (n === 1 ? PAD : PAD + ((W - 2 * PAD) * i) / (n - 1));
  const yOf = (v: number) =>
    H - PAD - ((H - 2 * PAD) * (v - min)) / range;
  const d = pts
    .map((p, i) => {
      const x = xOf(i);
      const y = yOf(p.v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = up ? "#34d399" : "#f87171";

  return (
    <div
      className={`mb-3 flex items-center gap-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-5 ${
        large ? "py-4" : "py-3"
      }`}
    >
      {/* Icon */}
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-amber-500/15 ${
          large ? "h-14 w-14 text-3xl" : "h-10 w-10 text-2xl"
        }`}
      >
        💱
      </span>

      {/* Rate + label */}
      <div className="min-w-0 flex-1">
        <p
          className={`font-medium tracking-wide text-amber-200/70 ${
            large ? "text-sm" : "text-xs"
          }`}
        >
          円/ドル為替（USD/JPY）
        </p>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono font-bold tabular-nums text-white ${
              large ? "text-5xl" : "text-3xl"
            }`}
          >
            {last != null ? last.toFixed(2) : "-"}
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              large ? "text-lg" : "text-sm"
            } ${up ? "text-emerald-400" : "text-red-400"}`}
          >
            {sign}
            {diff >= 0 ? "" : ""}
            {Math.abs(diff).toFixed(2)}円
            {up ? " ↑" : " ↓"}
            <span className="ml-1.5 text-white/30">（3ヶ月）</span>
          </span>
        </div>
      </div>

      {/* Mini sparkline */}
      <div className={`hidden shrink-0 sm:block ${large ? "h-16 w-40" : "h-12 w-28"}`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          <path
            d={`${d} L${xOf(n - 1)},${H - PAD} L${xOf(0)},${H - PAD} Z`}
            fill={up ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}
            stroke="none"
          />
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Date range */}
      {pts.length >= 2 && (
        <span className={`hidden shrink-0 text-white/30 md:block ${large ? "text-xs" : "text-[10px]"}`}>
          {fmtDate(pts[0].t)}〜{fmtDate(pts[pts.length - 1].t)}
        </span>
      )}
    </div>
  );
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
      if (json.ok) setData(json);
      else setError("市場データを取得できませんでした。");
    } catch {
      setError("市場データを取得できませんでした。");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markets = data?.markets ?? [];

  const commentLines = useMemo(
    () => (data && markets.length > 0 ? buildMarketComment(markets) : []),
    [data, markets],
  );

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
    const chartH = large ? "h-20" : "h-14";

    return (
      <div
        key={m.key}
        className={`rounded-lg px-3 ${large ? "py-3" : "py-2"}`}
      >
        {/* Row 1: label + diff */}
        <div className="mb-1 flex items-baseline justify-between">
          <span
            className={`font-medium text-white/60 ${
              large ? "text-sm" : "text-xs"
            }`}
          >
            {m.label}
          </span>
          <span
            className={`font-mono tabular-nums ${
              large ? "text-sm" : "text-xs"
            } ${up ? "text-emerald-400" : "text-red-400"}`}
          >
            {sign}
            {fmt(diff, INTEGER_KEYS.has(m.key))}
            {m.unit}
          </span>
        </div>
        {/* Row 2: value + date range */}
        <div className="mb-1.5 flex items-baseline justify-between">
          <span
            className={`font-mono font-bold tabular-nums text-white ${
              large ? "text-2xl" : "text-lg"
            }`}
          >
            {last != null ? fmt(last, INTEGER_KEYS.has(m.key)) : "-"}
            <span className="ml-0.5 text-sm font-normal text-white/50">
              {m.unit || (m.key === "nikkei" || m.key === "jfe" ? "円" : "")}
            </span>
          </span>
          {pts.length >= 2 && (
            <span
              className={`text-white/30 ${large ? "text-xs" : "text-[10px]"}`}
            >
              {fmtDate(pts[0].t)}〜{fmtDate(pts[pts.length - 1].t)}
            </span>
          )}
        </div>
        {/* Row 3: chart with Y-axis */}
        <div className={chartH}>
          {m.ok && pts.length >= 2 ? (
            <Sparkline points={pts} up={up} unit={m.unit} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-white/30">
              -
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${
        large ? "p-6" : "p-4"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h2
          className={`flex items-center gap-2 font-bold tracking-tight ${
            large ? "text-2xl" : "text-base"
          }`}
        >
          <span className={large ? "text-2xl" : "text-lg"}>📊</span> 市場データ
          (3ヶ月)
        </h2>
        <span className={`text-white/40 ${large ? "text-sm" : "text-xs"}`}>
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

      {error && (
        <p className="py-4 text-center text-sm text-white/40">{error}</p>
      )}

      {!data && !error && (
        <p className="py-4 text-center text-sm text-white/40">読み込み中…</p>
      )}

      {/* Comment */}
      {data && commentLines.length > 0 && (
        <div
          className={`mb-3 space-y-1 ${
            large ? "text-base leading-relaxed" : "text-sm leading-relaxed"
          }`}
        >
          {commentLines.map((line, i) => (
            <p key={i} className="text-white/75">
              <span className="mr-1.5 text-white/40">💬</span>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* FX hero — large, prominent USD/JPY display. */}
      {data && byKey["usdjpy"]?.ok && (
        <FxHero market={byKey["usdjpy"]} large={large} />
      )}

      {/* 3-column grid */}
      {data && (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-0 divide-x divide-white/[0.06]">
          {groups.map((g) => (
            <div
              key={g.title}
              className={`flex flex-col ${large ? "gap-3" : "gap-2"} ${
                g.title !== "金利" ? "pl-4" : ""
              } ${g.title !== "日本株" ? "pr-4" : ""}`}
            >
              {/* Group header — made prominent so the 3 column titles stand
                  out against the sparkline cards below. */}
              <div
                className={`flex items-center gap-2 border-b ${
                  large ? "border-white/15 pb-2" : "border-white/10 pb-1"
                }`}
              >
                <span className={large ? "text-lg" : "text-sm"}>{g.icon}</span>
                <span
                  className={`font-bold tracking-wide text-white ${
                    large ? "text-lg" : "text-sm"
                  }`}
                >
                  {g.title}
                </span>
              </div>
              {/* Cards */}
              {g.keys.map((k) => (byKey[k] ? renderCard(byKey[k]) : null))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
