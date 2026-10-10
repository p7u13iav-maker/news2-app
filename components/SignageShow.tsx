"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Article } from "@/lib/newsApi";

const SLIDE_MS = 10_000; // 10 seconds per slide

/**
 * Full-screen digital-signage slideshow.
 *
 * Shows the latest `count` (default 10) headlines, one at a time, advancing
 * every 10 seconds. Designed for a kiosk / signage display: large type, no
 * interactive chrome, subtle animated background, and a progress bar.
 */
export default function SignageShow({
  articles,
  count = 10,
}: {
  articles: Article[];
  count?: number;
}) {
  const slides = useMemo(() => articles.slice(0, count), [articles, count]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);

  // Reset to the first slide when the article list changes (e.g. cron refresh).
  useEffect(() => {
    setIndex(0);
  }, [slides]);

  // Drive the 10-second slide + progress animation with requestAnimationFrame.
  useEffect(() => {
    if (slides.length === 0) return;
    start.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start.current;
      const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
      setProgress(pct);
      if (elapsed >= SLIDE_MS) {
        start.current = now;
        setProgress(0);
        setIndex((i) => (i + 1) % slides.length);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [slides]);

  // Live clock for the signage header.
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (slides.length === 0) {
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
  const source = current.source;
  const time = new Date(current.publishedAt);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-950 text-white">
      {/* Animated gradient backdrop, tinted by slide index for subtle variety. */}
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
          background: `hsl(${(index * 36) % 360} 70% 55%)`,
        }}
      />

      {/* Progress bar across the top. */}
      <div className="absolute inset-x-0 top-0 z-20 h-1.5 bg-white/10">
        <div
          className="h-full bg-white/80"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header: brand + live clock. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            📰
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">毎朝ニュース</p>
            <p className="text-sm text-white/50">日経新聞 / 日経ビジネス</p>
          </div>
        </div>
        {clock && (
          <div className="text-right">
            <p className="font-mono text-4xl font-light tabular-nums">
              {clock.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-sm text-white/50">
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

      {/* Slide content. Keyed by index so the whole block re-mounts and re-animates. */}
      <main
        key={index}
        className="relative z-10 flex h-full flex-col justify-center px-16 pb-24 pt-28"
      >
        <div className="slide-enter">
          {/* Source + time badge. */}
          <div className="mb-8 flex items-center gap-4">
            <span className="rounded-full bg-white/10 px-5 py-2 text-xl font-semibold backdrop-blur">
              {source}
            </span>
            <span className="text-lg text-white/50">
              {time.toLocaleDateString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-6xl font-thin text-white/20">
              {index + 1}
              <span className="text-3xl"> / {slides.length}</span>
            </span>
          </div>

          {/* Headline (very large). */}
          <h1 className="slide-title mb-10 text-6xl font-bold leading-tight tracking-tight md:text-7xl">
            {current.title}
          </h1>

          {/* Body / lead text. */}
          {current.description && (
            <div className="slide-desc relative max-w-6xl pl-8">
              <span
                aria-hidden
                className="absolute left-0 top-1 h-[95%] w-1.5 rounded-full bg-gradient-to-b from-white/70 to-white/10"
              />
              <p className="text-3xl leading-relaxed text-white/80 md:text-4xl">
                {current.description}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer: slide dots. */}
      <footer className="absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-3">
        {slides.map((_, i) => (
          <span
            key={i}
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: i === index ? "2.5rem" : "0.6rem",
              background: i === index ? "#fff" : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </footer>
    </div>
  );
}
