"use client";

import { useEffect, useState } from "react";

/**
 * Japan precipitation map: shows today's forecast precipitation for major
 * Japanese cities as colored markers on a simplified Japan outline.
 *
 * Data: Open-Meteo (no API key). Each city gets a dot colored by
 * precipitation probability (blue scale).
 */

interface City {
  name: string;
  lat: number;
  lon: number;
}

// 12 major cities across Japan (west to east).
const CITIES: City[] = [
  { name: "北九州", lat: 33.89, lon: 130.86 },
  { name: "福岡", lat: 33.59, lon: 130.4 },
  { name: "広島", lat: 34.39, lon: 132.45 },
  { name: "大阪", lat: 34.69, lon: 135.5 },
  { name: "京都", lat: 35.01, lon: 135.77 },
  { name: "名古屋", lat: 35.18, lon: 136.9 },
  { name: "東京", lat: 35.68, lon: 139.69 },
  { name: "横浜", lat: 35.46, lon: 139.62 },
  { name: "新潟", lat: 37.9, lon: 139.03 },
  { name: "仙台", lat: 38.27, lon: 140.87 },
  { name: "札幌", lat: 43.06, lon: 141.35 },
  { name: "那覇", lat: 26.21, lon: 127.68 },
];

interface CityPrecip {
  name: string;
  lat: number;
  lon: number;
  precip: number; // precipitation probability %
  weatherCode: number;
}

// Map viewBox: Japan roughly spans lat 26-46, lon 127-146.
const VB = { x: 125, y: 24, w: 24, h: 24 };

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - VB.x) / VB.w) * 100;
  const y = ((VB.y + VB.h - lat) / VB.h) * 100;
  return { x, y };
}

// Color scale: 0% → transparent, 100% → deep blue.
function precipColor(p: number): string {
  if (p < 10) return "rgba(59,130,246,0.25)";
  if (p < 30) return "rgba(59,130,246,0.5)";
  if (p < 60) return "rgba(37,99,235,0.7)";
  if (p < 80) return "rgba(29,78,216,0.85)";
  return "rgba(23,37,84,0.95)";
}

function precipRadius(p: number): number {
  if (p < 10) return 2.5;
  if (p < 30) return 3.5;
  if (p < 60) return 4.5;
  if (p < 80) return 5.5;
  return 6.5;
}

// Simplified Japan outline (rough polygon).
const JAPAN_OUTLINE: string[] = [
  "15,72", "18,68", "22,65", "26,62", "30,58", "34,55", "38,50",
  "42,45", "46,40", "50,35", "54,30", "58,25", "62,22", "66,20",
  "70,22", "72,26", "74,30", "76,35", "78,40", "80,45", "82,50",
  "84,55", "86,58", "88,62", "90,65", "92,68", "94,70", "90,72",
  "86,70", "82,68", "78,65", "74,62", "70,58", "66,55", "62,50",
  "58,46", "54,42", "50,38", "46,34", "42,30", "38,28", "34,26",
  "30,24", "26,22", "22,20", "18,22", "15,26", "12,32", "10,40",
  "8,48", "6,56", "5,64", "10,70",
];

export default function JapanPrecipMap() {
  const [cities, setCities] = useState<CityPrecip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const results = await Promise.all(
          CITIES.map(async (c): Promise<CityPrecip> => {
            try {
              const url =
                `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
                `&daily=precipitation_probability_max,weather_code&timezone=Asia/Tokyo&forecast_days=1`;
              const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
              if (!res.ok) throw new Error("fetch failed");
              const j = await res.json();
              return {
                name: c.name,
                lat: c.lat,
                lon: c.lon,
                precip: j.daily?.precipitation_probability_max?.[0] ?? 0,
                weatherCode: j.daily?.weather_code?.[0] ?? 0,
              };
            } catch {
              return { name: c.name, lat: c.lat, lon: c.lon, precip: 0, weatherCode: 0 };
            }
          }),
        );
        if (!cancelled) setCities(results);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/40">降水マップを取得できませんでした</p>
      </div>
    );
  }

  if (!cities) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/40">降水マップを読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Japan outline. */}
        <polygon
          points={JAPAN_OUTLINE.join(" ")}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.5"
        />

        {/* City markers. */}
        {cities.map((c, i) => {
          const { x, y } = project(c.lat, c.lon);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={precipRadius(c.precip)}
                fill={precipColor(c.precip)}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.3"
              />
              <text
                x={x}
                y={y - precipRadius(c.precip) - 1}
                fill="rgba(255,255,255,0.7)"
                fontSize="3"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {c.name}
              </text>
              <text
                x={x}
                y={y + precipRadius(c.precip) + 3.5}
                fill="rgba(255,255,255,0.6)"
                fontSize="2.5"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {c.precip}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend. */}
      <div className="absolute bottom-1 left-2 flex items-center gap-2 text-[10px] text-white/50">
        <span>降水確率</span>
        <div className="flex items-center gap-1">
          {[10, 30, 60, 90].map((p) => (
            <span
              key={p}
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: precipColor(p) }}
            />
          ))}
        </div>
        <span>低 → 高</span>
      </div>
    </div>
  );
}
