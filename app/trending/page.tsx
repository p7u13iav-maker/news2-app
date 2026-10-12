"use client";

import { useEffect, useState } from "react";
import type { TrendingData, TrendingArticle, Segment } from "@/lib/trending";

/**
 * Top-5 trending news over the past 48 hours, split into 4 segments:
 * 世界 / 日本 / スポーツ / テクノロジー.
 *
 * Data is fetched client-side from /api/trending (server fetches Google News
 * RSS, no API key). Refreshed once per mount. The page is intentionally a
 * standalone view (not part of the signage slideshow) — the signage already
 * rotates its own news set.
 */

interface SegmentDef {
  key: Segment;
  label: string;
  icon: string;
  accent: string;
  soft: string;
}

const SEGMENTS: SegmentDef[] = [
  { key: "world", label: "世界", icon: "🌍", accent: "#60a5fa", soft: "rgba(96,165,250,0.15)" },
  { key: "japan", label: "日本", icon: "🇯🇵", accent: "#f472b6", soft: "rgba(244,114,182,0.15)" },
  { key: "sports", label: "スポーツ", icon: "⚾", accent: "#34d399", soft: "rgba(52,211,153,0.15)" },
  { key: "technology", label: "テクノロジー", icon: "💡", accent: "#fbbf24", soft: "rgba(251,191,36,0.15)" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}

function SegmentCard({
  seg,
  items,
}: {
  seg: SegmentDef;
  items: TrendingArticle[];
}) {
  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm"
      style={{ borderTop: `2px solid ${seg.accent}` }}
    >
      {/* Segment header. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: seg.soft }}
        >
          {seg.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-white">
            {seg.label}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-white/40">
            過去48時間 · TOP {items.length}
          </p>
        </div>
      </header>

      {/* Ranked list: 5 rows, evenly spaced inside the card. */}
      <ol className="flex min-h-0 flex-1 flex-col justify-start gap-2 p-3">
        {items.map((a, i) => (
          <li key={a.url} className="min-h-0">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/[0.06]"
            >
              {/* Rank badge. */}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums"
                style={{
                  color: i < 3 ? seg.accent : "rgba(255,255,255,0.5)",
                  backgroundColor:
                    i < 3 ? seg.soft : "rgba(255,255,255,0.04)",
                }}
              >
                {i + 1}
              </span>
              {/* Title on top, source + age below. */}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <p className="line-clamp-1 text-sm font-medium leading-tight text-white/90 group-hover:text-white">
                  {a.title}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <span className="min-w-0 truncate">{a.source}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {timeAgo(a.publishedAt)}
                  </span>
                </div>
              </div>
            </a>
          </li>
        ))}
        {items.length === 0 && (
          <li className="flex flex-1 items-center justify-center text-xs text-white/30">
            取得中 / 該当なし
          </li>
        )}
      </ol>
    </section>
  );
}

export default function TrendingPage() {
  const [data, setData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch trending news once on mount.
  useEffect(() => {
    fetch("/api/trending")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error || "Failed to load trending news");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient (same as the other pages). */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            🔥
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              朝会前のひととき
            </p>
            <p className="text-sm text-white/50">
              過去48時間の注目ニュース · TOP 5 / セグメント
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

      {/* Main: 4 segments in a 2×2 grid. */}
      <main className="relative z-10 flex min-h-0 flex-1 p-6">
        {error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-white/40">{error}</p>
          </div>
        )}
        {loading && !error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
              <p className="text-white/40">注目ニュースを取得中…</p>
            </div>
          </div>
        )}
        {data && !loading && (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-4">
            {SEGMENTS.map((seg) => (
              <SegmentCard
                key={seg.key}
                seg={seg}
                items={data[seg.key]}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-3">
        <a
          href="/"
          className="text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          ← サイネージに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            出典: Google News RSS（過去48時間）
          </span>
          <a
            href="/market"
            className="text-sm font-medium text-white/40 transition hover:text-white/70"
          >
            📊 市場データ →
          </a>
        </div>
      </footer>
    </div>
  );
}
