"use client";

import { useEffect, useState, useCallback } from "react";

interface Point {
  t: number;
  v: number;
}

interface MarketData {
  key: string;
  label: string;
  unit: "%" | "";
  symbol: string;
  ok: boolean;
  points: Point[];
}

interface MarketResponse {
  ok: boolean;
  fetchedAt: number;
  markets: MarketData[];
}

/** Build an SVG path string from points, scaled to a 100x28 viewBox. */
function buildPath(points: Point[], w: number, h: number, pad: number): string {
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

function Sparkline({ points, up }: { points: Point[]; up: boolean }) {
  const W = 100;
  const H = 30;
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

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("ja-JP", {
    maximumFractionDigits: v < 10 ? 3 : 1,
    minimumFractionDigits: v < 10 ? 2 : 0,
  });
}

function fmtDate(t: number): string {
  const d = new Date(t * 1000);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export default function MarketSparklines() {
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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
          <span className="text-lg">📊</span> 市場データ(3ヶ月)
        </h2>
        <span className="text-xs text-white/40">
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

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {markets.map((m) => {
            const pts = m.points;
            const first = pts[0]?.v;
            const last = pts[pts.length - 1]?.v;
            const diff = first && last ? last - first : 0;
            const up = diff >= 0;
            const sign = up ? "+" : "";
            return (
              <div
                key={m.key}
                className="flex flex-col gap-1 rounded-xl border border-white/5 bg-slate-900/40 p-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-white/60">
                    {m.label}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      up ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {sign}
                    {fmt(diff)}
                    {m.unit}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="h-8 w-20 shrink-0">
                    {m.ok && pts.length >= 2 ? (
                      <Sparkline points={pts} up={up} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-white/30">
                        -
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-semibold tabular-nums leading-none text-white">
                      {last != null ? fmt(last) : "-"}
                      {m.unit}
                    </p>
                    {pts.length >= 2 && (
                      <p className="text-[10px] text-white/40">
                        {fmtDate(pts[0].t)}〜{fmtDate(pts[pts.length - 1].t)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
