"use client";

import { useEffect, useState } from "react";

/**
 * Dedicated weather signage page.
 *
 * Shows today's weather for Kure (Kure City, Hiroshima Prefecture) full-screen
 * with current conditions, an hourly temperature chart, and sunrise/sunset.
 * Data comes from Open-Meteo (no API key, JMA + global models). Refreshed
 * once daily at 6:30 via the cron (same as news/summary/market/horoscope).
 */

interface WeatherCurrent {
  time: string;
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  label: string;
  emoji: string;
  windDirectionLabel: string;
}

interface WeatherHourly {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
  label: string;
  emoji: string;
}

interface WeatherDaily {
  date: string;
  maxTemp: number;
  minTemp: number;
  maxPrecipProb: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  label: string;
  emoji: string;
}

interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily;
}

interface WeatherResponse {
  ok: boolean;
  fetchedAt?: number;
  weather?: WeatherData;
  error?: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    })
    .replace("時", "")
    .replace(":00", "");
}

/** Simple inline SVG temperature chart for the 24 hourly values. */
function HourlyChart({ hourly }: { hourly: WeatherHourly[] }) {
  const W = 1000;
  const H = 200;
  const PAD = 10;
  if (hourly.length === 0) return null;

  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  // Axis padding: room for Y-labels (left) and X-labels (bottom).
  const L = 60; // left padding for Y-axis labels
  const B = 40; // bottom padding for X-axis labels
  const plotW = W - L - 20;
  const plotH = H - B - 20;

  const step = hourly.length > 1 ? plotW / (hourly.length - 1) : 0;
  const points = hourly.map((h, i) => {
    const x = L + i * step;
    const y = 10 + plotH - ((h.temperature - min) / range) * plotH;
    return { x, y, h };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${L},${10 + plotH} ${line} ${L + plotW},${10 + plotH}`;

  // Y-axis: 3 tick labels (max / mid / min).
  const yTicks = [
    { v: max, y: 10 },
    { v: (max + min) / 2, y: 10 + plotH / 2 },
    { v: min, y: 10 + plotH },
  ];

  // X-axis: hour labels every 3 hours (0,3,6,9,12,15,18,21).
  const xTicks = points.filter((_, i) => i % 3 === 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis gridlines + scale labels. */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={L}
            y1={t.y}
            x2={L + plotW}
            y2={t.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          <text
            x={L - 8}
            y={t.y + 4}
            fill="rgba(255,255,255,0.6)"
            fontSize="16"
            fontFamily="monospace"
            textAnchor="end"
          >
            {Math.round(t.v)}°
          </text>
        </g>
      ))}

      {/* X-axis hour labels. */}
      {xTicks.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={10 + plotH + 28}
          fill="rgba(255,255,255,0.5)"
          fontSize="14"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {fmtHour(p.h.time)}時
        </text>
      ))}

      {/* Area + line. */}
      <polygon points={area} fill="url(#tempGrad)" />
      <polyline
        points={line}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Weather text labels every 3 hours (above the line). */}
      {xTicks.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={p.y - 14}
          fill="rgba(255,255,255,0.75)"
          fontSize="15"
          fontFamily="sans-serif"
          textAnchor="middle"
        >
          {p.h.label}
        </text>
      ))}

      {/* Dots. */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="#fbbf24"
          opacity={i % 3 === 0 ? 1 : 0.4}
        />
      ))}
    </svg>
  );
}

export default function WeatherPage() {
  const [clock, setClock] = useState<Date | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live clock.
  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch weather (cached daily server-side).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j: WeatherResponse) => {
        if (cancelled) return;
        if (j.ok && j.weather) {
          setData(j.weather);
        } else {
          setError(j.error ?? "天気データを取得できませんでした。");
        }
      })
      .catch(() => {
        if (!cancelled) setError("天気データを取得できませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const c = data?.current;
  const d = data?.daily;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient (sky-themed). */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 120% at 15% 10%, #0c4a6e 0%, #082f49 45%, #020617 100%)",
        }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            ⛅
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              製銑部 朝会前のひととき
            </p>
            <p className="text-sm text-white/50">
              倉敷市の今日の天気 · 毎時予報
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

      {/* Weather content, full screen, no scroll. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 p-8">
        {error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg text-white/60">{error}</p>
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg text-white/60">天気データを読み込み中…</p>
          </div>
        ) : (
          <>
            {/* Top: current weather + today summary. */}
            <div className="flex min-h-0 flex-1 gap-4">
              {/* Current conditions card. */}
              <div className="flex w-[40%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-8">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-6xl">{c!.emoji}</span>
                  <div>
                    <p className="text-2xl font-semibold">{c!.label}</p>
                    <p className="text-sm text-white/50">
                      {fmtTime(c!.time)} 現在
                    </p>
                  </div>
                </div>
                <p className="font-mono text-7xl font-light tabular-nums">
                  {Math.round(c!.temperature)}
                  <span className="text-4xl">°C</span>
                </p>
                <p className="mt-2 text-sm text-white/60">
                  体感 {Math.round(c!.apparentTemperature)}°C
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-white/50">湿度</p>
                    <p className="mt-1 font-mono text-lg font-semibold">
                      {c!.humidity}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-white/50">風</p>
                    <p className="mt-1 font-mono text-lg font-semibold">
                      {c!.windDirectionLabel} {c!.windSpeed.toFixed(1)} km/h
                    </p>
                  </div>
                </div>
              </div>

              {/* Today summary card. */}
              <div className="flex w-[60%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-8">
                <p className="mb-4 text-sm font-medium text-white/50">
                  今日の天気
                </p>
                <div className="flex items-center gap-8">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-white/50">
                      最高気温
                    </p>
                    <p className="font-light tabular-nums text-orange-300">
                      <span className="text-5xl">{Math.round(d!.maxTemp)}</span>
                      <span className="text-2xl">°C</span>
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-white/50">
                      最低気温
                    </p>
                    <p className="font-light tabular-nums text-sky-300">
                      <span className="text-5xl">{Math.round(d!.minTemp)}</span>
                      <span className="text-2xl">°C</span>
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
                    <span>🌧</span>
                    <span className="font-mono font-semibold">
                      降水 {d!.maxPrecipProb}%
                    </span>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
                    <span className="text-3xl">🌅</span>
                    <div>
                      <p className="text-xs text-white/50">日の出</p>
                      <p className="font-mono text-xl font-semibold">
                        {fmtTime(d!.sunrise)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
                    <span className="text-3xl">🌇</span>
                    <div>
                      <p className="text-xs text-white/50">日の入り</p>
                      <p className="font-mono text-xl font-semibold">
                        {fmtTime(d!.sunset)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: hourly temperature chart (full width, no scroll). */}
            <div className="flex min-h-0 flex-1 items-center">
              <HourlyChart hourly={data.hourly} />
            </div>
          </>
        )}
      </main>

      {/* Footer: back to main page. */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-10 py-4">
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← メインニュースに戻る
        </a>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">
            毎朝 6:30 に更新 · 出典: Open-Meteo (JMA)
          </span>
          <a
            href="/market"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            📈 市場データ →
          </a>
        </div>
      </footer>
    </div>
  );
}
