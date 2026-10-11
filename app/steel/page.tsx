"use client";

import { useEffect, useState } from "react";

interface ProductionMonth {
  year: number;
  month: number;
  pigIron: number;
  crudeSteel: number;
  yoy: number;
}

interface CountryProduction {
  name: string;
  value: number;
}

interface WorldSteelMonth {
  year: number;
  month: number;
  period: string;
  worldCrudeSteel: number;
  japanCrudeSteel?: number;
  byCountry: CountryProduction[];
  yoy: number;
}

interface SupplyDemandSummary {
  period: string;
  production: number;
  shipments: number;
  shipmentsDomestic: number;
  shipmentsExport: number;
  inventory: number;
  inventoryRatio: number;
  productionMom: number;
  productionYoy: number;
}

interface SupplyDemandMonth {
  year: number;
  month: number;
  crudeSteel: number;
  carbonSteel: number;
  shipmentsTotal: number;
  shipmentsDomestic: number;
  shipmentsExport: number;
  inventory: number;
  inventoryRatio: number;
}

interface OrderMonth {
  year: number;
  month: number;
  total: number;
  domestic: number;
  construction: number;
  machinery: number;
  electrical: number;
  ships: number;
  automobiles: number;
  railway: number;
  otherTransport: number;
  export: number;
}

interface JisfComment {
  period: string;
  published: string;
  headline: string;
  bullets: string[];
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
  supplyDemand: {
    summary: SupplyDemandSummary | null;
    trend: SupplyDemandMonth[];
  };
  orders: OrderMonth[];
  jisfComment: JisfComment | null;
  stocks: StockData[];
  comment: string[];
  error?: string;
}

/** Small SVG line sparkline. */
function Sparkline({
  values,
  up,
  height = 40,
  color,
}: {
  values: number[];
  up: boolean;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const W = 100;
  const H = height;
  const PAD = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const d = values
    .map((v, i) => {
      const x = PAD + ((W - 2 * PAD) * i) / (n - 1);
      const y = H - PAD - ((H - 2 * PAD) * (v - min)) / range;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = color ?? (up ? "#34d399" : "#f87171");
  const fill = color ?? (up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)");
  const lastY = H - PAD - ((H - 2 * PAD) * (values[n - 1] - min)) / range;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <path d={`${d} L${W - PAD},${H} L${PAD},${H} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={W - PAD} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

/** Monthly bar chart. Fills its parent (use inside a min-h-0 flex-1 wrapper). */
function BarChart({
  data,
  color = "#38bdf8",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (data.length === 0) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals) * 0.95;
  const max = Math.max(...vals) * 1.05;
  const range = max - min || 1;
  const W = 100;
  const H = 100;
  const PAD = 2;
  const n = data.length;
  const slot = (W - 2 * PAD) / n;
  const barW = Math.max(slot - 2, 1);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          {/* baseline */}
          <line
            x1={PAD}
            y1={H - 8}
            x2={W - PAD}
            y2={H - 8}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {data.map((d, i) => {
            const x = PAD + i * slot + (slot - barW) / 2;
            const barH = Math.max(
              ((d.value - min) / range) * (H - 16),
              0.5,
            );
            const y = H - 8 - barH;
            const isLatest = i === n - 1;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={1}
                fill={isLatest ? color : color + "55"}
              />
            );
          })}
        </svg>
      </div>
      {/* Month labels aligned to each bar slot. */}
      <div className="flex shrink-0 pt-0.5" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[8px] leading-none text-white/35">
            {i === 0 || i === n - 1 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Stacked bar chart for country-level world production. Fills its parent. */
function StackedBarChart({
  data,
}: {
  data: {
    label: string;
    segments: { name: string; value: number }[];
    total: number;
  }[];
}) {
  if (data.length === 0) return null;
  const n = data.length;
  const W = 100;
  const H = 100;
  const PAD = 2;
  const slot = (W - 2 * PAD) / n;
  const barW = Math.max(slot - 2, 1);

  // Compute the max total for scaling.
  const maxTotal = Math.max(...data.map((d) => d.total));

  const palette: Record<string, string> = {
    中国: "#f87171",
    日本: "#38bdf8",
    米国: "#a78bfa",
    EU27: "#34d399",
    韓国: "#fbbf24",
    インド: "#fb923c",
    ロシア: "#f472b6",
    台湾: "#22d3ee",
    ドイツ: "#818cf8",
    トルコ: "#e879f9",
    ブラジル: "#facc15",
    メキシコ: "#4ade80",
    イラン: "#c084fc",
    ベトナム: "#2dd4bf",
    その他: "#64748b",
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          {/* baseline */}
          <line
            x1={PAD}
            y1={H - 8}
            x2={W - PAD}
            y2={H - 8}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {data.map((d, i) => {
            const x = PAD + i * slot + (slot - barW) / 2;
            const cx = PAD + i * slot + slot / 2;
            const scale = (H - 20) / (maxTotal || 1);
            let yCursor = H - 8;
            let chinaY = 0;
            return (
              <g key={i}>
                {d.segments.map((seg, si) => {
                  const segH = seg.value * scale;
                  const y = yCursor - segH;
                  const isLatest = i === n - 1;
                  const fill = palette[seg.name] ?? "#94a3b8";
                  if (seg.name === "中国") chinaY = y;
                  yCursor = y;
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(segH, 0.3)}
                      fill={isLatest ? fill : fill + "66"}
                    />
                  );
                })}
                {/* World total label above the bar. */}
                <text
                  x={cx}
                  y={yCursor - 1.5}
                  textAnchor="middle"
                  fontSize={3.5}
                  fill="#f0fdf4"
                  vectorEffect="non-scaling-stroke"
                >
                  {d.total.toFixed(0)}
                </text>
                {/* China value label (inside the bar, on the China segment). */}
                {chinaY > 0 && (
                  <text
                    x={cx}
                    y={chinaY + 4}
                    textAnchor="middle"
                    fontSize={3}
                    fill="#fff"
                    vectorEffect="non-scaling-stroke"
                  >
                    {d.segments
                      .find((s) => s.name === "中国")
                      ?.value.toFixed(0)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Month labels. */}
      <div
        className="flex shrink-0 pt-0.5"
        style={{ paddingLeft: PAD, paddingRight: PAD }}
      >
        {data.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[8px] leading-none text-white/35"
          >
            {i === 0 || i === n - 1 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Panel box matching the user's wireframe (light blue border). */
function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-sky-300/30 bg-sky-950/20 p-2 ${className}`}>
      {title && (
        <p className="mb-1 text-[11px] font-semibold text-sky-200">{title}</p>
      )}
      {children}
    </div>
  );
}

/** Column header (国内 / 鋼材需給 / 受注量). */
function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-sm font-bold text-white/90">{children}</p>
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

  const sd = data?.supplyDemand;
  const orders = data?.orders ?? [];
  const sdTrend = sd?.trend ?? [];

  // Orders: last 3 months for the table.
  const orderLatest = orders[orders.length - 1];
  const orderPrev = orders[orders.length - 2];
  const orderPrevPrev = orders[orders.length - 3];
  const orderMom =
    orderPrev && orderLatest
      ? ((orderLatest.total - orderPrev.total) / orderPrev.total) * 100
      : 0;

  // Supply-demand comment (rule-based from inventory ratio + trends).
  function sdComment(): string {
    if (!sd?.summary) return "";
    const s = sd.summary;
    const ratio = s.inventoryRatio;
    const ratioText =
      ratio >= 120 ? "在庫が積み上がり需給はやや逼迫気味" : ratio >= 100 ? "在庫率は100%超え、需給はやや逼迫" : "在庫率は100%未満、需給はやや緩";
    const prodDir = s.productionMom >= 100 ? "前月比増" : "前月比減";
    return `${ratioText}(在庫率${ratio.toFixed(0)}%)。生産は${prodDir}。`;
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-8 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">
            🏭
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">朝会前のひととき</p>
            <p className="text-xs text-white/50">鉄鋼業インデックス</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {data?.fetchedAt && (
            <p className="text-xs text-white/50">
              更新 {new Date(data.fetchedAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {clock && (
            <div className="text-right">
              <p className="font-mono text-2xl font-light tabular-nums">
                {clock.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="text-[10px] text-white/50">
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
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-4">
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
            {/* Top banner: JISF qualitative comment. */}
            <div className="shrink-0 rounded-lg border border-sky-300/40 bg-sky-900/30 px-4 py-2">
              <p className="text-[11px] font-semibold text-sky-200">
                鉄鋼連盟の最新月の定性コメント
                {data.jisfComment?.period && (
                  <span className="ml-2 font-normal text-white/50">
                    ({data.jisfComment.period}・{data.jisfComment.published}発表)
                  </span>
                )}
              </p>
              {data.jisfComment && (
                <div className="mt-1">
                  {data.jisfComment.headline && (
                    <p className="text-sm font-bold text-white">
                      {data.jisfComment.headline}
                    </p>
                  )}
                  <div className="mt-0.5 flex flex-wrap gap-x-6 gap-y-0.5">
                    {data.jisfComment.bullets.slice(0, 3).map((b, i) => (
                      <p key={i} className="text-xs text-white/70">
                        ○ {b}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3-column grid. */}
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
              {/* Column 1: 国内 (Japan + World production). */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>国内</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-2 gap-2">
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="mb-1 shrink-0 text-xs font-semibold text-white/80">
                      日本の粗鋼生産
                    </p>
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={data.production.map((p) => ({
                          label: `${p.month}月`,
                          value: p.crudeSteel,
                        }))}
                        color="#38bdf8"
                      />
                    </div>
                    {data.production.length > 0 && (
                      <p className="mt-1 shrink-0 text-xs text-white/70">
                        最新{" "}
                        <span className="font-mono font-bold text-sky-300">
                          {data.production[data.production.length - 1].crudeSteel.toFixed(1)}
                        </span>
                        万トン(
                        <span
                          className={
                            data.production[data.production.length - 1].yoy >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          前年比{" "}
                          {data.production[data.production.length - 1].yoy >= 0
                            ? "+"
                            : ""}
                          {data.production[data.production.length - 1].yoy.toFixed(1)}%
                        </span>
                        )
                      </p>
                    )}
                  </Panel>

                  <Panel className="flex flex-col overflow-hidden">
                    <p className="mb-1 shrink-0 text-xs font-semibold text-white/80">
                      世界の粗鋼生産（国・地域別）
                    </p>
                    <div className="min-h-0 flex-1">
                      <StackedBarChart
                        data={data.worldSteel.map((w) => ({
                          label: `${w.month}月`,
                          segments: w.byCountry,
                          total: w.worldCrudeSteel,
                        }))}
                      />
                    </div>
                    {/* Legend: top countries by latest-month share. */}
                    {data.worldSteel.length > 0 && (() => {
                      const latest = data.worldSteel[data.worldSteel.length - 1];
                      const sorted = [...latest.byCountry].sort(
                        (a, b) => b.value - a.value,
                      );
                      const palette: Record<string, string> = {
                        中国: "#f87171",
                        日本: "#38bdf8",
                        米国: "#a78bfa",
                        EU27: "#34d399",
                        韓国: "#fbbf24",
                        インド: "#fb923c",
                        ロシア: "#f472b6",
                        台湾: "#22d3ee",
                        ドイツ: "#818cf8",
                        トルコ: "#e879f9",
                        ブラジル: "#facc15",
                        メキシコ: "#4ade80",
                        イラン: "#c084fc",
                        ベトナム: "#2dd4bf",
                        その他: "#64748b",
                      };
                      return (
                        <div className="mt-1 flex shrink-0 flex-wrap gap-x-2 gap-y-0.5">
                          {sorted.slice(0, 6).map((c) => (
                            <span
                              key={c.name}
                              className="flex items-center gap-0.5 text-[8px] text-white/50"
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-sm"
                                style={{
                                  backgroundColor: palette[c.name] ?? "#94a3b8",
                                }}
                              />
                              {c.name}
                            </span>
                          ))}
                          {sorted.length > 6 && (
                            <span className="text-[8px] text-white/35">
                              +{sorted.length - 6}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {data.worldSteel.length > 0 && (
                      <p className="mt-0.5 shrink-0 text-xs text-white/70">
                        最新{" "}
                        <span className="font-mono font-bold text-emerald-300">
                          {data.worldSteel[data.worldSteel.length - 1].worldCrudeSteel.toFixed(1)}
                        </span>
                        百万トン(
                        <span
                          className={
                            data.worldSteel[data.worldSteel.length - 1].yoy >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          前年比{" "}
                          {data.worldSteel[data.worldSteel.length - 1].yoy >= 0
                            ? "+"
                            : ""}
                          {data.worldSteel[data.worldSteel.length - 1].yoy.toFixed(1)}%
                        </span>
                        )
                      </p>
                    )}
                  </Panel>
                </div>
              </div>

              {/* Column 2: 鋼材需給 (Supply-demand). */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>鋼材需給</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-3 gap-2">
                  {/* Production trend. */}
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="mb-0.5 shrink-0 text-[11px] font-semibold text-white/80">
                      生産の月別
                    </p>
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.carbonSteel,
                        }))}
                        color="#a78bfa"
                      />
                    </div>
                    {sdTrend.length > 0 && (
                      <p className="mt-0.5 shrink-0 text-[10px] text-white/70">
                        最新{" "}
                        <span className="font-mono font-bold text-violet-300">
                          {sdTrend[sdTrend.length - 1].carbonSteel.toFixed(1)}
                        </span>
                        万トン
                      </p>
                    )}
                  </Panel>

                  {/* Shipments trend. */}
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="mb-0.5 shrink-0 text-[11px] font-semibold text-white/80">
                      出荷量の月別
                    </p>
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.shipmentsTotal,
                        }))}
                        color="#f472b6"
                      />
                    </div>
                    {sdTrend.length > 0 && (
                      <p className="mt-0.5 shrink-0 text-[10px] text-white/70">
                        最新{" "}
                        <span className="font-mono font-bold text-pink-300">
                          {sdTrend[sdTrend.length - 1].shipmentsTotal.toFixed(1)}
                        </span>
                        万トン
                      </p>
                    )}
                  </Panel>

                  {/* Inventory trend + inventory ratio (integrated). */}
                  <Panel className="flex flex-col overflow-hidden">
                    <div className="mb-0.5 flex shrink-0 items-center justify-between">
                      <p className="text-[11px] font-semibold text-white/80">
                        在庫量の月別
                      </p>
                      {sd?.summary && (
                        <p className="text-[10px] text-white/50">
                          在庫率{" "}
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              sd.summary.inventoryRatio >= 100
                                ? "text-amber-300"
                                : "text-emerald-300"
                            }`}
                          >
                            {sd.summary.inventoryRatio.toFixed(1)}%
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.inventory,
                        }))}
                        color="#fbbf24"
                      />
                    </div>
                    {sdTrend.length > 0 && (
                      <div className="mt-0.5 shrink-0">
                        <p className="text-[10px] text-white/70">
                          最新{" "}
                          <span className="font-mono font-bold text-amber-300">
                            {sdTrend[sdTrend.length - 1].inventory.toFixed(1)}
                          </span>
                          万トン
                        </p>
                        <p className="mt-0.5 text-[9px] leading-snug text-white/55">
                          {sdComment()}
                        </p>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>

              {/* Column 3: 受注量 (Orders). */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>受注量</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-5 gap-2">
                  {/* Total + MoM + trend (spans 3 rows = bigger chart). */}
                  <Panel className="row-span-3 flex flex-col overflow-hidden">
                    <p className="shrink-0 text-[11px] text-white/60">
                      受注高 合計と前月比
                    </p>
                    {orderLatest && (
                      <>
                        <div className="mt-1 flex shrink-0 items-end justify-between">
                          <div>
                            <p className="font-mono text-2xl font-bold tabular-nums text-white">
                              {orderLatest.total.toFixed(1)}
                              <span className="ml-0.5 text-xs font-normal text-white/40">
                                万トン
                              </span>
                            </p>
                            <p className="text-[9px] text-white/40">
                              {orderLatest.year}年{orderLatest.month}月
                            </p>
                          </div>
                          <span
                            className={`font-mono text-base tabular-nums ${orderMom >= 0 ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {orderMom >= 0 ? "+" : ""}
                            {orderMom.toFixed(1)}%
                            <span className="ml-0.5 text-[9px] text-white/30">前月比</span>
                          </span>
                        </div>
                        {/* Monthly trend (sparkline) — fills remaining space. */}
                        <div className="mt-1.5 min-h-0 flex-1">
                          <Sparkline
                            values={orders.map((o) => o.total)}
                            up={
                              orders[orders.length - 1].total >= orders[0].total
                            }
                          />
                        </div>
                        <p className="mt-0.5 shrink-0 text-[9px] text-white/35">
                          月別推移図
                        </p>
                      </>
                    )}
                  </Panel>

                  {/* Orders table by sector (spans 2 rows, bottom). */}
                  <Panel className="row-span-2 flex flex-col overflow-hidden">
                    <p className="mb-1 shrink-0 text-[11px] font-semibold text-sky-200">
                      受注 品目別
                    </p>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-white/50">
                            <th className="pb-1 text-left font-normal">品目</th>
                            {orderPrevPrev && (
                              <th className="pb-1 text-right font-normal">
                                {orderPrevPrev.month}月
                              </th>
                            )}
                            {orderPrev && (
                              <th className="pb-1 text-right font-normal">
                                {orderPrev.month}月
                              </th>
                            )}
                            {orderLatest && (
                              <th className="pb-1 text-right font-normal text-sky-300">
                                {orderLatest.month}月
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Compute 機械用 = 産業機械+電気機械+鉄道車両+その他輸送機械 */}
                          {(() => {
                            const mach = (o?: OrderMonth) =>
                              (o?.machinery ?? 0) +
                              (o?.electrical ?? 0) +
                              (o?.railway ?? 0) +
                              (o?.otherTransport ?? 0);
                            const rows: {
                              label: string;
                              pp: number;
                              pv: number;
                              lt: number;
                            }[] = [
                              {
                                label: "建設用",
                                pp: orderPrevPrev?.construction ?? 0,
                                pv: orderPrev?.construction ?? 0,
                                lt: orderLatest?.construction ?? 0,
                              },
                              {
                                label: "自動車用",
                                pp: orderPrevPrev?.automobiles ?? 0,
                                pv: orderPrev?.automobiles ?? 0,
                                lt: orderLatest?.automobiles ?? 0,
                              },
                              {
                                label: "機械用",
                                pp: mach(orderPrevPrev),
                                pv: mach(orderPrev),
                                lt: mach(orderLatest),
                              },
                              {
                                label: "船舶用",
                                pp: orderPrevPrev?.ships ?? 0,
                                pv: orderPrev?.ships ?? 0,
                                lt: orderLatest?.ships ?? 0,
                              },
                              {
                                label: "輸出",
                                pp: orderPrevPrev?.export ?? 0,
                                pv: orderPrev?.export ?? 0,
                                lt: orderLatest?.export ?? 0,
                              },
                            ];
                            return rows.map((r) => {
                              const mom =
                                r.pv > 0 ? ((r.lt - r.pv) / r.pv) * 100 : 0;
                              return (
                                <tr
                                  key={r.label}
                                  className="border-t border-white/10"
                                >
                                  <td className="py-1 text-white/70">
                                    {r.label}
                                  </td>
                                  <td className="py-1 text-right font-mono tabular-nums text-white/50">
                                    {r.pp > 0 ? r.pp.toFixed(1) : "-"}
                                  </td>
                                  <td className="py-1 text-right font-mono tabular-nums text-white/70">
                                    {r.pv > 0 ? r.pv.toFixed(1) : "-"}
                                  </td>
                                  <td className="py-1 text-right font-mono tabular-nums">
                                    <span className="font-bold text-white">
                                      {r.lt > 0 ? r.lt.toFixed(1) : "-"}
                                    </span>
                                    <span
                                      className={`ml-1 text-[10px] ${mom >= 0 ? "text-emerald-400" : "text-red-400"}`}
                                    >
                                      {mom >= 0 ? "+" : ""}
                                      {mom.toFixed(0)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-8 py-2">
        <a
          href="/"
          className="text-xs text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/market"
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            📊 市場データ
          </a>
          <a
            href="/horoscope"
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            ✨ 12星座占い
          </a>
          <a
            href="/weather"
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            ⛅ 天気 →
          </a>
        </div>
        <p className="text-[10px] text-white/30">出典: JISF, worldsteel (CC BY 4.0)</p>
      </footer>
    </div>
  );
}
