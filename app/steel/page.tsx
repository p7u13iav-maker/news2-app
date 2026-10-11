"use client";

import { useEffect, useState } from "react";

interface ProductionMonth {
  year: number;
  month: number;
  pigIron: number;
  crudeSteel: number;
  yoy: number;
}

interface WorldSteelMonth {
  year: number;
  month: number;
  period: string;
  worldCrudeSteel: number;
  japanCrudeSteel?: number;
  yoy: number;
}

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

interface SteelData {
  ok: boolean;
  fetchedAt: number;
  production: ProductionMonth[];
  worldSteel: WorldSteelMonth[];
  stocks: StockData[];
  comment: string[];
  error?: string;
}

function fmtDate(t: number): string {
  const d = new Date(t * 1000);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

/** Simple SVG sparkline. */
function Sparkline({
  points,
  up,
  height = 32,
}: {
  points: StockPoint[];
  up: boolean;
  height?: number;
}) {
  if (points.length < 2) return null;
  const W = 100;
  const H = height;
  const PAD = 2;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = points.length;
  const d = points
    .map((p, i) => {
      const x = PAD + ((W - 2 * PAD) * i) / (n - 1);
      const y = H - PAD - ((H - 2 * PAD) * (p.v - min)) / range;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";
  const lastY = H - PAD - ((H - 2 * PAD) * (points[n - 1].v - min)) / range;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <path d={`${d} L${W - PAD},${H} L${PAD},${H} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={W - PAD} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

/** Monthly production bar chart. */
function ProductionChart({ data, unit }: { data: { month: number; value: number }[]; unit: string }) {
  if (data.length === 0) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals) * 0.95;
  const max = Math.max(...vals) * 1.05;
  const range = max - min || 1;
  const W = 400;
  const H = 120;
  const PAD = 2;
  const barW = (W - 2 * PAD) / data.length - 2;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "120px" }}>
        {data.map((d, i) => {
          const x = PAD + (i * (W - 2 * PAD)) / data.length + 1;
          const barH = ((d.value - min) / range) * (H - 20);
          const y = H - 16 - barH;
          const isLatest = i === data.length - 1;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                fill={isLatest ? "#38bdf8" : "rgba(56,189,248,0.4)"}
              />
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize="9"
              >
                {d.month}月
              </text>
              {isLatest && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {d.value.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SteelPage() {
  const [data, setData] = useState<SteelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/steel")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error || "Failed to load data");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background. */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">
            🏭
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">朝会前のひととき</p>
            <p className="text-sm text-white/50">鉄鋼業インデックス</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {data?.fetchedAt && (
            <p className="text-sm text-white/50">
              {new Date(data.fetchedAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {clock && (
            <div className="text-right">
              <p className="font-mono text-3xl font-light tabular-nums">
                {clock.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="text-xs text-white/50">
                {clock.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Content. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-sky-400" />
              <p className="text-lg text-white/60">鉄鋼データを取得中…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <p className="mb-2 text-2xl">⚠️</p>
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Comment box. */}
            <div className="shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed">
              <span className="mr-2">💬</span>
              <div className="space-y-1">
                {data.comment.map((line, i) => (
                  <p key={i} className="text-white/85">{line}</p>
                ))}
              </div>
            </div>

            {/* 3-column grid: Japan Production | World Production | Stocks. */}
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
              {/* Left: Japan Production. */}
              <div className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">🇯🇵</span>
                  <h2 className="text-lg font-bold">日本粗鋼生産 (JISF)</h2>
                </div>
                <div className="min-h-0 flex-1">
                  <ProductionChart
                    data={data.production.map((p) => ({ month: p.month, value: p.crudeSteel }))}
                    unit="万トン"
                  />
                </div>
                {data.production.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {data.production.slice(-3).map((p, i) => (
                      <div key={i} className="rounded-lg bg-white/5 p-2">
                        <p className="text-xs text-white/40">
                          {p.year}年{p.month}月
                        </p>
                        <p className="font-mono text-sm font-semibold text-sky-300">
                          {p.crudeSteel.toFixed(1)}
                          <span className="ml-0.5 text-xs text-white/40">万t</span>
                        </p>
                        <p
                          className={`text-xs ${p.yoy >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {p.yoy >= 0 ? "+" : ""}
                          {p.yoy.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Center: World Production. */}
              <div className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">🌍</span>
                  <h2 className="text-lg font-bold">世界粗鋼生産 (worldsteel)</h2>
                </div>
                <div className="min-h-0 flex-1">
                  <ProductionChart
                    data={data.worldSteel.map((w) => ({ month: w.month, value: w.worldCrudeSteel }))}
                    unit="百万トン"
                  />
                </div>
                {data.worldSteel.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {data.worldSteel.slice(-3).map((w, i) => (
                      <div key={i} className="rounded-lg bg-white/5 p-2">
                        <p className="text-xs text-white/40">
                          {w.year}年{w.month}月
                        </p>
                        <p className="font-mono text-sm font-semibold text-emerald-300">
                          {w.worldCrudeSteel.toFixed(1)}
                          <span className="ml-0.5 text-xs text-white/40">Mt</span>
                        </p>
                        <p
                          className={`text-xs ${w.yoy >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {w.yoy >= 0 ? "+" : ""}
                          {w.yoy.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Related stocks. */}
              <div className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">📈</span>
                  <h2 className="text-lg font-bold">関連銘柄 (1ヶ月)</h2>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  {data.stocks.map((s) => {
                    const up = s.diff >= 0;
                    const sign = up ? "+" : "";
                    return (
                      <div
                        key={s.key}
                        className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/60">
                            {s.label}
                          </p>
                          <p className="font-mono text-lg font-bold tabular-nums">
                            {s.ok
                              ? s.last.toLocaleString("ja-JP", {
                                  maximumFractionDigits: s.unit === "$" ? 2 : 0,
                                })
                              : "-"}
                            <span className="ml-0.5 text-xs font-normal text-white/40">
                              {s.unit}
                            </span>
                          </p>
                        </div>
                        <div className="h-8 w-24 shrink-0">
                          {s.ok && s.points.length >= 2 ? (
                            <Sparkline points={s.points} up={up} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-white/30">
                              -
                            </div>
                          )}
                        </div>
                        <div className="w-20 shrink-0 text-right">
                          <p
                            className={`font-mono text-sm tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {s.ok ? sign + s.diff.toLocaleString("ja-JP", { maximumFractionDigits: s.unit === "$" ? 2 : 0 }) : "-"}
                          </p>
                          <p className="text-[10px] text-white/30">
                            {s.ok && s.points.length >= 2
                              ? `${fmtDate(s.points[0].t)}〜${fmtDate(s.points[s.points.length - 1].t)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-3">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/market"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            📊 市場データ
          </a>
          <a
            href="/horoscope"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ✨ 12星座占い
          </a>
          <a
            href="/weather"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ⛅ 天気 →
          </a>
        </div>
        <p className="text-xs text-white/30">
          出典: JISF, worldsteel (CC BY 4.0)
        </p>
      </footer>
    </div>
  );
}
