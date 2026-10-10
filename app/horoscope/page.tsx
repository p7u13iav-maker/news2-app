"use client";

import { useEffect, useState, useCallback } from "react";
import { ZODIAC_SIGNS, type Period, type ZodiacKey } from "@/lib/zodiac";

interface HoroscopeData {
  ok: boolean;
  date?: string;
  period?: Period;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "今日" },
  { key: "weekly", label: "今週" },
  { key: "monthly", label: "今月" },
];

export default function HoroscopePage() {
  const [period, setPeriod] = useState<Period>("daily");
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

  const fetchHoroscope = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: p }),
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

  // Fetch on mount + when period changes.
  useEffect(() => {
    fetchHoroscope(period);
  }, [period, fetchHoroscope]);

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
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            ✨
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              12星座占い
            </p>
            <p className="text-sm text-white/50">
              {period === "daily"
                ? "今日の運勢"
                : period === "weekly"
                  ? "今週の運勢"
                  : "今月の運勢"}{" "}
              · AI翻訳
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Period tabs. */}
          <div className="flex gap-1 rounded-full bg-white/5 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  period === p.key
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {p.label}
              </button>
            ))}
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
        </div>
      </header>

      {/* Main: 12-sign grid (4 cols × 3 rows). */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
        {/* Date line. */}
        {hoscopes && (
          <p className="mb-3 text-center text-sm text-white/40">
            更新日: {data?.date} · 出典: freehoroscopeapi.com
          </p>
        )}

        {/* Error state. */}
        {error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-white/40">{error}</p>
          </div>
        )}

        {/* Loading state. */}
        {loading && !error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-white/40">占いを読み込み中…</p>
          </div>
        )}

        {/* 12-sign grid. */}
        {hoscopes && !loading && (
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-3">
            {ZODIAC_SIGNS.map((s) => (
              <div
                key={s.key}
                className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{s.symbol}</span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold leading-tight">
                      {s.ja}
                    </p>
                    <p className="text-[10px] text-white/40">{s.dateRange}</p>
                  </div>
                </div>
                <p className="min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed text-white/80">
                  {hoscopes[s.key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer: navigation. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-3">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <span className="text-xs text-white/30">
          毎朝 6:30 に更新 · AI: Gemini
        </span>
      </footer>
    </div>
  );
}
