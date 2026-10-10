"use client";

import { useEffect, useState, useCallback } from "react";
import MarketSparklines from "@/components/MarketSparklines";

/**
 * Dedicated market-data signage page.
 *
 * Shows the 3-month sparklines (yields / US stocks / JP stocks) full-screen
 * with a large layout, a live clock, and auto-refresh every 60s. No AI
 * summarization involved, so it works even while Gemini is rate-limited.
 */
const REFRESH_MS = 60_000;

export default function MarketPage() {
  const [clock, setClock] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh market data every 60s.
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient. */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            📊
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">市場データ</p>
            <p className="text-sm text-white/50">
              金利 / 米国株 / 日本株 · 3ヶ月の推移
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
          <button
            onClick={refresh}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
          >
            更新
          </button>
        </div>
      </header>

      {/* Market data, full screen, no scroll. */}
      <main className="relative z-10 flex min-h-0 flex-1 items-stretch p-8">
        <div className="w-full">
          <MarketSparklines key={refreshKey} size="large" />
        </div>
      </main>

      {/* Footer: back to main page. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-4">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            60秒ごとに自動更新 · 出典: Yahoo Finance
          </span>
          <a
            href="/horoscope"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ✨ 12星座占い →
          </a>
        </div>
      </footer>
    </div>
  );
}
