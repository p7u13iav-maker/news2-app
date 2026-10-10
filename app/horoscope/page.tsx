"use client";

import { useEffect, useState, useCallback } from "react";
import { ZODIAC_SIGNS, type ZodiacKey } from "@/lib/zodiac";

interface HoroscopeData {
  ok: boolean;
  date?: string;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

export default function HoroscopePage() {
  const [data, setData] = useState<HoroscopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchHoroscope = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "daily" }),
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || "Failed to fetch horoscope.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount (daily only, cached server-side for the day).
  useEffect(() => {
    fetchHoroscope();
  }, [fetchHoroscope]);

  const hoscopes = data?.horoscopes;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient. */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e1b4b 0%, #0f0a1e 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">
            ✨
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">
              12星座占い
            </p>
            <p className="text-xs text-white/50">
              今日の運勢 · AI翻訳 · {data?.date ?? ""}
            </p>
          </div>
        </div>
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
      </header>

      {/* Main: 2 cols × 6 rows grid. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-6 py-3">
        {/* Error state. */}
        {error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-white/40">{error}</p>
          </div>
        )}

        {/* Loading state. */}
        {loading && !error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-white/40">占いを読み込み中…</p>
          </div>
        )}

        {/* 12-sign grid: 2 cols × 6 rows. */}
        {hoscopes && !loading && (
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-6 gap-2">
            {ZODIAC_SIGNS.map((s) => (
              <div
                key={s.key}
                className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/5 px-4 py-2"
              >
                {/* Sign header: symbol + name + date range. */}
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-lg leading-none">{s.symbol}</span>
                  <span className="text-sm font-bold leading-tight">
                    {s.ja}
                  </span>
                  <span className="ml-auto text-[10px] text-white/40">
                    {s.dateRange}
                  </span>
                </div>
                {/* Horoscope text (no scroll, truncates if overflow). */}
                <p className="min-h-0 flex-1 overflow-hidden text-xs leading-snug text-white/80">
                  {hoscopes[s.key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer: navigation. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-2">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <span className="text-xs text-white/30">
          毎朝 6:30 に更新 · 出典: freehoroscopeapi.com
        </span>
      </footer>
    </div>
  );
}
