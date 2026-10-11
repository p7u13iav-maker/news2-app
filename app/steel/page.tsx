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

  // Leave headroom at the top (16 SVG units) so value labels fit above bars.
  const BASE = H - 8; // baseline y
  const TOP = 16; // top of the plot area (headroom for labels)
  const plotH = BASE - TOP;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Chart area (relative so value labels can be HTML overlays). */}
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          {/* baseline */}
          <line
            x1={PAD}
            y1={BASE}
            x2={W - PAD}
            y2={BASE}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {data.map((d, i) => {
            const x = PAD + i * slot + (slot - barW) / 2;
            const barH = Math.max(((d.value - min) / range) * plotH, 0.5);
            const y = BASE - barH;
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

        {/* HTML value labels above each bar (avoid SVG text distortion). */}
        {data.map((d, i) => {
          const cxPct = ((PAD + i * slot + slot / 2) / W) * 100;
          const barH = Math.max(((d.value - min) / range) * plotH, 0.5);
          const topPct = ((BASE - barH) / H) * 100;
          const isLatest = i === n - 1;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-full font-mono text-[9px] leading-none tabular-nums"
              style={{
                left: `${cxPct}%`,
                top: `${topPct}%`,
                color: isLatest ? "#fff" : "rgba(255,255,255,0.55)",
              }}
            >
              {d.value.toFixed(0)}
            </span>
          );
        })}
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

/** Stacked bar chart. Fills its parent. */
function StackedBarChart({
  data,
  paletteOverride,
  labelKey,
}: {
  data: {
    label: string;
    segments: { name: string; value: number }[];
    total: number;
  }[];
  /** Override the default color palette (e.g. for sector charts). */
  paletteOverride?: Record<string, string>;
  /** Which segment name gets the inline value label (default: 中国). */
  labelKey?: string;
}) {
  if (data.length === 0) return null;
  const n = data.length;
  const W = 100;
  const H = 100;
  const PAD = 2;
  const slot = (W - 2 * PAD) / n;
  const barW = Math.max(slot - 1, 1);
  const labelName = labelKey ?? "中国";

  // Compute the max total for scaling.
  const maxTotal = Math.max(...data.map((d) => d.total));
  // Scale factor: value → SVG units. Leave 12 units of headroom for labels.
  const scale = (H - 20) / (maxTotal || 1);

  const defaultPalette: Record<string, string> = {
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
    建設: "#38bdf8",
    自動車: "#fbbf24",
    機械: "#a78bfa",
    船舶: "#f472b6",
    輸出: "#34d399",
    その他: "#64748b",
  };
  const palette: Record<string, string> = {
    ...defaultPalette,
    ...paletteOverride,
  };

  // Pre-compute bar geometry for HTML label overlay.
  const bars = data.map((d, i) => {
    const cx = PAD + i * slot + slot / 2; // center x in SVG units
    const x = PAD + i * slot + (slot - barW) / 2;
    let yCursor = H - 8;
    let labelTopY = 0;
    let labelH = 0;
    for (const seg of d.segments) {
      const segH = seg.value * scale;
      const y = yCursor - segH;
      if (seg.name === labelName) {
        labelTopY = y;
        labelH = segH;
      }
      yCursor = y;
    }
    return {
      cx,
      x,
      topY: yCursor, // top of the bar
      labelTopY,
      labelH,
      total: d.total,
      labelValue: d.segments.find((s) => s.name === labelName)?.value ?? 0,
    };
  });

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Chart area (relative for label overlay). */}
      <div className="relative min-h-0 flex-1">
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
            const b = bars[i];
            return (
              <g key={i}>
                {d.segments.map((seg, si) => {
                  // Recompute y for this segment (same logic as bars pre-compute).
                  let yC = H - 8;
                  let segY = 0;
                  let segH = 0;
                  for (const s of d.segments) {
                    const sh = s.value * scale;
                    const y = yC - sh;
                    if (s === seg) {
                      segY = y;
                      segH = sh;
                    }
                    yC = y;
                  }
                  const isLatest = i === n - 1;
                  const fill = palette[seg.name] ?? "#94a3b8";
                  return (
                    <rect
                      key={si}
                      x={b.x}
                      y={segY}
                      width={barW}
                      height={Math.max(segH, 0.3)}
                      fill={isLatest ? fill : fill + "66"}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* HTML overlay labels (not distorted by preserveAspectRatio="none"). */}
        {bars.map((b, i) => {
          // Convert SVG coords to percentages for absolute positioning.
          const cxPct = (b.cx / W) * 100;
          const topPct = (b.topY / H) * 100;
          const isLatest = i === n - 1;
          return (
            <div key={i}>
              {/* Total: above the bar. */}
              <span
                className="absolute -translate-x-1/2 -translate-y-full font-mono text-[9px] leading-none tabular-nums"
                style={{
                  left: `${cxPct}%`,
                  top: `${topPct}%`,
                  color: isLatest ? "#fff" : "rgba(255,255,255,0.55)",
                }}
              >
                {b.total.toFixed(0)}
              </span>
              {/* Label segment value: centered on the segment (red for 中国). */}
              {b.labelH > 4 && (
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[8px] font-bold leading-none tabular-nums"
                  style={{
                    left: `${cxPct}%`,
                    top: `${((b.labelTopY + b.labelH / 2) / H) * 100}%`,
                    color: labelName === "中国" ? "#fca5a5" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {b.labelValue.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
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

/** Column header (粗鋼生産 / 普通鋼需給 / 受注量). */
function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-sm font-bold text-white/90">{children}</p>
  );
}

/**
 * Big latest-value row: value + unit on the left, an optional change badge
 * (前年比 / 前月比) on the right. Placed directly under the panel subtitle so
 * the number is always the most legible element of the panel.
 */
function ValueRow({
  value,
  unit,
  change,
  changeLabel,
  period,
}: {
  value: string;
  unit: string;
  change?: number | null;
  changeLabel?: string;
  period?: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="flex shrink-0 items-baseline gap-2">
      {/* Big number + unit (primary). */}
      <span className="font-mono text-xl font-bold leading-none tabular-nums text-white">
        {value}
        <span className="ml-1 text-[11px] font-medium text-white/45">{unit}</span>
      </span>
      {/* Period, close to the number. */}
      {period && (
        <span className="font-mono text-[10px] tabular-nums text-white/45">
          {period}
        </span>
      )}
      {/* Change badge, tucked right next to the period. */}
      {change !== undefined && change !== null && (
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${
            up ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <span className="text-[9px]">{up ? "▲" : "▼"}</span>
          {Math.abs(change).toFixed(1)}%
          <span className="ml-0.5 font-sans text-[9px] font-normal text-white/35">
            {changeLabel}
          </span>
        </span>
      )}
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

  // Year-over-year for the latest order month (needs the same month 12 months back).
  const orderYoy = (() => {
    if (!orderLatest) return null;
    const sameMonth = orders.find(
      (o) => o.year === orderLatest.year - 1 && o.month === orderLatest.month,
    );
    if (!sameMonth || sameMonth.total <= 0) return null;
    return ((orderLatest.total - sameMonth.total) / sameMonth.total) * 100;
  })();

  // Month-over-month change (%) for the latest vs previous trend entry.
  function sdMom(
    key: "carbonSteel" | "shipmentsTotal" | "inventory",
  ): number | null {
    if (sdTrend.length < 2) return null;
    const cur = sdTrend[sdTrend.length - 1][key];
    const prev = sdTrend[sdTrend.length - 2][key];
    if (!prev || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
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
              {/* Column 1: 粗鋼生産 (Japan + World production). */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>粗鋼生産</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-2 gap-2">
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="shrink-0 text-xs font-semibold text-white/80">
                      日本の粗鋼生産
                    </p>
                    {data.production.length > 0 && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(data.production[data.production.length - 1].crudeSteel).toString()}
                          unit="万トン"
                          change={data.production[data.production.length - 1].yoy}
                          changeLabel="前年比"
                          period={`${data.production[data.production.length - 1].year}年${data.production[data.production.length - 1].month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={data.production.map((p) => ({
                          label: `${p.month}月`,
                          value: p.crudeSteel,
                        }))}
                        color="#38bdf8"
                      />
                    </div>
                  </Panel>

                  <Panel className="flex flex-col overflow-hidden">
                    <p className="shrink-0 text-xs font-semibold text-white/80">
                      世界の粗鋼生産（国・地域別）
                    </p>
                    {data.worldSteel.length > 0 && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(data.worldSteel[data.worldSteel.length - 1].worldCrudeSteel * 100).toLocaleString("ja-JP")}
                          unit="万トン"
                          change={data.worldSteel[data.worldSteel.length - 1].yoy}
                          changeLabel="前年比"
                          period={`${data.worldSteel[data.worldSteel.length - 1].year}年${data.worldSteel[data.worldSteel.length - 1].month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      <StackedBarChart
                        data={data.worldSteel.map((w) => ({
                          label: `${w.month}月`,
                          // Convert Mt → 万トン (×100) for display.
                          segments: w.byCountry.map((s) => ({
                            ...s,
                            value: s.value * 100,
                          })),
                          total: w.worldCrudeSteel * 100,
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
                  </Panel>
                </div>
              </div>

              {/* Column 2: 普通鋼需給 (Carbon steel supply-demand). */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>普通鋼需給</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-3 gap-2">
                  {/* Production trend. */}
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="shrink-0 text-[11px] font-semibold text-white/80">
                      生産の月別
                    </p>
                    {sdTrend.length > 0 && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(sdTrend[sdTrend.length - 1].carbonSteel).toString()}
                          unit="万トン"
                          change={sdMom("carbonSteel")}
                          changeLabel="前月比"
                          period={`${sdTrend[sdTrend.length - 1].year}年${sdTrend[sdTrend.length - 1].month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.carbonSteel,
                        }))}
                        color="#a78bfa"
                      />
                    </div>
                  </Panel>

                  {/* Shipments trend. */}
                  <Panel className="flex flex-col overflow-hidden">
                    <p className="shrink-0 text-[11px] font-semibold text-white/80">
                      出荷量の月別
                    </p>
                    {sdTrend.length > 0 && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(sdTrend[sdTrend.length - 1].shipmentsTotal).toString()}
                          unit="万トン"
                          change={sdMom("shipmentsTotal")}
                          changeLabel="前月比"
                          period={`${sdTrend[sdTrend.length - 1].year}年${sdTrend[sdTrend.length - 1].month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.shipmentsTotal,
                        }))}
                        color="#f472b6"
                      />
                    </div>
                  </Panel>

                  {/* Inventory trend + inventory ratio (integrated). */}
                  <Panel className="flex flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center justify-between">
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
                    {sdTrend.length > 0 && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(sdTrend[sdTrend.length - 1].inventory).toString()}
                          unit="万トン"
                          change={sdMom("inventory")}
                          changeLabel="前月比"
                          period={`${sdTrend[sdTrend.length - 1].year}年${sdTrend[sdTrend.length - 1].month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      <BarChart
                        data={sdTrend.map((t) => ({
                          label: `${t.month}月`,
                          value: t.inventory,
                        }))}
                        color="#fbbf24"
                      />
                    </div>
                  </Panel>
                </div>
              </div>

              {/* Column 3: 受注量 (Orders) — stacked bar by sector. */}
              <div className="flex min-h-0 flex-col">
                <ColHeader>受注量</ColHeader>
                <div className="grid min-h-0 flex-1 grid-rows-3 gap-2">
                  {/* Stacked bar chart by sector (top, 2 rows). */}
                  <Panel className="row-span-2 flex flex-col overflow-hidden">
                    <p className="shrink-0 text-[11px] font-semibold text-white/80">
                      受注量合計
                    </p>
                    {orderLatest && (
                      <div className="mt-0.5">
                        <ValueRow
                          value={Math.round(orderLatest.total).toString()}
                          unit="万トン"
                          change={orderYoy}
                          changeLabel="前年同月比"
                          period={`${orderLatest.year}年${orderLatest.month}月`}
                        />
                      </div>
                    )}
                    <div className="min-h-0 flex-1">
                      {(() => {
                        const mach = (o: OrderMonth) =>
                          (o.machinery ?? 0) +
                          (o.electrical ?? 0) +
                          (o.railway ?? 0) +
                          (o.otherTransport ?? 0);
                        const chartData = orders.map((o) => {
                          const known =
                            (o.construction ?? 0) +
                            (o.automobiles ?? 0) +
                            mach(o) +
                            (o.ships ?? 0) +
                            (o.export ?? 0);
                          const other = Math.max(o.total - known, 0);
                          const segments: { name: string; value: number }[] = [
                            { name: "建設", value: o.construction ?? 0 },
                            { name: "自動車", value: o.automobiles ?? 0 },
                            { name: "機械", value: mach(o) },
                            { name: "船舶", value: o.ships ?? 0 },
                            { name: "輸出", value: o.export ?? 0 },
                          ];
                          if (other > 0.05) {
                            segments.push({ name: "その他", value: other });
                          }
                          return {
                            label: `${o.month}月`,
                            segments,
                            total: o.total,
                          };
                        });
                        return (
                          <StackedBarChart
                            data={chartData}
                            paletteOverride={{
                              建設: "#38bdf8",
                              自動車: "#fbbf24",
                              機械: "#a78bfa",
                              船舶: "#f472b6",
                              輸出: "#34d399",
                              その他: "#64748b",
                            }}
                          />
                        );
                      })()}
                    </div>
                    {/* Legend. */}
                    <div className="mt-1 flex shrink-0 flex-wrap gap-x-2 gap-y-0.5">
                      {(
                        [
                          ["建設", "#38bdf8"],
                          ["自動車", "#fbbf24"],
                          ["機械", "#a78bfa"],
                          ["船舶", "#f472b6"],
                          ["輸出", "#34d399"],
                          ["その他", "#64748b"],
                        ] as const
                      ).map(([name, color]) => (
                        <span
                          key={name}
                          className="flex items-center gap-0.5 text-[8px] text-white/50"
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                          {name}
                        </span>
                      ))}
                    </div>
                  </Panel>

                  {/* Orders table by sector (bottom, 1 row). */}
                  <Panel title="受注品目別" className="flex flex-col overflow-hidden">
                    <div className="min-h-0 flex-1">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-white/50">
                            <th className="pb-0.5 text-left font-normal">品目</th>
                            {orderPrevPrev && (
                              <th className="pb-0.5 text-right font-normal">
                                {orderPrevPrev.month}月
                              </th>
                            )}
                            {orderPrev && (
                              <th className="pb-0.5 text-right font-normal">
                                {orderPrev.month}月
                              </th>
                            )}
                            {orderLatest && (
                              <th className="pb-0.5 text-right font-normal text-sky-300">
                                {orderLatest.month}月
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const mach = (o?: OrderMonth) =>
                              (o?.machinery ?? 0) +
                              (o?.electrical ?? 0) +
                              (o?.railway ?? 0) +
                              (o?.otherTransport ?? 0);
                            const rows = [
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
                                  <td className="py-0.5 text-white/70">
                                    {r.label}
                                  </td>
                                  <td className="py-0.5 text-right font-mono tabular-nums text-white/50">
                                    {r.pp > 0 ? Math.round(r.pp).toString() : "-"}
                                  </td>
                                  <td className="py-0.5 text-right font-mono tabular-nums text-white/70">
                                    {r.pv > 0 ? Math.round(r.pv).toString() : "-"}
                                  </td>
                                  <td className="py-0.5 text-right font-mono tabular-nums">
                                    <span className="font-bold text-white">
                                      {r.lt > 0 ? Math.round(r.lt).toString() : "-"}
                                    </span>
                                    <span
                                      className={`ml-1 text-[9px] ${mom >= 0 ? "text-emerald-400" : "text-red-400"}`}
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
