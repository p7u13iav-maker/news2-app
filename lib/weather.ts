/**
 * Weather data for Kure (Kure City, Hiroshima Prefecture, Japan).
 * Uses Open-Meteo API (no API key required, free for non-commercial use,
 * data from JMA + global models).
 *
 * Kure coordinates: 34.65°N, 133.83°E
 */

const LAT = 34.65;
const LON = 133.83;
const TIMEZONE = "Asia/Tokyo";

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
}

export interface WeatherHourly {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
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
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily;
}

/** Map Open-Meteo weather codes to Japanese descriptions + emoji. */
function weatherLabel(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "晴れ", emoji: "☀️" };
  if (code === 1) return { label: "晴れ時々くもり", emoji: "🌤" };
  if (code === 2) return { label: "くもり", emoji: "⛅" };
  if (code === 3) return { label: "曇り", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "霧", emoji: "🌫" };
  if (code >= 51 && code <= 57) return { label: "小雨", emoji: "🌦" };
  if (code >= 61 && code <= 67) return { label: "雨", emoji: "🌧" };
  if (code >= 71 && code <= 77) return { label: "雪", emoji: "🌨" };
  if (code >= 80 && code <= 82) return { label: "にわか雨", emoji: "🌧" };
  if (code >= 85 && code <= 86) return { label: "にわか雪", emoji: "🌨" };
  if (code >= 95) return { label: "雷雨", emoji: "⛈" };
  return { label: "不明", emoji: "❓" };
}

/** Convert wind direction (degrees) to Japanese compass. */
function windDirectionJa(deg: number): string {
  const dirs = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西北西", "西", "西西北", "北西", "北北西"];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

/** Fetch today's weather for Kure from Open-Meteo. */
export async function fetchWeather(): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,wind_gusts_10m_max` +
    `&timezone=${TIMEZONE}&forecast_days=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const json = await res.json();

  const current: WeatherCurrent = {
    time: json.current.time,
    temperature: json.current.temperature_2m,
    humidity: json.current.relative_humidity_2m,
    apparentTemperature: json.current.apparent_temperature,
    weatherCode: json.current.weather_code,
    windSpeed: json.current.wind_speed_10m,
    windDirection: json.current.wind_direction_10m,
    pressureMsl: json.current.pressure_msl,
    cloudCover: json.current.cloud_cover,
  };

  const hourly: WeatherHourly[] = json.hourly.time.map(
    (t: string, i: number) => ({
      time: t,
      temperature: json.hourly.temperature_2m[i],
      precipitationProbability: json.hourly.precipitation_probability?.[i] ?? 0,
      weatherCode: json.hourly.weather_code[i],
      windSpeed: json.hourly.wind_speed_10m[i],
    }),
  );

  const daily: WeatherDaily = {
    date: json.daily.time[0],
    maxTemp: json.daily.temperature_2m_max[0],
    minTemp: json.daily.temperature_2m_min[0],
    maxPrecipProb: json.daily.precipitation_probability_max[0],
    weatherCode: json.daily.weather_code[0],
    sunrise: json.daily.sunrise[0],
    sunset: json.daily.sunset[0],
    uvIndexMax: json.daily.uv_index_max[0] ?? 0,
    precipitationSum: json.daily.precipitation_sum[0] ?? 0,
    windGustsMax: json.daily.wind_gusts_10m_max[0] ?? 0,
  };

  return { current, hourly, daily };
}

/** Convenience: fetch + add Japanese labels. */
export async function fetchWeatherWithLabels(): Promise<
  WeatherData & { currentLabel: { label: string; emoji: string }; dailyLabel: { label: string; emoji: string } }
> {
  const data = await fetchWeather();
  return {
    ...data,
    currentLabel: weatherLabel(data.current.weatherCode),
    dailyLabel: weatherLabel(data.daily.weatherCode),
  };
}

export { weatherLabel, windDirectionJa };
