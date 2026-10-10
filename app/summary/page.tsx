"use client";

import { useEffect, useState, useCallback } from "react";

interface Summary {
  domestic: string[];
  international: string[];
  economy: string[];
}

interface SummaryData {
  ok: boolean;
  date?: string;
  summary?: Summary;
  error?: string;
}

const CATEGORIES: { key: keyof Summary; label: string; icon: string; accent: string }[] = [
  { key: "domestic", label: "国内の出来事", icon: "🇯🇵", accent: "from-blue-500/20 to-blue-500/5 border-blue-500/30" },
  { key: "international", label: "国外の出来事", icon: "🌍", accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "economy", label: "経済ニュース", icon: "📈", accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
];

export default function SummaryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || "Failed to generate summary.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount.
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient. */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0b1120 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-10 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            📋
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">ニュースサマリー</p>
            <p className="text-sm text-white/50">
              NHK / 日経新聞 · AI による要約
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
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
          >
            {loading ? "要約中…" : "更新"}
          </button>
        </div>
      </header>

      {/* Date banner. */}
      {data?.date && (
        <div className="relative z-10 px-10 pt-6">
          <p className="text-lg text-white/70">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {data.date} のニュースサマリー
          </p>
        </div>
      )}

      {/* Content. */}
      <main className="relative z-10 flex-1 overflow-y-auto px-10 py-8">
        {loading && !data && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-blue-400" />
              <p className="text-lg text-white/60">
                AI がニュースを要約しています…
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <p className="mb-2 text-2xl">⚠️</p>
              <p className="mb-4 text-red-300">{error}</p>
              <button
                onClick={fetchSummary}
                className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/20"
              >
                再試行
              </button>
            </div>
          </div>
        )}

        {data?.summary && !loading && (
          <div className="grid gap-6">
            {CATEGORIES.map((cat) => {
              const items = data.summary![cat.key];
              if (!items || items.length === 0) return null;
              return (
                <div
                  key={cat.key}
                  className={`rounded-2xl border bg-gradient-to-br p-6 ${cat.accent}`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-3xl">{cat.icon}</span>
                    <h2 className="text-2xl font-bold tracking-tight">
                      {cat.label}
                    </h2>
                    <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">
                      {items.length} 項目
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-lg leading-relaxed text-white/90"
                      >
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* Show a note if all categories are empty. */}
            {CATEGORIES.every((c) => {
              const items = data.summary![c.key];
              return !items || items.length === 0;
            }) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                要約が見つかりませんでした。時間をおいて再試行してください。
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer: back to main page. */}
      <footer className="relative z-10 border-t border-white/10 px-10 py-4">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
      </footer>
    </div>
  );
}
