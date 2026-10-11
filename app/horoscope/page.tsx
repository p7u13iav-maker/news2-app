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
 * Element styling per sign. The card uses a soft radial gradient tinted by
 * the element color (fire/earth/air/water) so the 12-sign grid reads as a
 * set of glowing "stars" rather than flat boxes.
 */
const ELEMENTS: Record<
  ZodiacKey,
  { label: string; color: string; glow: string; ring: string }
> = {
  aries: { label: "火", color: "#fca5a5", glow: "rgba(239,68,68,0.30)", ring: "rgba(252,165,165,0.45)" },
  taurus: { label: "地", color: "#6ee7b7", glow: "rgba(16,185,129,0.30)", ring: "rgba(110,231,183,0.45)" },
  gemini: { label: "風", color: "#fcd34d", glow: "rgba(245,158,11,0.30)", ring: "rgba(252,211,77,0.45)" },
  cancer: { label: "水", color: "#7dd3fc", glow: "rgba(14,165,233,0.30)", ring: "rgba(125,211,252,0.45)" },
  leo: { label: "火", color: "#fdba74", glow: "rgba(249,115,22,0.30)", ring: "rgba(253,186,116,0.45)" },
  virgo: { label: "地", color: "#5eead4", glow: "rgba(20,184,166,0.30)", ring: "rgba(94,234,212,0.45)" },
  libra: { label: "風", color: "#fde047", glow: "rgba(234,179,8,0.30)", ring: "rgba(253,224,71,0.45)" },
  scorpio: { label: "水", color: "#93c5fd", glow: "rgba(59,130,246,0.30)", ring: "rgba(147,197,253,0.45)" },
  sagittarius: { label: "火", color: "#fdba74", glow: "rgba(249,115,22,0.30)", ring: "rgba(253,186,116,0.45)" },
  capricorn: { label: "地", color: "#86efac", glow: "rgba(34,197,94,0.30)", ring: "rgba(134,239,172,0.45)" },
  aquarius: { label: "風", color: "#fef08a", glow: "rgba(250,204,21,0.30)", ring: "rgba(254,240,138,0.45)" },
  pisces: { label: "水", color: "#a5b4fc", glow: "rgba(99,102,241,0.30)", ring: "rgba(165,180,252,0.45)" },
};

/** A small four-pointed star glyph used for decoration. */
const Star = ({
  className = "",
  color = "#fff",
  style,
}: {
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill={color} aria-hidden>
    <path d="M12 0c.6 6.5 4.9 10.8 12 12-7.1 1.2-11.4 5.5-12 12-.6-6.5-4.9-10.8-12-12C7.1 10.8 11.4 6.5 12 0z" />
  </svg>
);

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

  // A few decorative "stars" placed in the background (deterministic layout).
  const bgStars = [
    { top: "12%", left: "8%", size: 18, o: 0.5 },
    { top: "22%", left: "88%", size: 26, o: 0.4 },
    { top: "78%", left: "6%", size: 22, o: 0.35 },
    { top: "85%", left: "92%", size: 16, o: 0.5 },
    { top: "50%", left: "50%", size: 14, o: 0.25 },
    { top: "35%", left: "70%", size: 12, o: 0.3 },
  ];

  // Shooting star: a thin streak that sweeps across the background from the
  // upper-right toward the lower-left. (top/left = start point, dur = timing.)
  const shootingStars = [
    { top: "6%", left: "82%", dur: 10, delay: 0 },
  ];

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Card entrance + shooting-star animations. */}
      <style>{`
        @keyframes signIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Shooting star: a streak that fades in, sweeps from upper-right to
           lower-left, then fades out. rotate comes BEFORE translate so the
           element is oriented along the 45deg travel line while the translate
           axis stays screen-aligned (x to the left, y down). */
        @keyframes shoot {
          0%   { transform: rotate(45deg) translate(0, 0); opacity: 0; }
          12%  { opacity: 0; }
          30%  { opacity: 1; }
          75%  { opacity: 0.9; }
          100% { transform: rotate(45deg) translate(-500px, 500px); opacity: 0; }
        }
      `}</style>
      {/* Deep-space gradient background. */}
      <div
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #2e1065 0%, #1e1b4b 30%, #0f0a1e 60%, #020617 100%)",
        }}
      />
      {/* Soft nebula glows. */}
      <div
        className="absolute -left-40 -top-40 h-[55vh] w-[55vh] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[55vh] w-[55vh] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #db2777 0%, transparent 70%)" }}
      />
      {/* Scattered stars. */}
      {bgStars.map((s, i) => (
        <Star
          key={i}
          className="absolute"
          color="#fff"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.o }}
        />
      ))}
      {/* Shooting stars sweeping across the background. */}
      {shootingStars.map((s, i) => (
        <span
          key={"ss" + i}
          className="pointer-events-none absolute h-px w-40"
          style={
            {
              top: s.top,
              left: s.left,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 80%, #fff 100%)",
              boxShadow: "0 0 6px rgba(255,255,255,0.6)",
              animation: `shoot ${s.dur}s ease-in ${s.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-2xl shadow-[0_0_20px_rgba(168,85,247,0.35)]">
            ✨
          </span>
          <div>
            <p className="bg-gradient-to-r from-purple-200 via-pink-100 to-amber-100 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              朝会前のひととき
            </p>
            <p className="text-sm text-white/50">
              今日の運勢 · 12星座 · {data?.date ?? ""}
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
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-purple-400" />
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
                  className="group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-3.5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    borderColor: el.ring,
                    background: `radial-gradient(140% 120% at 0% 0%, ${el.glow} 0%, rgba(15,10,30,0.55) 55%, rgba(10,7,24,0.8) 100%)`,
                    animation: `signIn 0.5s ease ${i * 40}ms both`,
                  }}
                >
                  {/* Glow accent at the top edge. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${el.color}, transparent)`,
                    }}
                  />
                  {/* Sign header: symbol + name + date range + element badge. */}
                  <div className="mb-2 flex shrink-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none"
                      style={{
                        color: el.color,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        boxShadow: `0 0 14px ${el.glow}`,
                      }}
                    >
                      {s.symbol}
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
                      className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                      style={{
                        color: el.color,
                        borderColor: el.ring,
                        backgroundColor: "rgba(255,255,255,0.04)",
                      }}
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
          className="text-sm text-white/40 transition hover:text-white/70"
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
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ⛅ 天気 →
          </a>
        </div>
      </footer>
    </div>
  );
}
