"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { buildMarketComment } from "@/lib/marketComment";

interface Point {
  t: number;
  v: number; // close
  o: number; // open
  h: number; // high
  l: number; // low
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

/** Short label for axis ticks. */
function fmtAxis(v: number, unit: string): string {
  if (unit === "%") return v.toFixed(1);
  if (unit === "円") return v < 10 ? v.toFixed(1) : String(Math.round(v));
  if (v >= 10000) return (v / 1000).toFixed(0) + "k";
  return String(Math.round(v));
}

/**
 * Sparkline with Y-axis. The axis labels are rendered as HTML (not SVG text)
 * so they are never distorted by preserveAspectRatio="none".
 *
 * Layout: [axis-labels | svg-chart]
 */
function Sparkline({
  points,
  up,
  height = 40,
  unit,
}: {
  points: Point[];
  up: boolean;
  height?: number;
  unit: string;
}) {
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = points.length;

  // SVG chart area (no axis padding — axis is HTML).
  const W = 100;
  const H = height;
  const PAD = 2;
  const x0 = PAD;
  const x1 = W - PAD;
  const y0 = PAD;
  const y1 = H - PAD;

  const xOf = (i: number) => (n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1));
  const yOf = (v: number) => y1 - ((y1 - y0) * (v - min)) / range;

  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)";

  // Build path.
  const d =
    points
      .map((p, i) => {
        const x = xOf(i);
        const y = yOf(p.v);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  if (!d) return null;

  const lastV = points[n - 1].v;
  const lastY = yOf(lastV);

  // 3 axis ticks.
  const ticks = [
    { v: max, pct: 0 },
    { v: (max + min) / 2, pct: 50 },
    { v: min, pct: 100 },
  ];

  return (
    <div className="flex h-full w-full items-stretch gap-1">
      {/* Y-axis labels (HTML — never distorted). */}
      <div
        className="flex flex-col justify-between py-0.5 text-right font-mono text-[10px] leading-none text-white/40"
        style={{ width: "2.2rem" }}
      >
        {ticks.map((t, i) => (
          <span key={i}>{fmtAxis(t.v, unit)}</span>
        ))}
      </div>
      {/* Chart SVG. */}
      <div className="relative min-w-0 flex-1">
        {/* Grid lines (absolute, behind SVG). */}
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-px bg-white/10"
            style={{ top: `${t.pct}%` }}
          />
        ))}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d={`${d} L${W - PAD},${H} L${PAD},${H} Z`}
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
          <circle cx={W - PAD} cy={lastY} r={2} fill={stroke} />
        </svg>
      </div>
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

  // Rule-based commentary: 3 lines (FX, US, JP).
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
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span
              className={`font-mono font-semibold tabular-nums leading-none text-white ${
                large ? "text-2xl" : "text-lg"
              }`}
            >
              {last != null ? fmt(last, INTEGER_KEYS.has(m.key)) : "-"}
              {m.unit || (m.key === "nikkei" || m.key === "jfe" ? "円" : "")}
            </span>
            {pts.length >= 2 && (
              <span
                className={`text-white/40 ${
                  large ? "text-xs" : "text-[10px]"
                }`}
              >
                {fmtDate(pts[0].t)}〜{fmtDate(pts[pts.length - 1].t)}
              </span>
            )}
          </div>
          <div
            className={`shrink-0 ${large ? "h-14 w-full" : "h-10 w-full"}`}
          >
            {m.ok && pts.length >= 2 ? (
              <Sparkline
                points={pts}
                up={up}
                height={large ? 56 : 40}
                unit={m.unit}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-white/30">
                -
              </div>
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
              💱 円/ドル{" "}
              {fmt(
                byKey["usdjpy"].points[byKey["usdjpy"].points.length - 1]?.v ?? 0,
              )}
              円
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

      {data && commentLines.length > 0 && (
        <div
          className={`mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 ${
            large ? "text-lg leading-relaxed" : "text-sm leading-relaxed"
          }`}
        >
          {commentLines.map((line, i) => (
            <p key={i} className="text-white/85">
              <span className="mr-2">💬</span>
              {line}
            </p>
          ))}
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
