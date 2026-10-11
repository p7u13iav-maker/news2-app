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

/** Element accent per sign (morning-show palette, shared with /horoscope). */
const HORO_ELEMENTS: Record<
  ZodiacKey,
  { label: string; accent: string; soft: string }
> = {
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

/** Bright morning sky for the horoscope slide (same as /horoscope). */
const HORO_BG = "linear-gradient(160deg, #fef9c3 0%, #e0f2fe 45%, #dbeafe 100%)";

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
      {/* Bright morning-sky background (same as /horoscope). */}
      <div className="absolute inset-0" style={{ background: HORO_BG }} />
      {/* Sunrise glow. */}
      <div
        className="absolute -right-32 -top-32 h-[60vh] w-[60vh] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, #fde68a 0%, #fdba74 40%, transparent 70%)" }}
      />
      {/* Card entrance animation (staggered per sign). */}
      <style>{`
        @keyframes hSignIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* 4 columns × 3 rows grid of all 12 signs. */}
      <div className="relative z-10 grid h-full w-full grid-cols-4 grid-rows-3 gap-3">
        {ZODIAC_SIGNS.map((s, i) => {
          const el = HORO_ELEMENTS[s.key];
          return (
            <div
              key={s.key}
              className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm shadow-slate-200/50"
              style={{ animation: `hSignIn 0.5s ease ${i * 40}ms both` }}
            >
              {/* Element accent bar at the top. */}
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: el.accent }} />
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
              <p className="min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-slate-600">
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

  // Whole-signage background: weather slide adopts the weather-dependent sky
  // gradient; the horoscope slide uses the bright morning sky; every other
  // slide (steel/market/news) keeps the dark slate gradient that matches the
  // steel page, so the steel slide blends seamlessly.
  const isHoro = current.kind === "horoscope";
  const signageBackground =
    current.kind === "weather" && weatherData
      ? skyGradient(weatherData.current.weatherCode)
      : isHoro
        ? HORO_BG
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
      {/* Accent glow that shifts hue per slide (hidden on the light
          horoscope slide, which has its own sunrise glow). */}
      {!isHoro && (
        <div
          className="absolute -right-40 -top-40 h-[60vh] w-[60vh] rounded-full opacity-20 blur-3xl transition-all duration-1000"
          style={{
            background: `hsl(${(index * 28) % 360} 70% 55%)`,
          }}
        />
      )}

      {/* Header. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl ${
              isHoro
                ? "bg-gradient-to-br from-amber-300 to-orange-400 shadow-lg shadow-orange-200/60"
                : "bg-white/10"
            }`}
          >
            {isHoro ? "🌅" : "☀️"}
          </span>
          <div>
            <p
              className={`text-2xl font-bold tracking-tight ${
                isHoro ? "text-slate-800" : "text-white"
              }`}
            >
              朝会前のひととき
            </p>
            <p className={`text-sm ${isHoro ? "text-slate-500" : "text-white/50"}`}>
              <span className={isHoro ? "text-slate-600" : "text-white/60"}>
                {sectionLabel}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {clock && (
            <div className="text-right">
              <p
                className={`font-mono text-3xl font-light tabular-nums ${
                  isHoro ? "text-slate-800" : "text-white"
                }`}
              >
                {clock.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className={`text-xs ${isHoro ? "text-slate-500" : "text-white/50"}`}>
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
                    background: isHoro
                      ? i === index
                        ? "#f97316"
                        : "rgba(15,23,42,0.30)"
                      : i === index
                        ? "#fff"
                        : s.kind === current.kind
                          ? "rgba(255,255,255,0.4)"
                          : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
            {/* Progress bar — same fixed width as the dots row. */}
            <div
              className={`h-1 overflow-hidden rounded-full ${
                isHoro ? "bg-slate-900/10" : "bg-white/10"
              }`}
            >
              <div
                className={`h-full ${isHoro ? "bg-orange-400" : "bg-white/60"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {/* Page number, right of the dots. */}
          <span
            className={`text-sm tabular-nums ${isHoro ? "text-slate-500" : "text-white/40"}`}
          >
            {index + 1} / {total}
          </span>
        </div>
      </footer>
    </div>
  );
}
