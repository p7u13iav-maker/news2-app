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
  export: number;
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
  stocks: StockData[];
  comment: string[];
  error?: string;
}

function fmtDate(t: number): string {
  const d = new Date(t * 1000);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

/** Simple SVG sparkline (line). */
function Sparkline({
  values,
  up,
  height = 40,
}: {
  values: number[];
  up: boolean;
  height?: number;
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
  const stroke = up ? "#34d399" : "#f87171";
  const fill = up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";
  const lastY = H - PAD - ((H - 2 * PAD) * (values[n - 1] - min)) / range;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <path d={`${d} L${W - PAD},${H} L${PAD},${H} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={W - PAD} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

/** Monthly bar chart with HTML value labels on the latest bar. */
function BarChart({
  data,
  color = "#38bdf8",
  labelColor = "#38bdf8",
}: {
  data: { label: string; value: number }[];
  color?: string;
  labelColor?: string;
}) {
  if (data.length === 0) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals) * 0.95;
  const max = Math.max(...vals) * 1.05;
  const range = max - min || 1;
  const W = 100;
  const H = 100;
  const PAD = 2;
  const barW = (W - 2 * PAD) / data.length - 1.5;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "110px" }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const x = PAD + (i * (W - 2 * PAD)) / data.length + 0.5;
          const barH = ((d.value - min) / range) * (H - 18);
          const y = H - 14 - barH;
          const isLatest = i === data.length - 1;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={1.5}
              fill={isLatest ? color : color + "66"}
            />
          );
        })}
      </svg>
      {/* Month labels (HTML, evenly spaced). */}
      <div className="mt-0.5 flex justify-between px-0.5">
        {data.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[9px] text-white/40"
          >
            {i === 0 || i === data.length - 1 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A compact panel wrapper. */
function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-white/5 p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-bold">{title}</h2>
        {subtitle && (
          <span className="text-[10px] text-white/40">{subtitle}</span>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** Stat row: label + value + change. */
function StatRow({
  label,
  value,
  unit,
  change,
  changeLabel,
}: {
  label: string;
  value: string;
  unit: string;
  change?: number;
  changeLabel?: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-white/55">{label}</span>
      <span className="text-right">
        <span className="font-mono text-base font-semibold tabular-nums text-white/90">
          {value}
        </span>
        <span className="ml-0.5 text-[10px] text-white/40">{unit}</span>
        {change !== undefined && (
          <span
            className={`ml-1.5 text-[11px] tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
            {changeLabel && (
              <span className="ml-0.5 text-[9px] text-white/30">{changeLabel}</span>
            )}
          </span>
        )}
      </span>
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

  // Prepare orders chart data (total + key sectors).
  const orderTotal = orders.map((o) => o.total);
  const orderConstruction = orders.map((o) => o.construction);
  const orderAutomobiles = orders.map((o) => o.automobiles);
  const latestOrder = orders[orders.length - 1];
  const prevOrder = orders[orders.length - 2];
  const orderMom =
    prevOrder && latestOrder
      ? ((latestOrder.total - prevOrder.total) / prevOrder.total) * 100
      : 0;

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
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-8 py-3">
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
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
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
            <div className="shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed">
              <span className="mr-2">💬</span>
              <div className="flex flex-wrap gap-x-5 gap-y-0.5">
                {data.comment.map((line, i) => (
                  <p key={i} className="text-white/85">{line}</p>
                ))}
              </div>
            </div>

            {/* 4-column grid. */}
            <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
              {/* Column 1: Japan + World production. */}
              <div className="flex min-h-0 flex-col gap-3">
                <Panel icon="🇯🇵" title="日本粗鋼生産" subtitle="JISF">
                  {data.production.length > 0 && (
                    <div className="flex h-full flex-col">
                      <div className="flex-1">
                        <BarChart
                          data={data.production.map((p) => ({
                            label: `${p.month}月`,
                            value: p.crudeSteel,
                          }))}
                          color="#38bdf8"
                        />
                      </div>
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        {data.production.slice(-1).map((p) => (
                          <StatRow
                            key={p.month}
                            label={`${p.year}/${p.month}月`}
                            value={p.crudeSteel.toFixed(1)}
                            unit="万トン"
                            change={p.yoy}
                            changeLabel="前年比"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel icon="🌍" title="世界粗鋼生産" subtitle="worldsteel">
                  {data.worldSteel.length > 0 && (
                    <div className="flex h-full flex-col">
                      <div className="flex-1">
                        <BarChart
                          data={data.worldSteel.map((w) => ({
                            label: `${w.month}月`,
                            value: w.worldCrudeSteel,
                          }))}
                          color="#34d399"
                        />
                      </div>
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        {data.worldSteel.slice(-1).map((w) => (
                          <StatRow
                            key={w.month}
                            label={`${w.year}/${w.month}月`}
                            value={w.worldCrudeSteel.toFixed(1)}
                            unit="百万トン"
                            change={w.yoy}
                            changeLabel="前年比"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>
              </div>

              {/* Column 2: Supply-demand. */}
              <div className="flex min-h-0 flex-col">
                <Panel
                  icon="⚖️"
                  title="普通鋼鋼材需給"
                  subtitle={sd?.summary?.period ? sd.summary.period + " (JISF)" : "JISF"}
                >
                  {sd?.summary && (
                    <div className="flex h-full flex-col">
                      {/* Inventory ratio highlight. */}
                      <div className="mb-2 rounded-lg bg-white/5 p-2 text-center">
                        <p className="text-[10px] text-white/45">在庫率</p>
                        <p
                          className={`font-mono text-2xl font-bold tabular-nums ${
                            sd.summary.inventoryRatio >= 100
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {sd.summary.inventoryRatio.toFixed(1)}
                          <span className="text-sm">%</span>
                        </p>
                        <p className="text-[9px] text-white/35">
                          {sd.summary.inventoryRatio >= 100
                            ? "需給はやや逼迫"
                            : "需給はやや緩"}
                        </p>
                      </div>
                      {/* Shipments trend chart. */}
                      <div className="flex-1">
                        <BarChart
                          data={sdTrend.map((t) => ({
                            label: `${t.month}月`,
                            value: t.shipmentsTotal,
                          }))}
                          color="#a78bfa"
                        />
                      </div>
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        <StatRow
                          label="生産"
                          value={sd.summary.production.toFixed(1)}
                          unit="万トン"
                          change={sd.summary.productionMom}
                          changeLabel="前月比"
                        />
                        <StatRow
                          label="出荷"
                          value={sd.summary.shipments.toFixed(1)}
                          unit="万トン"
                        />
                        <StatRow
                          label="在庫"
                          value={sd.summary.inventory.toFixed(1)}
                          unit="万トン"
                        />
                      </div>
                    </div>
                  )}
                </Panel>
              </div>

              {/* Column 3: Orders by sector. */}
              <div className="flex min-h-0 flex-col">
                <Panel icon="📋" title="用途別受注" subtitle="普通鋼 (JISF)">
                  {orders.length > 0 && latestOrder && (
                    <div className="flex h-full flex-col">
                      {/* Total with MoM. */}
                      <div className="mb-2 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] text-white/45">
                            受注高 合計 ({latestOrder.year}/{latestOrder.month}月)
                          </p>
                          <p className="font-mono text-2xl font-bold tabular-nums text-white">
                            {latestOrder.total.toFixed(1)}
                            <span className="ml-0.5 text-xs font-normal text-white/40">
                              万トン
                            </span>
                          </p>
                        </div>
                        <span
                          className={`font-mono text-sm tabular-nums ${orderMom >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {orderMom >= 0 ? "+" : ""}
                          {orderMom.toFixed(1)}%
                          <span className="ml-0.5 text-[9px] text-white/30">前月比</span>
                        </span>
                      </div>
                      {/* Total trend sparkline. */}
                      <div className="mb-2 h-10">
                        <Sparkline
                          values={orderTotal}
                          up={orderTotal[orderTotal.length - 1] >= orderTotal[0]}
                        />
                      </div>
                      {/* Sector breakdown. */}
                      <div className="space-y-1 border-t border-white/10 pt-2">
                        <StatRow
                          label="建設用"
                          value={latestOrder.construction.toFixed(1)}
                          unit="万トン"
                          change={
                            prevOrder
                              ? ((latestOrder.construction - prevOrder.construction) /
                                  prevOrder.construction) *
                                  100
                              : 0
                          }
                          changeLabel="前月比"
                        />
                        <StatRow
                          label="自動車用"
                          value={latestOrder.automobiles.toFixed(1)}
                          unit="万トン"
                          change={
                            prevOrder
                              ? ((latestOrder.automobiles - prevOrder.automobiles) /
                                  prevOrder.automobiles) *
                                  100
                              : 0
                          }
                          changeLabel="前月比"
                        />
                        <StatRow
                          label="産業機械用"
                          value={latestOrder.machinery.toFixed(1)}
                          unit="万トン"
                          change={
                            prevOrder
                              ? ((latestOrder.machinery - prevOrder.machinery) /
                                  prevOrder.machinery) *
                                  100
                              : 0
                          }
                          changeLabel="前月比"
                        />
                        <StatRow
                          label="電気機械用"
                          value={latestOrder.electrical.toFixed(1)}
                          unit="万トン"
                        />
                        <StatRow
                          label="輸出"
                          value={latestOrder.export.toFixed(1)}
                          unit="万トン"
                        />
                      </div>
                    </div>
                  )}
                </Panel>
              </div>

              {/* Column 4: Related stocks. */}
              <div className="flex min-h-0 flex-col">
                <Panel icon="📈" title="関連銘柄" subtitle="1ヶ月">
                  <div className="flex h-full flex-col justify-around gap-1">
                    {data.stocks.map((s) => {
                      const up = s.diff >= 0;
                      const sign = up ? "+" : "";
                      return (
                        <div
                          key={s.key}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-white/60">
                              {s.label}
                            </p>
                            <p className="font-mono text-sm font-bold tabular-nums">
                              {s.ok
                                ? s.last.toLocaleString("ja-JP", {
                                    maximumFractionDigits: s.unit === "$" ? 2 : 0,
                                  })
                                : "-"}
                              <span className="ml-0.5 text-[9px] font-normal text-white/40">
                                {s.unit}
                              </span>
                            </p>
                          </div>
                          <div className="h-7 w-16 shrink-0">
                            {s.ok && s.points.length >= 2 ? (
                              <Sparkline
                                values={s.points.map((p) => p.v)}
                                up={up}
                                height={28}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[9px] text-white/30">
                                -
                              </div>
                            )}
                          </div>
                          <div className="w-14 shrink-0 text-right">
                            <p
                              className={`font-mono text-[11px] tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}
                            >
                              {s.ok
                                ? sign +
                                  s.diff.toLocaleString("ja-JP", {
                                    maximumFractionDigits: s.unit === "$" ? 2 : 0,
                                  })
                                : "-"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
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
