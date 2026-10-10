"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Article } from "@/lib/newsApi";
import MarketSparklines from "@/components/MarketSparklines";
import { ZODIAC_SIGNS, type ZodiacKey } from "@/lib/zodiac";

const SLIDE_MS = 10_000;

/* ---------- Types ---------- */

interface SummaryData {
  ok: boolean;
  date?: string;
  summary?: { domestic: string[]; international: string[]; economy: string[] };
  error?: string;
}

interface HoroscopeData {
  ok: boolean;
  date?: string;
  horoscopes?: Record<ZodiacKey, string>;
  error?: string;
}

/* ---------- Slide definitions ---------- */

type SlideKind = "summary" | "market" | "news" | "horoscope";

interface SlideDef {
  kind: SlideKind;
  /** For news: the article index. For horoscope: the group index (0-2). */
  sub?: number;
}

/**
 * Build the slide sequence:
 *   1 summary, 1 market, N news, 3 horoscope
 */
function buildSlides(newsCount: number): SlideDef[] {
  const slides: SlideDef[] = [];
  slides.push({ kind: "summary" });
  slides.push({ kind: "market" });
  for (let i = 0; i < newsCount; i++) slides.push({ kind: "news", sub: i });
  for (let i = 0; i < 3; i++) slides.push({ kind: "horoscope", sub: i });
  return slides;
}

/* ---------- Sub-components ---------- */

const CATEGORIES: {
  key: "domestic" | "international" | "economy";
  label: string;
  icon: string;
  accent: string;
  dot: string;
}[] = [
  {
    key: "domestic",
    label: "国内の出来事",
    icon: "🇯🇵",
    accent: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    dot: "bg-blue-400",
  },
  {
    key: "international",
    label: "国外の出来事",
    icon: "🌍",
    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  {
    key: "economy",
    label: "経済ニュース",
    icon: "📈",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    dot: "bg-amber-400",
  },
];

const HOROSCOPE_GROUPS = [
  ZODIAC_SIGNS.slice(0, 4),
  ZODIAC_SIGNS.slice(4, 8),
  ZODIAC_SIGNS.slice(8, 12),
];

function SummarySlide({ data }: { data: SummaryData | null }) {
  if (!data?.summary) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl text-white/40">要約を読み込み中…</p>
      </div>
    );
  }
  return (
    <div className="grid h-full w-full grid-cols-3 gap-5">
      {CATEGORIES.map((cat) => {
        const items = data.summary![cat.key] ?? [];
        return (
          <div
            key={cat.key}
            className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${cat.accent}`}
          >
            <div className="mb-3 flex shrink-0 items-center gap-3">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="text-xl font-bold tracking-tight">{cat.label}</h2>
            </div>
            <ul className="min-h-0 flex-1 space-y-3 overflow-hidden">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-lg leading-snug text-white/90"
                >
                  <span
                    className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${cat.dot}`}
                  />
                  <span className="line-clamp-3">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

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

function HoroscopeSlide({
  data,
  groupIndex,
}: {
  data: HoroscopeData | null;
  groupIndex: number;
}) {
  if (!data?.horoscopes) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl text-white/40">占いを読み込み中…</p>
      </div>
    );
  }
  const group = HOROSCOPE_GROUPS[groupIndex];
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-4">
      {group.map((s) => (
        <div
          key={s.key}
          className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <div className="mb-2 flex items-center gap-3">
            <span className="text-3xl leading-none">{s.symbol}</span>
            <div>
              <p className="text-xl font-bold leading-tight">{s.ja}</p>
              <p className="text-xs text-white/40">{s.dateRange}</p>
            </div>
          </div>
          <p className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-white/80">
            {data.horoscopes![s.key]}
          </p>
        </div>
      ))}
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

  // Data fetching (client-side, cached server-side for the day).
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [horoscopeData, setHoroscopeData] = useState<HoroscopeData | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch summary immediately (server caches for the day).
  useEffect(() => {
    fetch("/api/summary", { method: "POST" })
      .then((r) => r.json())
      .then((json) => setSummaryData(json))
      .catch(() => setSummaryData({ ok: false, error: "fetch failed" }));
  }, []);

  // Fetch horoscope after 5 min delay to stagger the Gemini calls
  // (avoids two simultaneous requests hitting rate limits).
  useEffect(() => {
    const id = setTimeout(() => {
      fetch("/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "daily" }),
      })
        .then((r) => r.json())
        .then((json) => setHoroscopeData(json))
        .catch(() =>
          setHoroscopeData({ ok: false, error: "fetch failed" }),
        );
    }, 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, []);

  // Drive the slide + progress animation.
  useEffect(() => {
    if (total === 0) return;
    start.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start.current;
      const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
      setProgress(pct);
      if (elapsed >= SLIDE_MS) {
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

  // Section label for the header subtitle.
  const sectionLabel =
    current.kind === "summary"
      ? "📋 ニュースサマリー"
      : current.kind === "market"
        ? "📊 市場データ"
        : current.kind === "news"
          ? "📰 毎朝ニュース"
          : "✨ 12星座占い";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-950 text-white">
      {/* Background gradient. */}
      <div
        className="absolute inset-0 opacity-90 transition-all duration-1000"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />
      {/* Accent glow that shifts hue per slide. */}
      <div
        className="absolute -right-40 -top-40 h-[60vh] w-[60vh] rounded-full opacity-20 blur-3xl transition-all duration-1000"
        style={{
          background: `hsl(${(index * 28) % 360} 70% 55%)`,
        }}
      />

      {/* Progress bar across the top. */}
      <div className="absolute inset-x-0 top-0 z-20 h-1.5 bg-white/10">
        <div
          className="h-full bg-white/80"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            📡
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">{sectionLabel}</p>
            <p className="text-sm text-white/50">
              毎朝 6:30 更新 · NHK / 日経 / 市場 / 占い
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/40">
            {index + 1} / {total}
          </span>
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
          {current.kind === "summary" && (
            <SummarySlide data={summaryData} />
          )}

          {current.kind === "market" && <MarketSparklines size="large" />}

          {current.kind === "news" && current.sub != null && (
            <NewsSlide
              article={articles[current.sub]}
              index={current.sub}
            />
          )}

          {current.kind === "horoscope" && current.sub != null && (
            <HoroscopeSlide
              data={horoscopeData}
              groupIndex={current.sub}
            />
          )}
        </div>
      </main>

      {/* Footer: slide dots. */}
      <footer className="absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <span
            key={i}
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: i === index ? "2rem" : "0.5rem",
              background:
                i === index
                  ? "#fff"
                  : s.kind === current.kind
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </footer>
    </div>
  );
}
