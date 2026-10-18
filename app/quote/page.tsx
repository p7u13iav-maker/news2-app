import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { QUOTES } from "@/lib/quotes";

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

/** 更新たびに異なる名言を返す（時間ベースで決定的）。 */
function getQuote(): { quote: (typeof QUOTES)[number]; index: number } {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const hour = now.getHours();
  const index = (dayOfYear + hour) % QUOTES.length;
  return { quote: QUOTES[index], index };
}

async function QuoteContent() {
  await connection();
  const now = jstNow();
  const { quote } = getQuote();
  const doy = dayOfYear(now);
  const progress = ((doy - 1) / 365) * 100;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0a0f1a] text-white">
      {/* Background: subtle radial glow + noise texture */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(30,41,59,0.6) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #f59e0b 20%, #fbbf24 50%, #f59e0b 80%, transparent 100%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-12 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" style={{ filter: "grayscale(0.3)" }}>
            ✦
          </span>
          <div>
            <p className="text-lg font-semibold tracking-wide text-white/90">
              朝会前のひととき
            </p>
            <p className="text-xs tracking-[0.2em] text-white/35">
              TODAY&apos;S QUOTE
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="font-mono text-2xl font-light tabular-nums text-white/80"
            style={{ textShadow: "0 0 20px rgba(251,191,36,0.1)" }}
          >
            {now.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <p className="text-xs text-white/30">
            {now.toLocaleDateString("ja-JP", {
              month: "long",
              day: "numeric",
              weekday: "long",
              timeZone: "Asia/Tokyo",
            })}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-12 pb-4">
        <div className="w-full max-w-3xl">
          {/* Person name — large, left-aligned */}
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <span
                className="rounded-full border px-3 py-1 text-xs font-medium tracking-wider"
                style={{
                  borderColor: "rgba(251,191,36,0.3)",
                  color: "#fbbf24",
                  backgroundColor: "rgba(251,191,36,0.06)",
                }}
              >
                {quote.theme}
              </span>
              <span className="text-xs text-white/25 font-mono">
                {String(quote.id).padStart(2, "0")} / {QUOTES.length}
              </span>
            </div>
            <h1
              className="text-4xl font-bold tracking-tight text-white md:text-5xl"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
            >
              {quote.name}
            </h1>
            <p className="mt-2 text-sm text-white/40">
              {quote.era} · {quote.origin}
            </p>
          </div>

          {/* The quote — hero element, large and centered-left */}
          <blockquote className="relative mb-10 pl-6">
            {/* Vertical accent line */}
            <div
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
              style={{
                background:
                  "linear-gradient(180deg, #f59e0b, rgba(251,191,36,0.2))",
              }}
            />
            <p
              className="text-2xl font-medium leading-[1.7] text-white/95 md:text-[1.75rem]"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.2)" }}
            >
              {quote.quote}
            </p>
            {quote.quoteEn && (
              <p className="mt-3 pl-1 text-sm italic text-white/30">
                {quote.quoteEn}
              </p>
            )}
          </blockquote>

          {/* Source — subtle, right-aligned */}
          <div className="mb-8 text-right">
            <p className="text-xs tracking-wider text-white/25">
              — {quote.source}
            </p>
          </div>

          {/* Episode — in a subtle container */}
          <div
            className="rounded-xl border border-white/[0.06] p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              backdropFilter: "blur(4px)",
            }}
          >
            <p className="mb-2 text-[11px] font-medium tracking-[0.15em] text-white/25">
              エピソード
            </p>
            <p className="text-[15px] leading-[1.8] text-white/60">
              {quote.episode}
            </p>
          </div>
        </div>
      </main>

      {/* Footer: progress + nav */}
      <footer className="relative z-10 shrink-0 px-12 pb-8 pt-4">
        {/* Progress bar */}
        <div className="mb-4 flex items-center gap-4">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, #f59e0b, #fbbf24)",
                boxShadow: "0 0 8px rgba(251,191,36,0.3)",
              }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-mono tabular-nums text-white/25">
            {doy}/365
          </span>
        </div>

        <div className="flex items-center justify-between">
          <a
            href="/"
            className="text-xs font-medium text-white/25 transition hover:text-white/50"
          >
            ← サイネージ
          </a>
          <span className="text-[11px] text-white/15">
            出典確認済みの名言 · 毎日1件
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
