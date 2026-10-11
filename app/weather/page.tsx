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

/** Background gradient based on weather type. */
function skyGradient(code: number): string {
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isCloud = code === 2 || code === 3;
  const isFog = code === 45 || code === 48;
  if (isRain)
    return "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #0f172a 45%, #020617 100%)";
  if (isSnow)
    return "radial-gradient(120% 120% at 15% 10%, #1e293b 0%, #1e293b 45%, #0f172a 100%)";
  if (isCloud || isFog)
    return "radial-gradient(120% 120% at 15% 10%, #334155 0%, #1e293b 45%, #0f172a 100%)";
  if (code === 1)
    return "radial-gradient(120% 120% at 15% 10%, #0e7490 0%, #155e75 45%, #0c4a6e 100%)";
  // Clear (code 0) — brightest.
  return "radial-gradient(120% 120% at 15% 10%, #0369a1 0%, #075985 45%, #0c4a6e 100%)";
}

/** Accent color for the current-temperature hero number. */
function tempColor(code: number): string {
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isCloud = code === 2 || code === 3 || code === 45 || code === 48;
  if (isSnow) return "text-sky-100";
  if (isRain) return "text-blue-200";
  if (isCloud) return "text-slate-200";
  return "text-amber-200";
}

/** Area gradient stops for the hourly chart, keyed by weather. */
function chartGradient(code: number): [string, string] {
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isCloud = code === 2 || code === 3 || code === 45 || code === 48;
  if (isRain) return ["#60a5fa", "#3b82f6"];
  if (isSnow) return ["#e2e8f0", "#94a3b8"];
  if (isCloud) return ["#94a3b8", "#64748b"];
  return ["#f59e0b", "#f97316"];
}

/** Rule-based one-line weather summary for the morning meeting. */
function weatherSummary(c: WeatherCurrent, d: WeatherDaily): string {
  const parts: string[] = [];
  const code = c.weatherCode;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const isThunder = code >= 95;
  const isCloud = code === 2 || code === 3;
  const isClear = code === 0 || code === 1;

  if (isThunder) parts.push("雷雨の可能性があるので、屋外作業は注意を");
  else if (isRain)
    parts.push(d.maxPrecipProb >= 70 ? "強い雨の見込み、傘は必須です" : "雨の日、傘をお持ちください");
  else if (isCloud) parts.push("曇り空ですが、大きな雨はなさそうです");
  else if (isClear) parts.push("気持ちの良い晴天です");

  if (d.maxTemp >= 30) parts.push("最高" + Math.round(d.maxTemp) + "℃まで上がる暑い一日、熱中症に気をつけて");
  else if (d.maxTemp >= 25) parts.push("暑めの一日、水分補給を忘れずに");
  else if (d.maxTemp >= 18) parts.push("過ごしやすい気温です");
  else if (d.maxTemp >= 10) parts.push("肌寒い一日、羽織ものがあると安心です");
  else parts.push("厳しい寒さ、防寒着を忘れずに");

  if (c.windSpeed >= 20) parts.push("強めの風が吹く見込み、小物や帽子に注意を");

  return parts.join("。") + "。";
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

/** Build a smooth Catmull-Rom spline path through the given points. */
function splinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Smooth temperature chart for the 24 hourly values. */
function HourlyChart({
  hourly,
  weatherCode,
}: {
  hourly: WeatherHourly[];
  weatherCode: number;
}) {
  const W = 1000;
  const H = 260;
  if (hourly.length === 0) return null;

  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  const L = 60;
  const B = 90;
  const plotW = W - L - 20;
  const plotH = H - B - 20;
  const top = 10;

  const step = hourly.length > 1 ? plotW / (hourly.length - 1) : 0;
  const points = hourly.map((h, i) => {
    const x = L + i * step;
    const y = top + plotH - ((h.temperature - min) / range) * plotH;
    return { x, y, h };
  });

  const lineD = splinePath(points);
  const areaD = `${lineD} L ${points[points.length - 1].x},${top + plotH} L ${points[0].x},${top + plotH} Z`;

  const [g1, g2] = chartGradient(weatherCode);
  const lineColor = g1;

  // Y-axis: 3 tick labels.
  const yTicks = [
    { v: max, y: top },
    { v: (max + min) / 2, y: top + plotH / 2 },
    { v: min, y: top + plotH },
  ];

  // X-axis: hour labels + weather icons every 3 hours.
  const xTicks = points.filter((_, i) => i % 3 === 0);

  // "Now" marker: find the current hour position.
  const now = new Date();
  const nowHM =
    now.getHours() + now.getMinutes() / 60;
  let nowX: number | null = null;
  let nowY: number | null = null;
  let nowTemp: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const hd = new Date(points[i].h.time);
    const hHM = hd.getHours() + hd.getMinutes() / 60;
    if (hHM <= nowHM) {
      const prev = i > 0 ? points[i - 1] : null;
      const prevHM = prev ? new Date(prev.h.time).getHours() + new Date(prev.h.time).getMinutes() / 60 : null;
      if (prev && prevHM !== null && hHM > prevHM) {
        const frac = (nowHM - prevHM) / (hHM - prevHM);
        nowX = prev.x + (points[i].x - prev.x) * frac;
        nowY = prev.y + (points[i].y - prev.y) * frac;
        nowTemp = prev.h.temperature + (points[i].h.temperature - prev.h.temperature) * frac;
      } else {
        nowX = points[i].x;
        nowY = points[i].y;
        nowTemp = points[i].h.temperature;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={g1} stopOpacity="0.45" />
          <stop offset="100%" stopColor={g2} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={g2} />
          <stop offset="100%" stopColor={g1} />
        </linearGradient>
      </defs>

      {/* Y-axis gridlines + labels. */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={L}
            y1={t.y}
            x2={L + plotW}
            y2={t.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={L - 8}
            y={t.y + 5}
            fill="rgba(255,255,255,0.55)"
            fontSize="16"
            fontFamily="monospace"
            textAnchor="end"
          >
            {Math.round(t.v)}°
          </text>
        </g>
      ))}

      {/* Smooth area + line. */}
      <path d={areaD} fill="url(#tempGrad)" />
      <path
        d={lineD}
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots every 3 hours. */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i % 3 === 0 ? 3.5 : 0}
          fill={lineColor}
        />
      ))}

      {/* X-axis: hour labels + weather icons. */}
      {xTicks.map((p, i) => (
        <g key={i}>
          <text
            x={p.x}
            y={top + plotH + 24}
            fill="rgba(255,255,255,0.5)"
            fontSize="14"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {fmtHour(p.h.time)}時
          </text>
          <WeatherIcon code={p.h.weatherCode} cx={p.x} cy={top + plotH + 48} size={26} />
        </g>
      ))}

      {/* "Now" marker: vertical line + dot + current temp badge. */}
      {nowX !== null && nowY !== null && (
        <g>
          <line
            x1={nowX}
            y1={top}
            x2={nowX}
            y2={top + plotH}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <circle cx={nowX} cy={nowY} r="6" fill="#fff" opacity="0.9" />
          <circle cx={nowX} cy={nowY} r="3" fill={lineColor} />
          {nowTemp !== null && (
            <g>
              <rect
                x={nowX - 28}
                y={nowY - 34}
                width="56"
                height="24"
                rx="6"
                fill="rgba(255,255,255,0.92)"
              />
              <text
                x={nowX}
                y={nowY - 17}
                fill="#0f172a"
                fontSize="15"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {nowTemp.toFixed(1)}°
              </text>
            </g>
          )}
        </g>
      )}
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
  const bg = c ? skyGradient(c.weatherCode) : skyGradient(0);
  const tColor = c ? tempColor(c.weatherCode) : "text-amber-200";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {/* Background gradient (changes with the weather). */}
      <div
        className="absolute inset-0 opacity-90"
        style={{ background: bg }}
      />

      {/* Header. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
            ⛅
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              朝会前のひととき
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
            {/* Top: current weather + today summary (2 columns). */}
            <div className="flex min-h-0 flex-1 gap-4">
              {/* Column 1: Current conditions (hero). */}
              <div className="flex w-[42%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-5xl leading-none">{c!.emoji}</span>
                  <div>
                    <p className="text-2xl font-bold">{c!.label}</p>
                    <p className="text-sm text-white/50">
                      {fmtTime(c!.time)} 現在
                    </p>
                  </div>
                </div>
                <p
                  className={`font-mono text-8xl font-bold leading-none tabular-nums ${tColor}`}
                >
                  {Math.round(c!.temperature)}
                  <span className="text-4xl font-medium">°C</span>
                </p>
                <p className="mt-2 font-mono text-base tabular-nums text-white/60">
                  体感 {Math.round(c!.apparentTemperature)}°C
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-white/50">湿度</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                      {c!.humidity}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-white/50">風</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                      {c!.windDirectionLabel} {c!.windSpeed.toFixed(1)}
                      <span className="ml-0.5 text-xs font-normal text-white/40">
                        m/s
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Column 2: Today summary. */}
              <div className="flex w-[58%] flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-3 text-sm font-medium text-white/50">
                  今日の天気
                </p>
                <div className="flex items-end gap-6">
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-white/50">
                      最高気温
                    </p>
                    <p className="font-mono text-5xl font-bold tabular-nums text-orange-300">
                      {Math.round(d!.maxTemp)}
                      <span className="text-2xl font-medium">°C</span>
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-white/50">
                      最低気温
                    </p>
                    <p className="font-mono text-5xl font-bold tabular-nums text-sky-300">
                      {Math.round(d!.minTemp)}
                      <span className="text-2xl font-medium">°C</span>
                    </p>
                  </div>
                  <div className="mb-1 flex flex-col">
                    <p className="text-xs font-medium text-white/50">
                      降水確率
                    </p>
                    <p className="font-mono text-3xl font-bold tabular-nums text-blue-200">
                      {d!.maxPrecipProb}
                      <span className="text-xl font-medium">%</span>
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">🌅</span>
                    <div>
                      <p className="text-[11px] text-white/50">日の出</p>
                      <p className="font-mono text-xl font-bold tabular-nums">
                        {fmtTime(d!.sunrise)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">🌇</span>
                    <div>
                      <p className="text-[11px] text-white/50">日の入り</p>
                      <p className="font-mono text-xl font-bold tabular-nums">
                        {fmtTime(d!.sunset)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Rule-based one-line summary (replaces the tips list). */}
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-xs font-semibold text-sky-200">
                    今日の一言
                  </p>
                  <p className="text-base leading-relaxed text-white/85">
                    {weatherSummary(c!, d!)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom: hourly temperature chart (smooth spline + now marker). */}
            <div className="shrink-0" style={{ height: "38%" }}>
              <HourlyChart
                hourly={data.hourly}
                weatherCode={c!.weatherCode}
              />
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
            📈 市場データ
          </a>
          <a
            href="/steel"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            🏭 鉄鋼業 →
          </a>
        </div>
      </footer>
    </div>
  );
}
