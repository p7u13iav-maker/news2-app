"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Article } from "@/lib/newsApi";
import MarketSparklines from "@/components/MarketSparklines";
import {
  WeatherSlide,
  skyGradient,
  type WeatherData,
  type TideData,
} from "@/components/WeatherSlide";
import SteelSlide, { type SteelData } from "@/components/SteelSlide";
import { ZODIAC_SIGNS, type ZodiacKey } from "@/lib/zodiac";

/** Per-kind slide durations (ms). */
const SLIDE_DURATIONS: Record<SlideKind, number> = {
  steel: 15_000,
  market: 10_000,
  weather: 10_000,
  news: 10_000,
  horoscope: 10_000,
};

function slideDuration(kind: SlideKind): number {
  return SLIDE_DURATIONS[kind];
}

/* ---------- Types ---------- */

interface HoroscopeData {
  ok: boolean;
  date?: string;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

/* ---------- Horoscope (astro) styling ---------- */

/** Element per sign: fire / earth / air / water (shared with /horoscope). */
const HORO_ELEMENTS: Record<
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

/** Sunrise gradient for the horoscope slide (same as /horoscope). */
const HORO_BG =
  "radial-gradient(130% 120% at 82% 8%, #fdba74 0%, #f9a8d4 26%, #c4b5fd 52%, #6d28d9 82%, #4c1d95 100%)";

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

/* ---------- Slide definitions ---------- */

type SlideKind = "steel" | "market" | "weather" | "news" | "horoscope";

interface SlideDef {
  kind: SlideKind;
  /** For news: the article index. For horoscope: the group index (0-2). */
  sub?: number;
}

/**
 * Build the slide sequence:
 *   1 steel, 1 market, 1 weather, N news, 1 horoscope (all 12 signs)
 */
function buildSlides(newsCount: number): SlideDef[] {
  const slides: SlideDef[] = [];
  slides.push({ kind: "steel" });
  slides.push({ kind: "market" });
  slides.push({ kind: "weather" });
  for (let i = 0; i < newsCount; i++) slides.push({ kind: "news", sub: i });
  slides.push({ kind: "horoscope" });
  return slides;
}

/* ---------- Sub-components ---------- */

function NewsSlide({ article, index }: { article: Article; index: number }) {
  const time = new Date(article.publishedAt);
  return (
    <div className="flex items-center gap-12">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-full bg-white/10 px-3.5 py-1 text-base font-semibold backdrop-blur">
            {article.source}
          </span>
          <span className="text-sm text-white/50">
            {time.toLocaleDateString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          {article.title}
        </h1>
        {article.description && (
          <div className="relative pl-5">
            <span
              aria-hidden
              className="absolute left-0 top-0.5 h-[95%] w-1 rounded-full bg-gradient-to-b from-white/70 to-white/10"
            />
            <p className="line-clamp-8 text-xl leading-relaxed text-white/80 md:text-2xl">
              {article.description}
            </p>
          </div>
        )}
      </div>
      {article.urlToImage && (
        <div className="hidden h-[52vh] w-[34vw] shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:block">
          <img
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

/** All 12 signs on one screen (4×3 grid), matching the /horoscope page. */
function HoroscopeSlide({ data }: { data: HoroscopeData | null }) {
  if (!data?.horoscopes) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl text-white/40">占いを読み込み中…</p>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      {/* Deep-space background + nebula glows. */}
      <div
        className="absolute inset-0"
        style={{ background: HORO_BG }}
      />
      <div
        className="absolute -left-40 -top-40 h-[55vh] w-[55vh] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[60vh] w-[60vh] rounded-full opacity-35 blur-3xl"
        style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }}
      />
      {/* Card entrance + shooting-star animations. */}
      <style>{`
        @keyframes hSignIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hShoot {
          0%   { transform: translate(0, 0) rotate(45deg); opacity: 0; }
          12%  { opacity: 0; }
          30%  { opacity: 1; }
          75%  { opacity: 0.9; }
          100% { transform: translate(500px, 500px) rotate(45deg); opacity: 0; }
        }
      `}</style>
      {/* Shooting star (upper-left -> lower-right). */}
      <span
        className="pointer-events-none absolute h-px w-40"
        style={
          {
            top: "6%",
            left: "10%",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 80%, #fff 100%)",
            boxShadow: "0 0 6px rgba(255,255,255,0.6)",
            animation: "hShoot 10s ease-in 0s infinite",
          } as React.CSSProperties
        }
      />
      {/* 4 columns × 3 rows grid of all 12 signs. */}
      <div className="relative z-10 grid h-full w-full grid-cols-4 grid-rows-3 gap-3">
        {ZODIAC_SIGNS.map((s, i) => {
          const el = HORO_ELEMENTS[s.key];
          return (
            <div
              key={s.key}
              className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-3 backdrop-blur-sm"
              style={{
                borderColor: el.ring,
                background: `radial-gradient(140% 120% at 0% 0%, ${el.glow} 0%, rgba(15,10,30,0.55) 55%, rgba(10,7,24,0.8) 100%)`,
                animation: `hSignIn 0.5s ease ${i * 40}ms both`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${el.color}, transparent)`,
                }}
              />
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
              <p className="min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-white/75">
                {data.horoscopes![s.key]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export default function UnifiedSignage({
  articles,
  newsCount = 8,
}: {
  articles: Article[];
  newsCount?: number;
}) {
  const slides = buildSlides(newsCount);
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);
  const indexRef = useRef(0);
  indexRef.current = index;

  // Data fetching (client-side, cached server-side for the day).
  const [horoscopeData, setHoroscopeData] = useState<HoroscopeData | null>(null);
  const [steelData, setSteelData] = useState<SteelData | null>(null);
  const [steelLoading, setSteelLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [tideData, setTideData] = useState<TideData | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch horoscope on mount (server caches for the day). The first cycle
  // reaches the horoscope slides after ~2 min, so fetch eagerly — a delay
  // would leave them stuck on "読み込み中…" for the whole first pass.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "daily" }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setHoroscopeData(json);
      })
      .catch(() => {
        if (!cancelled)
          setHoroscopeData({ ok: false, error: "fetch failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch steel + weather on mount (parallel; server caches for the day).
  useEffect(() => {
    let cancelled = false;
    // Steel
    fetch("/api/steel")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.ok) setSteelData(j); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSteelLoading(false); });
    // Weather
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.ok && j.weather) { setWeatherData(j.weather); setTideData(j.tide ?? null); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Drive the slide + progress animation.
  useEffect(() => {
    if (total === 0) return;
    start.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start.current;
      const dur = slideDuration(slides[indexRef.current].kind);
      const pct = Math.min(100, (elapsed / dur) * 100);
      setProgress(pct);
      if (elapsed >= dur) {
        start.current = now;
        setProgress(0);
        setIndex((i) => (i + 1) % total);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [total]);

  if (articles.length === 0) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <p className="text-2xl">ニュースを取得中です…</p>
          <p className="mt-3 text-lg">しばらくしてから再読み込みしてください。</p>
        </div>
      </div>
    );
  }

  const current = slides[index];

  // Whole-signage background: on the weather slide it adopts the
  // weather-dependent gradient (same as /weather) so the full screen shifts
  // with the weather; every other slide keeps the neutral slate gradient.
  const signageBackground =
    current.kind === "weather" && weatherData
      ? skyGradient(weatherData.current.weatherCode)
      : "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)";

  // Section label shown as a small badge (title is unified across pages).
  const sectionLabel =
    current.kind === "steel"
      ? "🏭 鉄鋼業インデックス"
      : current.kind === "market"
        ? "📊 市場データ"
        : current.kind === "weather"
          ? "⛅ 倉敷の天気"
          : current.kind === "news"
            ? "📰 ニューストピック"
            : "✨ 今日の運勢";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-950 text-white">
      {/* Background gradient. On the weather slide the weather-dependent
          sky gradient (same as /weather) extends across the whole screen. */}
      <div
        className="absolute inset-0 opacity-90 transition-all duration-1000"
        style={{ background: signageBackground }}
      />
      {/* Accent glow that shifts hue per slide. */}
      <div
        className="absolute -right-40 -top-40 h-[60vh] w-[60vh] rounded-full opacity-20 blur-3xl transition-all duration-1000"
        style={{
          background: `hsl(${(index * 28) % 360} 70% 55%)`,
        }}
      />

      {/* Header. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            ☀️
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              朝会前のひととき
            </p>
            <p className="text-sm text-white/50">
              <span className="text-white/60">{sectionLabel}</span>
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
        </div>
      </header>

      {/* Slide content. Keyed by index so the whole block re-mounts. */}
      <main
        key={index}
        className="relative z-10 flex h-full min-h-0 flex-col px-14 pb-16 pt-24"
      >
        <div className="slide-enter h-full min-h-0 w-full">
          {current.kind === "steel" &&
            (steelData ? (
              <SteelSlide data={steelData} loading={steelLoading} embedded />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-xl text-white/40">鉄鋼データを取得中…</p>
              </div>
            ))}

          {current.kind === "weather" &&
            (weatherData ? (
              <WeatherSlide data={weatherData} tide={tideData} embedded />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-xl text-white/40">天気を取得中…</p>
              </div>
            ))}

          {current.kind === "market" && <MarketSparklines size="large" />}

          {current.kind === "news" && current.sub != null && (
            <NewsSlide
              article={articles[current.sub]}
              index={current.sub}
            />
          )}

          {current.kind === "horoscope" && (
            <HoroscopeSlide data={horoscopeData} />
          )}
        </div>
      </main>

      {/* Footer: slide dots + progress bar (same width).
          11 slides: 10×0.4rem (inactive) + 1×1.2rem (active) + 10×0.4rem gaps
          = 4rem + 1.2rem + 4rem = 9.2rem fixed width, so the progress bar
          below it can use the exact same width without jittering. */}
      <footer className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex items-center gap-3">
          {/* Dots + progress bar (fixed 9.2rem width, aligned). */}
          <div
            className="flex flex-col items-stretch gap-2"
            style={{ width: "9.2rem" }}
          >
            {/* Dots row (fixed width). */}
            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: i === index ? "1.2rem" : "0.4rem",
                    background:
                      i === index
                        ? "#fff"
                        : s.kind === current.kind
                          ? "rgba(255,255,255,0.4)"
                          : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
            {/* Progress bar — same fixed width as the dots row. */}
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white/60"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {/* Page number, right of the dots. */}
          <span className="text-sm tabular-nums text-white/40">
            {index + 1} / {total}
          </span>
        </div>
      </footer>
    </div>
  );
}
