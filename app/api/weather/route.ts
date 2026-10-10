import { NextResponse } from "next/server";
import {
  fetchWeatherWithLabels,
  weatherLabel,
  windDirectionJa,
  type WeatherData,
} from "@/lib/weather";

/**
 * GET /api/weather
 *
 * Fetches today's weather for Kure (Kure City, Hiroshima Prefecture) from
 * Open-Meteo (no API key required, data from JMA + global models).
 *
 * Daily cache: weather is fetched once per day, then served from cache for
 * the rest of the day (same update cycle as news/summary/market/horoscope).
 */

// In-memory daily cache: weather is fetched once per day.
const weatherCache = new Map<
  string,
  { ts: number; data: { ok: boolean; fetchedAt: number; weather: unknown } }
>();
const DAILY_CACHE_MS = 24 * 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function GET() {
  const cacheKey = "weather-" + todayKey();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DAILY_CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await fetchWeatherWithLabels();

    // Annotate with Japanese labels so the client doesn't need to know
    // Open-Meteo's code scheme.
    const current = {
      ...data.current,
      label: data.currentLabel.label,
      emoji: data.currentLabel.emoji,
      windDirectionLabel: windDirectionJa(data.current.windDirection),
    };
    const hourly = data.hourly.map((h) => ({
      ...h,
      label: weatherLabel(h.weatherCode).label,
      emoji: weatherLabel(h.weatherCode).emoji,
    }));
    const daily = {
      ...data.daily,
      label: data.dailyLabel.label,
      emoji: data.dailyLabel.emoji,
    };

    const weather: WeatherData & {
      currentLabel: { label: string; emoji: string };
      dailyLabel: { label: string; emoji: string };
    } = {
      current,
      hourly,
      daily,
      currentLabel: data.currentLabel,
      dailyLabel: data.dailyLabel,
    } as WeatherData & {
      currentLabel: { label: string; emoji: string };
      dailyLabel: { label: string; emoji: string };
    };

    const payload = { ok: true, fetchedAt: Date.now(), weather };
    weatherCache.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "Failed to fetch weather data.",
      },
      { status: 500 },
    );
  }
}
