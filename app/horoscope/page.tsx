"use client";

import { useEffect, useState, useCallback } from "react";
import { ZODIAC_SIGNS, type ZodiacKey } from "@/lib/zodiac";

interface HoroscopeData {
  ok: boolean;
  date?: string;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

/**
 * Element accent per sign (fire/earth/air/water). Used for the top accent bar,
 * the animal badge tint and the element tag on the dark morning-show cards.
 */
const ELEMENTS: Record<ZodiacKey, { label: string; accent: string; soft: string }> = {
  aries: { label: "火", accent: "#fb7185", soft: "rgba(244,63,94,0.16)" },
  taurus: { label: "地", accent: "#34d399", soft: "rgba(16,185,129,0.16)" },
  gemini: { label: "風", accent: "#fbbf24", soft: "rgba(245,158,11,0.16)" },
  cancer: { label: "水", accent: "#38bdf8", soft: "rgba(14,165,233,0.16)" },
  leo: { label: "火", accent: "#fb923c", soft: "rgba(249,115,22,0.16)" },
  virgo: { label: "地", accent: "#2dd4bf", soft: "rgba(20,184,166,0.16)" },
  libra: { label: "風", accent: "#facc15", soft: "rgba(234,179,8,0.16)" },
  scorpio: { label: "水", accent: "#818cf8", soft: "rgba(99,102,241,0.16)" },
  sagittarius: { label: "火", accent: "#fb923c", soft: "rgba(249,115,22,0.16)" },
  capricorn: { label: "地", accent: "#4ade80", soft: "rgba(34,197,94,0.16)" },
  aquarius: { label: "風", accent: "#facc15", soft: "rgba(234,179,8,0.16)" },
  pisces: { label: "水", accent: "#a78bfa", soft: "rgba(139,92,246,0.16)" },
};

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

  const horoscopes = data?.horoscopes;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Card entrance animation (staggered per sign). */}
      <style>{`
        @keyframes signIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* Base gradient matching the rest of the signage (dark slate). */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />
      {/* Warm sunrise glow (upper-right) - the "morning" accent. */}
      <div
        className="absolute -right-32 -top-32 h-[60vh] w-[60vh] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #fdba74 0%, #fb923c 45%, transparent 72%)" }}
      />

      {/* Header (morning-show title bar). */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl shadow-lg shadow-orange-900/40">
            🌅
          </span>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-white">
              朝会前のひととき
            </p>
            <p className="text-sm font-medium text-white/50">
              今日の運勢 · 12星座 · {data?.date ?? ""}
            </p>
          </div>
        </div>
        {clock && (
          <div className="text-right">
            <p className="font-mono text-3xl font-bold tabular-nums text-white">
              {clock.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-xs font-medium text-white/50">
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

      {/* Main: 4×3 grid of all 12 signs on a single screen. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
        {/* Error state. */}
        {error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-white/40">{error}</p>
          </div>
        )}

        {/* Loading state. */}
        {loading && !error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
              <p className="text-white/40">占いを読み込み中…</p>
            </div>
          </div>
        )}

        {/* 4 columns × 3 rows grid. */}
        {horoscopes && !loading && (
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-3.5">
            {ZODIAC_SIGNS.map((s, i) => {
              const el = ELEMENTS[s.key];
              return (
                <div
                  key={s.key}
                  className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm"
                  style={{ animation: `signIn 0.5s ease ${i * 40}ms both` }}
                >
                  {/* Element accent bar at the top. */}
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: el.accent }}
                  />
                  {/* Sign header: animal + name + date range + element badge. */}
                  <div className="mb-1.5 flex shrink-0 items-center gap-2.5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl leading-none"
                      style={{ backgroundColor: el.soft }}
                    >
                      {s.animal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-tight text-white">
                        {s.ja}
                      </p>
                      <p className="font-mono text-[10px] tabular-nums text-white/40">
                        {s.dateRange}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                      style={{ color: el.accent, backgroundColor: el.soft }}
                    >
                      {el.label}
                    </span>
                  </div>
                  {/* Horoscope comment (clamped to fit the cell). */}
                  <p className="min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-white/75">
                    {horoscopes[s.key]}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer: navigation. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-3">
        <a
          href="/"
          className="text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            毎朝 7:30 に更新 ·{" "}
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
            className="text-sm font-medium text-white/40 transition hover:text-white/70"
          >
            ⛅ 天気 →
          </a>
        </div>
      </footer>
    </div>
  );
}
