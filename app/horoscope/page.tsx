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
 * the animal badge ring and the element tag on the bright morning-show cards.
 */
const ELEMENTS: Record<ZodiacKey, { label: string; accent: string; soft: string }> = {
  aries: { label: "火", accent: "#f43f5e", soft: "#ffe4e6" },
  taurus: { label: "地", accent: "#10b981", soft: "#d1fae5" },
  gemini: { label: "風", accent: "#f59e0b", soft: "#fef3c7" },
  cancer: { label: "水", accent: "#0ea5e9", soft: "#e0f2fe" },
  leo: { label: "火", accent: "#f97316", soft: "#ffedd5" },
  virgo: { label: "地", accent: "#14b8a6", soft: "#ccfbf1" },
  libra: { label: "風", accent: "#eab308", soft: "#fef9c3" },
  scorpio: { label: "水", accent: "#6366f1", soft: "#e0e7ff" },
  sagittarius: { label: "火", accent: "#f97316", soft: "#ffedd5" },
  capricorn: { label: "地", accent: "#22c55e", soft: "#dcfce7" },
  aquarius: { label: "風", accent: "#eab308", soft: "#fef9c3" },
  pisces: { label: "水", accent: "#8b5cf6", soft: "#ede9fe" },
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
    <div className="relative flex h-dvh flex-col overflow-hidden bg-sky-100 text-slate-800">
      {/* Card entrance animation (staggered per sign). */}
      <style>{`
        @keyframes signIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* Bright morning sky: sunlight glow (upper-right) + soft sky wash. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #fef9c3 0%, #e0f2fe 45%, #dbeafe 100%)",
        }}
      />
      {/* Sunrise glow. */}
      <div
        className="absolute -right-32 -top-32 h-[60vh] w-[60vh] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, #fde68a 0%, #fdba74 40%, transparent 70%)" }}
      />
      {/* Faint sun. */}
      <div
        className="absolute right-24 top-10 h-24 w-24 rounded-full"
        style={{ background: "radial-gradient(circle, #fff7cc 0%, #fde047 60%, transparent 72%)", opacity: 0.8 }}
      />

      {/* Header (morning-show title bar). */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/60 bg-white/50 px-10 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-2xl shadow-lg shadow-orange-200/60">
            🌅
          </span>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-slate-800">
              朝会前のひととき
            </p>
            <p className="text-sm font-medium text-slate-500">
              今日の運勢 · 12星座 · {data?.date ?? ""}
            </p>
          </div>
        </div>
        {clock && (
          <div className="text-right">
            <p className="font-mono text-3xl font-bold tabular-nums text-slate-800">
              {clock.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-xs font-medium text-slate-500">
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
            <p className="text-slate-500">{error}</p>
          </div>
        )}

        {/* Loading state. */}
        {loading && !error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-orange-400" />
              <p className="text-slate-500">占いを読み込み中…</p>
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
                  className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm"
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
                      <p className="truncate text-[15px] font-bold leading-tight text-slate-800">
                        {s.ja}
                      </p>
                      <p className="font-mono text-[10px] tabular-nums text-slate-400">
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
                  <p className="min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-slate-600">
                    {horoscopes[s.key]}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer: navigation. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/60 bg-white/50 px-10 py-3 backdrop-blur-md">
        <a
          href="/"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">
            毎朝 7:30 に更新 ·{" "}
            <a
              href="https://sigastra.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 underline decoration-slate-300 transition hover:text-slate-700"
            >
              Powered by Sigastra
            </a>
          </span>
          <a
            href="/weather"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            ⛅ 天気 →
          </a>
        </div>
      </footer>
    </div>
  );
}
