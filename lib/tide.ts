/**
 * JMA tide (潮位表) data for Mizushima (MIZUSHIMA, Kurashiki City).
 *
 * Source: https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/{year}/MM.txt
 * (free, no API key; JMA 潮汐・海面水位 潮位表 text edition)
 *
 * Format: fixed-width, 136 chars per line, one line per day:
 *   cols  1-72  : hourly tide level (3-digit x 24 hours, cm)
 *   cols 73-78  : year(2) month(2) day(2)
 *   cols 79-80  : station code (MM = Mizushima)
 *   cols 81-108 : high tide (満潮) x4 -> time(4, HHMM) level(3, cm)
 *   cols 109-136: low tide (干潮) x4  -> time(4) level(3)
 *   time=9999 / level=999 means "no tide" that slot.
 */

export interface TideEvent {
  /** HH:MM */
  time: string;
  /** Tide level (cm above datum). */
  level: number;
}

/** One hour of tide level for the chart. */
export interface TideHourly {
  /** 0-23 */
  hour: number;
  /** Tide level (cm above datum). */
  level: number;
}

export interface TideDay {
  date: string;
  /** High tide name: 大潮 / 中潮 / 小潮 / 長潮 / 若潮. */
  tideName: string;
  /** Max range of the day (cm). */
  maxRange: number;
  high: TideEvent[];
  low: TideEvent[];
  /** Hourly tide levels (24 values, cm). */
  hourly: TideHourly[];
}

const STATION = "MM"; // Mizushima, Kurashiki

/** Map the max daily range (cm) to a Japanese tide name. */
function tideNameFromRange(range: number): string {
  if (range >= 330) return "大潮";
  if (range >= 260) return "中潮";
  if (range >= 190) return "小潮";
  if (range >= 120) return "長潮";
  return "若潮";
}

/** Parse one fixed-width line (136 chars) into a TideDay. */
function parseLine(line: string): TideDay | null {
  if (line.length < 136) return null;

  const ym = line.slice(72, 78).replace(/\s/g, "");
  const year = 2000 + parseInt(ym.slice(0, 2), 10);
  const month = parseInt(ym.slice(2, 4), 10);
  const day = parseInt(ym.slice(4, 6), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // High tide: 4 slots x 7 chars starting at col 80 (0-based).
  // Each slot: time(4, HHMM) + level(3, cm).
  const high: TideEvent[] = [];
  for (let i = 0; i < 4; i++) {
    const hRaw = line.slice(80 + i * 7, 87 + i * 7);
    const hTimeNum = parseInt(hRaw.slice(0, 4).replace(/\s/g, ""), 10);
    const hLevel = parseInt(hRaw.slice(4).trim(), 10);
    if (hTimeNum !== 9999 && Number.isFinite(hLevel)) {
      const hh = String(Math.floor(hTimeNum / 100)).padStart(2, "0");
      const mm = String(hTimeNum % 100).padStart(2, "0");
      high.push({ time: `${hh}:${mm}`, level: hLevel });
    }
  }

  // Low tide: the JMA low-tide section uses variable-width spacing that
  // makes fixed-slot parsing unreliable. Instead, derive the low-tide
  // events from the hourly data: find local minima (points lower than
  // both neighbors) and use their hour as the approximate time.
  const hourly: TideHourly[] = [];
  for (let h = 0; h < 24; h++) {
    const raw = line.slice(h * 3, h * 3 + 3).trim();
    const v = parseInt(raw, 10);
    hourly.push({
      hour: h,
      level: Number.isFinite(v) && raw !== "999" ? v : 0,
    });
  }

  const low: TideEvent[] = [];
  for (let h = 0; h < 24; h++) {
    const prev = hourly[(h + 23) % 24].level;
    const curr = hourly[h].level;
    const next = hourly[(h + 1) % 24].level;
    // Local minimum: lower than both neighbors (handle flat minimums).
    if (curr <= prev && curr <= next && curr < 900) {
      // Skip if the previous hour is also a minimum (flat bottom).
      if (h > 0 && hourly[h - 1].level === curr) continue;
      const hh = String(h).padStart(2, "0");
      low.push({ time: `${hh}:00`, level: curr });
    }
  }
  // Keep at most 2 low-tide events (a day has at most 2).
  if (low.length > 2) {
    low.sort((a, b) => a.level - b.level);
    low.length = 2;
    low.sort((a, b) => a.time.localeCompare(b.time));
  }

  if (high.length === 0 || low.length === 0) return null;

  // Max range = max high level - min low level.
  const maxHigh = Math.max(...high.map((h) => h.level));
  const minLow = Math.min(...low.map((l) => l.level));
  const maxRange = maxHigh - minLow;

  return {
    date,
    tideName: tideNameFromRange(maxRange),
    maxRange,
    high,
    low,
    hourly,
  };
}

/**
 * Fetch tide data for a specific day (by JST date string YYYY-MM-DD).
 * Returns null if not found or fetch fails.
 */
export async function fetchTideForDay(dateStr: string): Promise<TideDay | null> {
  const [year, month, day] = dateStr.split("-").map((n) => parseInt(n, 10));
  if (!year || !month || !day) return null;

  const url = `https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/${year}/${STATION}.txt`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.length >= 136);
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed && parsed.date === dateStr) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}
