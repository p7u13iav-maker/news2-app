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

export interface TideDay {
  date: string;
  /** High tide name: 大潮 / 中潮 / 小潮 / 長潮 / 若潮. */
  tideName: string;
  /** Max range of the day (cm). */
  maxRange: number;
  high: TideEvent[];
  low: TideEvent[];
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
function parseLine(line: string, index: number): TideDay | null {
  if (line.length < 136) return null;

  const ym = line.slice(72, 78).replace(/\s/g, "");
  const year = 2000 + parseInt(ym.slice(0, 2), 10);
  const month = parseInt(ym.slice(2, 4), 10);
  const day = parseInt(ym.slice(4, 6), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // High tide: 4 slots x 7 chars starting at col 80 (0-based).
  const high: TideEvent[] = [];
  const low: TideEvent[] = [];
  for (let i = 0; i < 4; i++) {
    const hRaw = line.slice(80 + i * 7, 87 + i * 7);
    const hTime = hRaw.slice(0, 4).trim();
    const hLevel = parseInt(hRaw.slice(4).trim(), 10);
    if (hTime !== "9999" && Number.isFinite(hLevel)) {
      high.push({
        time: `${hTime.slice(0, 2)}:${hTime.slice(2, 4)}`,
        level: hLevel,
      });
    }
    const lRaw = line.slice(108 + i * 7, 115 + i * 7);
    const lTime = lRaw.slice(0, 4).trim();
    const lLevel = parseInt(lRaw.slice(4).trim(), 10);
    if (lTime !== "9999" && Number.isFinite(lLevel)) {
      low.push({
        time: `${lTime.slice(0, 2)}:${lTime.slice(2, 4)}`,
        level: lLevel,
      });
    }
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
      const parsed = parseLine(line, 0);
      if (parsed && parsed.date === dateStr) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}
