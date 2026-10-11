"use client";

import { useEffect, useState, useCallback } from "react";
import { ZODIAC_SIGNS, type ZodiacKey } from "@/lib/zodiac";

interface HoroscopeData {
  ok: boolean;
  date?: string;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

const SLIDE_MS = 10_000;

/** Split 12 signs into 3 groups of 4. */
const GROUPS = [
  ZODIAC_SIGNS.slice(0, 4), // Aries - Cancer
  ZODIAC_SIGNS.slice(4, 8), // Leo - Scorpio
  ZODIAC_SIGNS.slice(8, 12), // Sagittarius - Pisces
];

const GROUP_LABELS = ["前半 (牡羊〜蟹)", "中盤 (獅子〜蠍)", "後半 (射手〜魚)"];

export default function HoroscopePage() {
  const [data, setData] = useState<HoroscopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);
  const [slide, setSlide] = useState(0);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-advance slide every 10s (3 pages = 30s full cycle).
  useEffect(() => {
    const id = setInterval(
      () => setSlide((s) => (s + 1) % GROUPS.length),
      SLIDE_MS,
    );
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
  const currentGroup = GROUPS[slide];

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
            ☀️
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              製銑部 朝会前のひととき
            </p>
            <p className="text-sm text-white/50">
              今日の運勢 · 12星座 · {data?.date ?? ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Slide indicator (3 dots). */}
          <div className="flex items-center gap-1.5">
            {GROUPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={"page " + (i + 1)}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  slide === i ? "bg-white/80" : "bg-white/20"
                }`}
              />
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

      {/* Main: vertical list of 6 signs, comment on the right. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
        {/* Group label. */}
        {hoscopes && !loading && (
          <p className="mb-3 text-center text-sm text-white/40">
            {GROUP_LABELS[slide]} · {slide + 1}/3
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

        {/* Vertical list: 4 signs, sign name left, comment right.
            Only 4 rows so each gets ample height — full comment fits
            without scrolling on a 1080p signage display. */}
        {hoscopes && !loading && (
          <div key={slide} className="flex min-h-0 flex-1 flex-col gap-3">
            {currentGroup.map((s) => (
              <div
                key={s.key}
                className="flex min-h-0 flex-1 items-center gap-5 rounded-xl border border-white/10 bg-white/5 px-6 py-3"
              >
                {/* Sign: symbol + name + date range. */}
                <div className="flex w-[220px] shrink-0 items-center gap-3">
                  <span className="text-4xl leading-none">{s.symbol}</span>
                  <div>
                    <p className="text-xl font-bold leading-tight">{s.ja}</p>
                    <p className="text-xs text-white/40">{s.dateRange}</p>
                  </div>
                </div>
                {/* Horoscope comment (fills remaining width).
                    leading-snug + text-base so ~150 chars fits 2-3 lines
                    in the available height. */}
                <p className="min-h-0 flex-1 text-base leading-snug text-white/85">
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
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            毎朝 6:30 に更新 ·{" "}
            <a
              href="https://sigastra.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 underline decoration-white/30 transition hover:text-white/70"
            >
              Powered by Sigastra
            </a>
          </span>
          <a
            href="/weather"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ⛅ 天気 →
          </a>
        </div>
      </footer>
    </div>
  );
}
