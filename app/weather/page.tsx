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
  const H = 260;
  const PAD = 10;
  if (hourly.length === 0) return null;

  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  // Axis padding: room for Y-labels (left) and X-labels + weather icons (bottom).
  const L = 60; // left padding for Y-axis labels
  const B = 90; // bottom padding for hour labels + weather icons
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

  // X-axis: hour labels + weather icons every 2 hours.
  const xTicks = points.filter((_, i) => i % 2 === 0);

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

      {/* X-axis: hour labels + weather icons below the chart. */}
      {xTicks.map((p, i) => (
        <g key={i}>
          <text
            x={p.x}
            y={10 + plotH + 22}
            fill="rgba(255,255,255,0.5)"
            fontSize="13"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {fmtHour(p.h.time)}時
          </text>
          <WeatherIcon code={p.h.weatherCode} cx={p.x} cy={10 + plotH + 42} size={24} />
        </g>
      ))}
    </svg>
  );
}

/** Render a small weather icon (sun/cloud/rain/snow) as SVG shapes. */
function WeatherIcon({
  code,
  cx,
  cy,
  size,
}: {
  code: number;
  cx: number;
  cy: number;
  size: number;
}) {
  const r = size / 2;
  const s = size;

  // Determine icon type + color from weather code.
  const isClear = code === 0;           // 晴れ (sun only)
  const isPartly = code === 1;           // 晴れ時々くもり (sun + cloud)
  const isCloud = code === 2 || code === 3; // くもり/曇り (cloud only)
  const isRain = code >= 51 && code <= 67 || (code >= 80 && code <= 82);
  const isSnow = code >= 71 && code <= 77 || (code >= 85 && code <= 86);
  const isThunder = code >= 95;
  const isFog = code === 45 || code === 48;

  const sunColor = "#fbbf24";
  const cloudColor = "rgba(203,213,225,0.85)";
  const rainColor = "#60a5fa";
  const snowColor = "#e2e8f0";
  const thunderColor = "#fbbf24";

  return (
    <g transform={`translate(${cx - s / 2}, ${cy - s / 2})`}>
      {/* Clear sun (code 0). */}
      {isClear && (
        <>
          <circle cx={s / 2} cy={s / 2} r={r * 0.6} fill={sunColor} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1={s / 2 + Math.cos((deg * Math.PI) / 180) * r * 0.75}
              y1={s / 2 + Math.sin((deg * Math.PI) / 180) * r * 0.75}
              x2={s / 2 + Math.cos((deg * Math.PI) / 180) * r}
              y2={s / 2 + Math.sin((deg * Math.PI) / 180) * r}
              stroke={sunColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </>
      )}

      {/* Partly sunny: small sun behind cloud (code 1). */}
      {isPartly && (
        <>
          {/* Small sun peeking from behind. */}
          <circle cx={s * 0.35} cy={s * 0.35} r={s * 0.18} fill={sunColor} />
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1={s * 0.35 + Math.cos((deg * Math.PI) / 180) * s * 0.22}
              y1={s * 0.35 + Math.sin((deg * Math.PI) / 180) * s * 0.22}
              x2={s * 0.35 + Math.cos((deg * Math.PI) / 180) * s * 0.28}
              y2={s * 0.35 + Math.sin((deg * Math.PI) / 180) * s * 0.28}
              stroke={sunColor}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          ))}
          {/* Cloud in front. */}
          <path
            d={`M ${s * 0.25} ${s * 0.65}
               a ${s * 0.12} ${s * 0.12} 0 0 1 0 -${s * 0.24}
               a ${s * 0.16} ${s * 0.16} 0 0 1 ${s * 0.32} 0
               a ${s * 0.12} ${s * 0.12} 0 0 1 0 ${s * 0.24}
               z`}
            fill={cloudColor}
          />
        </>
      )}

      {/* Cloud (code 2,3). */}
      {(isCloud || isRain || isSnow || isThunder) && (
        <path
          d={`M ${s * 0.2} ${s * 0.6}
             a ${s * 0.15} ${s * 0.15} 0 0 1 0 -${s * 0.3}
             a ${s * 0.2} ${s * 0.2} 0 0 1 ${s * 0.4} 0
             a ${s * 0.15} ${s * 0.15} 0 0 1 0 ${s * 0.3}
             z`}
          fill={cloudColor}
        />
      )}

      {/* Rain drops (code 51-67, 80-82). */}
      {isRain && (
        <>
          <line x1={s * 0.35} y1={s * 0.65} x2={s * 0.3} y2={s * 0.85} stroke={rainColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={s * 0.5} y1={s * 0.65} x2={s * 0.45} y2={s * 0.85} stroke={rainColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={s * 0.65} y1={s * 0.65} x2={s * 0.6} y2={s * 0.85} stroke={rainColor} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {/* Snow (code 71-77, 85-86). */}
      {isSnow && (
        <>
          <circle cx={s * 0.35} cy={s * 0.75} r="1.5" fill={snowColor} />
          <circle cx={s * 0.5} cy={s * 0.8} r="1.5" fill={snowColor} />
          <circle cx={s * 0.65} cy={s * 0.75} r="1.5" fill={snowColor} />
        </>
      )}

      {/* Thunder (code 95+). */}
      {isThunder && (
        <path
          d={`M ${s * 0.48} ${s * 0.6} L ${s * 0.42} ${s * 0.75} L ${s * 0.52} ${s * 0.75} L ${s * 0.45} ${s * 0.9}`}
          fill="none"
          stroke={thunderColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Fog (code 45,48). */}
      {isFog && (
        <>
          <line x1={s * 0.25} y1={s * 0.4} x2={s * 0.75} y2={s * 0.4} stroke={cloudColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={s * 0.25} y1={s * 0.55} x2={s * 0.75} y2={s * 0.55} stroke={cloudColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={s * 0.3} y1={s * 0.7} x2={s * 0.7} y2={s * 0.7} stroke={cloudColor} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

/** Single tip row: emoji + text. */
function TipItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">
        {emoji}
      </span>
      <p className="text-sm leading-snug text-white/80">{text}</p>
    </div>
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
            {/* Top: current weather + today summary + tips (3 columns). */}
            <div className="flex min-h-0 flex-1 gap-4">
              {/* Column 1: Current conditions. */}
              <div className="flex w-[34%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-4xl">
                    {c!.emoji}
                  </span>
                  <div>
                    <p className="text-xl font-semibold">{c!.label}</p>
                    <p className="text-xs text-white/50">
                      {fmtTime(c!.time)} 現在
                    </p>
                  </div>
                </div>
                <p className="font-mono text-6xl font-light tabular-nums">
                  {Math.round(c!.temperature)}
                  <span className="text-3xl">°C</span>
                </p>
                <p className="mt-1 text-sm text-white/60">
                  体感 {Math.round(c!.apparentTemperature)}°C
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-white/50">湿度</p>
                    <p className="mt-0.5 font-mono text-base font-semibold">
                      {c!.humidity}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-white/50">風</p>
                    <p className="mt-0.5 font-mono text-base font-semibold">
                      {c!.windDirectionLabel} {c!.windSpeed.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Column 2: Today summary. */}
              <div className="flex w-[34%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-3 text-sm font-medium text-white/50">
                  今日の天気
                </p>
                <div className="flex items-center gap-5">
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-white/50">
                      最高気温
                    </p>
                    <p className="font-light tabular-nums text-orange-300">
                      <span className="text-4xl">{Math.round(d!.maxTemp)}</span>
                      <span className="text-xl">°C</span>
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-white/50">
                      最低気温
                    </p>
                    <p className="font-light tabular-nums text-sky-300">
                      <span className="text-4xl">{Math.round(d!.minTemp)}</span>
                      <span className="text-xl">°C</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-sm">
                    🌧
                  </span>
                  <span className="font-mono font-semibold">
                    降水 {d!.maxPrecipProb}%
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg">
                      🌅
                    </span>
                    <div>
                      <p className="text-[10px] text-white/50">日の出</p>
                      <p className="font-mono text-base font-semibold">
                        {fmtTime(d!.sunrise)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg">
                      🌇
                    </span>
                    <div>
                      <p className="text-[10px] text-white/50">日の入り</p>
                      <p className="font-mono text-base font-semibold">
                        {fmtTime(d!.sunset)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Outgoing tips. */}
              <div className="flex w-[32%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-3 text-sm font-medium text-white/50">
                  今日のヒント
                </p>
                <div className="flex flex-col gap-3">
                  <TipItem
                    emoji="🌡️"
                    text={
                      d!.maxTemp >= 30
                        ? "暑い日。水分補給を忘れずに。"
                        : d!.maxTemp >= 25
                          ? "暖かい日。薄着でも快適です。"
                          : d!.maxTemp >= 18
                            ? "肌寒い日。羽織ものがあると安心。"
                            : d!.maxTemp >= 10
                              ? "寒い日。防寒着を忘れずに。"
                              : "真冬。重ね着で防寒しましょう。"
                    }
                  />
                  <TipItem
                    emoji={d!.maxPrecipProb >= 50 ? "☂️" : "🌂"}
                    text={
                      d!.maxPrecipProb >= 70
                        ? "雨の可能性大。傘をお持ちください。"
                        : d!.maxPrecipProb >= 40
                          ? "雨の可能性あり。折りたたみ傘が安心。"
                          : "傘は不要。晴れの日です。"
                    }
                  />
                  <TipItem
                    emoji={c!.windSpeed >= 20 ? "💨" : "🍃"}
                    text={
                      c!.windSpeed >= 30
                        ? "強風注意。帽子や小物に気をつけて。"
                        : c!.windSpeed >= 15
                          ? "やや風が強い日。"
                          : "風は穏やかです。"
                    }
                  />
                </div>
              </div>
            </div>

            {/* Bottom: hourly temperature chart (fixed height, no scroll). */}
            <div className="shrink-0" style={{ height: "38%" }}>
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
