import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { QUOTES, getDailyQuote } from "@/lib/quotes";

export const metadata: Metadata = {
  title: "今日のひとこと | 朝会前のひととき",
  description: "出典が確実な偉人の名言とエピソードを毎日1件紹介",
};

function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function dayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

async function QuoteContent() {
  await connection();
  const now = jstNow();
  const quote = getDailyQuote();
  const doy = dayOfYear(now);
  const progress = ((doy - 1) / 365) * 100;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            💬
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              今日のひととき
            </p>
            <p className="text-sm text-white/50">
              偉人の名言とエピソード · 全{QUOTES.length}件より毎日1件
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-light tabular-nums">
            {now.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <p className="text-xs text-white/50">
            {now.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
              timeZone: "Asia/Tokyo",
            })}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Theme tag */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: "rgba(251,191,36,0.15)",
                color: "#fbbf24",
              }}
            >
              {quote.theme}
            </span>
            <span className="text-sm text-white/40">
              No.{quote.id} / {QUOTES.length}
            </span>
          </div>

          {/* Quote card */}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10"
            style={{
              background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
            }}
          >
            {/* Accent left border */}
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: "#f59e0b" }}
            />

            <div className="p-8 md:p-12">
              {/* Person info */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-white md:text-4xl">
                  {quote.name}
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  {quote.era} · {quote.origin}
                </p>
              </div>

              {/* The quote */}
              <blockquote className="mb-6">
                <p
                  className="text-2xl font-medium leading-relaxed md:text-3xl"
                  style={{ color: "#e2e8f0" }}
                >
                  「{quote.quote}」
                </p>
                {quote.quoteEn && (
                  <p className="mt-3 text-sm italic text-white/40">
                    {quote.quoteEn}
                  </p>
                )}
              </blockquote>

              {/* Source */}
              <div className="mb-6 flex items-center gap-2 text-sm text-white/50">
                <span className="text-xs tracking-widest text-white/30">
                  出典
                </span>
                <span className="text-white/70">{quote.source}</span>
              </div>

              {/* Episode */}
              <div className="rounded-xl bg-white/[0.04] p-5">
                <p className="mb-2 text-xs tracking-widest text-white/30">
                  エピソード
                </p>
                <p className="text-base leading-relaxed text-white/70">
                  {quote.episode}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs text-white/40">
              <span>今年 {doy}日目 / 365日</span>
              <span>残り {365 - doy}日</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-3">
        <a
          href="/"
          className="text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          ← サイネージに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            出典が確実な偉人の名言 · 毎日1件
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <QuoteContent />
    </Suspense>
  );
}
