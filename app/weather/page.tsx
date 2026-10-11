"use client";

import { useEffect, useState } from "react";
import {
  WeatherSlide,
  type WeatherData,
  type TideData,
  type WeatherResponse,
} from "@/components/WeatherSlide";

/**
 * Dedicated weather signage page.
 *
 * Shows today's weather for Kure (Kure City, Hiroshima Prefecture) full-screen
 * with current conditions, an hourly temperature chart, and sunrise/sunset.
 * Data comes from Open-Meteo (no API key, JMA + global models). Refreshed
 * once daily at 6:30 via the cron (same as news/summary/market/horoscope).
 */

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [tide, setTide] = useState<TideData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch weather (cached daily server-side).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j: WeatherResponse) => {
        if (cancelled) return;
        if (j.ok && j.weather) {
          setData(j.weather);
          setTide(j.tide ?? null);
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

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-white/60">{error}</p>
        </div>
      ) : !data ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-white/60">天気データを読み込み中…</p>
        </div>
      ) : (
        <WeatherSlide data={data} tide={tide} />
      )}
    </div>
  );
}
