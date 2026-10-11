"use client";

import { useEffect, useState } from "react";

/**
 * Reusable weather slide.
 *
 * Extracted from app/weather/page.tsx so the same 3-row layout (top metrics,
 * middle charts, bottom summary) can be rendered standalone (full page with
 * header/footer) or embedded inside a larger surface (embedded: true, no
 * header/footer, fills its parent).
 */

export interface WeatherCurrent {
  time: string;
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  pressureMsl: number;
  cloudCover: number;
  label: string;
  emoji: string;
  windDirectionLabel: string;
}

export interface WeatherHourly {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
  label: string;
  emoji: string;
}

export interface WeatherDaily {
  date: string;
  maxTemp: number;
  minTemp: number;
  maxPrecipProb: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipitationSum: number;
  windGustsMax: number;
  label: string;
  emoji: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily;
}

export interface TideEvent {
  time: string;
  level: number;
}

export interface TideData {
  date: string;
  tideName: string;
  maxRange: number;
  high: TideEvent[];
  low: TideEvent[];
  hourly: { hour: number; level: number }[];
}

export interface WeatherResponse {
  ok: boolean;
  fetchedAt?: number;
  weather?: WeatherData;
  tide?: TideData | null;
  error?: string;
}

/** Compact HH:MM from a tide event time. */
function fmtTideTime(time: string): string {
  return time;
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
export function skyGradient(code: number): string {
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

  if (c.windSpeed >= 20 || d.windGustsMax >= 25) parts.push("強めの風が吹く見込み、小物や帽子に注意を");

  if (d.uvIndexMax >= 8) parts.push("紫外線が非常に強い、日焼け対策を");
  else if (d.uvIndexMax >= 6) parts.push("紫外線が強い、日焼け止めをおすすめします");

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

/** Smooth tide level chart for the 24 hourly values. */
function TideChart({
  hourly,
  high,
  low,
}: {
  hourly: { hour: number; level: number }[];
  high: { time: string; level: number }[];
  low: { time: string; level: number }[];
}) {
  const W = 1000;
  const H = 320;
  if (hourly.length === 0) return null;

  const levels = hourly.map((h) => h.level);
  const min = Math.min(...levels) - 20;
  const max = Math.max(...levels) + 20;
  const range = max - min || 1;

  const L = 118;
  const B = 46;
  const plotW = W - L - 44;
  const plotH = H - B - 12;
  const top = 12;

  const step = hourly.length > 1 ? plotW / (hourly.length - 1) : 0;
  const points = hourly.map((h, i) => {
    const x = L + i * step;
    const y = top + plotH - ((h.level - min) / range) * plotH;
    return { x, y, h };
  });

  const lineD = splinePath(points);
  const areaD = `${lineD} L ${points[points.length - 1].x},${top + plotH} L ${points[0].x},${top + plotH} Z`;

  const [g1, g2] = ["#38bdf8", "#0ea5e9"];

  const yTicks = [
    { v: max, y: top },
    { v: (max + min) / 2, y: top + plotH / 2 },
    { v: min, y: top + plotH },
  ];

  const xTicks = points.filter((_, i) => i % 3 === 0);

  // "Now" marker.
  const now = new Date();
  const nowHM = now.getHours() + now.getMinutes() / 60;
  let nowX: number | null = null;
  let nowY: number | null = null;
  let nowLevel: number | null = null;
  if (points.length > 0) {
    if (nowHM <= points[0].h.hour) {
      nowX = points[0].x;
      nowY = points[0].y;
      nowLevel = points[0].h.level;
    } else if (nowHM >= points[points.length - 1].h.hour) {
      const last = points[points.length - 1];
      nowX = last.x;
      nowY = last.y;
      nowLevel = last.h.level;
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i].h.hour;
        const b = points[i + 1].h.hour;
        if (nowHM >= a && nowHM <= b) {
          const frac = b === a ? 0 : (nowHM - a) / (b - a);
          nowX = points[i].x + (points[i + 1].x - points[i].x) * frac;
          nowY = points[i].y + (points[i + 1].y - points[i].y) * frac;
          nowLevel =
            points[i].h.level + (points[i + 1].h.level - points[i].h.level) * frac;
          break;
        }
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={g1} stopOpacity="0.4" />
          <stop offset="100%" stopColor={g2} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tideLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={g2} />
          <stop offset="100%" stopColor={g1} />
        </linearGradient>
      </defs>

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
            y={t.y + 6}
            fill="rgba(255,255,255,0.55)"
            fontSize="18"
            fontFamily="monospace"
            textAnchor="end"
          >
            {Math.round(t.v)}
          </text>
        </g>
      ))}

      <path d={areaD} fill="url(#tideGrad)" />
      <path
        d={lineD}
        fill="none"
        stroke="url(#tideLineGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i % 3 === 0 ? 3.5 : 0}
          fill={g1}
        />
      ))}

      {xTicks.map((p, i) => (
        <g key={i}>
          <text
            x={p.x}
            y={top + plotH + 28}
            fill="rgba(255,255,255,0.5)"
            fontSize="16"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {p.h.hour}時
          </text>
        </g>
      ))}

      {/* High/low tide markers (positioned by exact event time + level). */}
      {high.map((h, i) => {
        const [hh, mm] = h.time.split(":").map((v) => parseInt(v, 10));
        const x = L + (hh + mm / 60) * step;
        const y = top + plotH - ((h.level - min) / range) * plotH;
        return (
          <g key={"h" + i}>
            <circle cx={x} cy={y} r="6" fill="#f472b6" opacity="0.85" />
            <text
              x={x}
              y={y - 30}
              fill="#f472b6"
              fontSize="17"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {h.time}
            </text>
            <text
              x={x}
              y={y - 11}
              fill="#f472b6"
              fontSize="18"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {h.level}cm
            </text>
          </g>
        );
      })}
      {low.map((l, i) => {
        const [hh, mm] = l.time.split(":").map((v) => parseInt(v, 10));
        const x = L + (hh + mm / 60) * step;
        const y = top + plotH - ((l.level - min) / range) * plotH;
        return (
          <g key={"l" + i}>
            <circle cx={x} cy={y} r="6" fill="#38bdf8" opacity="0.85" />
            <text
              x={x}
              y={y - 30}
              fill="#38bdf8"
              fontSize="17"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {l.time}
            </text>
            <text
              x={x}
              y={y - 11}
              fill="#38bdf8"
              fontSize="18"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {l.level}cm
            </text>
          </g>
        );
      })}

      {/* "Now" marker. */}
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
          <circle cx={nowX} cy={nowY} r="3" fill={g1} />
          {nowLevel !== null && (
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
                {Math.round(nowLevel)}
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
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
  const H = 320;
  if (hourly.length === 0) return null;

  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  const L = 118;
  const B = 46;
  const plotW = W - L - 20;
  const plotH = H - B - 12;
  const top = 12;

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

  // "Now" marker: interpolate the current position between the two hours
  // that bracket the current time (avoids snapping to a whole hour).
  const now = new Date();
  const nowHM = now.getHours() + now.getMinutes() / 60;
  let nowX: number | null = null;
  let nowY: number | null = null;
  let nowTemp: number | null = null;
  if (points.length > 0) {
    const hm = (i: number) => {
      const d = new Date(points[i].h.time);
      return d.getHours() + d.getMinutes() / 60;
    };
    if (nowHM <= hm(0)) {
      nowX = points[0].x;
      nowY = points[0].y;
      nowTemp = points[0].h.temperature;
    } else if (nowHM >= hm(points.length - 1)) {
      const last = points[points.length - 1];
      nowX = last.x;
      nowY = last.y;
      nowTemp = last.h.temperature;
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        const a = hm(i);
        const b = hm(i + 1);
        if (nowHM >= a && nowHM <= b) {
          const frac = b === a ? 0 : (nowHM - a) / (b - a);
          nowX = points[i].x + (points[i + 1].x - points[i].x) * frac;
          nowY = points[i].y + (points[i + 1].y - points[i].y) * frac;
          nowTemp =
            points[i].h.temperature +
            (points[i + 1].h.temperature - points[i].h.temperature) * frac;
          break;
        }
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto h-full w-full"
      preserveAspectRatio="xMidYMid meet"
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
            y={t.y + 6}
            fill="rgba(255,255,255,0.55)"
            fontSize="18"
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

      {/* Max/min temperature markers with values. */}
      {(() => {
        const maxIdx = temps.indexOf(Math.max(...temps));
        const minIdx = temps.indexOf(Math.min(...temps));
        const maxP = points[maxIdx];
        const minP = points[minIdx];
        const hourOf = (t: string) =>
          String(new Date(t).getHours()).padStart(2, "0");
        return (
          <>
            <g>
              <circle cx={maxP.x} cy={maxP.y} r="6" fill="#fb923c" />
              <text
                x={maxP.x}
                y={maxP.y - 30}
                fill="#fb923c"
                fontSize="17"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                {hourOf(maxP.h.time)}時
              </text>
              <text
                x={maxP.x}
                y={maxP.y - 11}
                fill="#fb923c"
                fontSize="18"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                {Math.round(maxP.h.temperature)}°
              </text>
            </g>
            <g>
              <circle cx={minP.x} cy={minP.y} r="6" fill="#38bdf8" />
              <text
                x={minP.x}
                y={minP.y - 30}
                fill="#38bdf8"
                fontSize="17"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                {hourOf(minP.h.time)}時
              </text>
              <text
                x={minP.x}
                y={minP.y - 11}
                fill="#38bdf8"
                fontSize="18"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                {Math.round(minP.h.temperature)}°
              </text>
            </g>
          </>
        );
      })()}

      {/* X-axis: hour labels (2-digit, e.g. 00時 03時) + weather icons. */}
      {xTicks.map((p, i) => (
        <g key={i}>
          <text
            x={p.x}
            y={top + plotH + 28}
            fill="rgba(255,255,255,0.5)"
            fontSize="16"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {String(new Date(p.h.time).getHours()).padStart(2, "0")}時
          </text>
          <WeatherIcon code={p.h.weatherCode} cx={p.x} cy={top + plotH + 46} size={30} />
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

/**
 * Compact tide widget: tide name (大潮/中潮/…), high/low tide times and
 * levels. Fetched from JMA 潮位表 (Mizushima, Kurashiki) on the server.
 */
function TideWidget({ tide }: { tide: TideData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {/* Header: tide name badge + range. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌊</span>
          <span className="rounded-lg bg-sky-400/20 px-2.5 py-1 text-base font-bold text-sky-200">
            {tide.tideName}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-white/45">
          潮差 {tide.maxRange}cm
        </span>
      </div>
      {/* High tides. */}
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-xs font-semibold text-rose-300">
          満潮
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {tide.high.map((h, i) => (
            <span key={i} className="font-mono text-base tabular-nums text-white/90">
              {fmtTideTime(h.time)}
              <span className="ml-1.5 text-[10px] text-white/40">
                {h.level}cm
              </span>
            </span>
          ))}
        </div>
      </div>
      {/* Low tides. */}
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-xs font-semibold text-sky-300">
          干潮
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {tide.low.map((l, i) => (
            <span key={i} className="font-mono text-base tabular-nums text-white/90">
              {fmtTideTime(l.time)}
              <span className="ml-1.5 text-[10px] text-white/40">
                {l.level}cm
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface WeatherSlideProps {
  data: WeatherData;
  tide: TideData | null;
  /**
   * When true, render only the main weather content (no header/footer) and
   * fill the parent (h-full instead of h-dvh). When false, render the full
   * standalone page exactly like /weather does.
   */
  embedded?: boolean;
}

export function WeatherSlide({ data, tide, embedded = false }: WeatherSlideProps) {
  const [clock, setClock] = useState<Date | null>(null);

  // Live clock (only needed in standalone mode with the header).
  useEffect(() => {
    if (embedded) return;
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, [embedded]);

  const c = data.current;
  const d = data.daily;
  const bg = skyGradient(c.weatherCode);
  const tColor = tempColor(c.weatherCode);

  const main = (
    <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 p-8">
      {/* Top row: unified current conditions + today overview (single full-width panel). */}
      <div className="flex shrink-0 items-center gap-8 rounded-2xl border border-white/10 bg-white/5 px-8 py-4">
        {/* Left: current hero (no temperature; sunrise/sunset stacked). */}
        <div className="flex shrink-0 items-center gap-4">
          <span className="text-5xl leading-none">{c.emoji}</span>
          <div>
            <p className="text-lg font-bold leading-tight">{c.label}</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">🌅</span>
              <div>
                <p className="text-[9px] leading-none text-white/45">日の出</p>
                <p className="font-mono text-lg font-bold leading-tight tabular-nums">
                  {fmtTime(d.sunrise)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">🌇</span>
              <div>
                <p className="text-[9px] leading-none text-white/45">日の入り</p>
                <p className="font-mono text-lg font-bold leading-tight tabular-nums">
                  {fmtTime(d.sunset)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: today overview metrics. */}
        <div className="flex flex-1 items-center justify-around gap-4">
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">最高</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-orange-300">
              {Math.round(d.maxTemp)}
              <span className="text-sm font-medium">°</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">最低</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-sky-300">
              {Math.round(d.minTemp)}
              <span className="text-sm font-medium">°</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">降水確率</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-blue-200">
              {d.maxPrecipProb}
              <span className="text-sm font-medium">%</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">降水量</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-blue-200">
              {d.precipitationSum.toFixed(1)}
              <span className="text-sm font-medium">mm</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">湿度</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums">
              {c.humidity}
              <span className="text-sm font-medium">%</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-medium text-white/50">風</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums">
              {c.windSpeed.toFixed(1)}
              <span className="text-sm font-medium">m/s</span>
            </p>
            <p className="text-[9px] text-white/40">{c.windDirectionLabel}</p>
          </div>
        </div>
      </div>

      {/* Middle row: temperature chart (left) + tide chart (right). */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-1 shrink-0 text-sm font-medium text-white/50">
            気温の推移（毎時予報）
            <span className="ml-1 text-[11px] text-white/35">単位：℃</span>
          </p>
          <div className="flex min-h-0 flex-1 flex-col">
            <HourlyChart
              hourly={data.hourly}
              weatherCode={c.weatherCode}
            />
          </div>
        </div>
        {tide && (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-sky-300/20 bg-sky-950/20 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-sky-200">
                潮汐の推移（水島・倉敷）
                <span className="ml-1 text-[11px] text-sky-200/50">単位：cm</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-400/20 px-2 py-0.5 text-xs font-bold text-sky-200">
                  {tide.tideName}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/40">
                  潮差 {tide.maxRange}cm
                </span>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <TideChart
                hourly={tide.hourly}
                high={tide.high}
                low={tide.low}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: today's summary only (compact height). */}
      <div className="shrink-0">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
          <p className="shrink-0 text-sm font-semibold text-sky-200">
            今日の一言
          </p>
          <p className="mt-1 text-base leading-snug text-white/85">
            {weatherSummary(c, d)}
          </p>
        </div>
      </div>
    </main>
  );

  if (embedded) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden text-white">
        {/* Sky gradient is carried by the signage background in embedded mode,
            so it isn't painted here (only the slide area would be covered). */}
        {main}
      </div>
    );
  }

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

      {main}

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
            毎朝 7:30 に更新 · 出典: Open-Meteo (JMA)
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
