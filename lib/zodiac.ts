/**
 * Zodiac sign definitions and helpers for the /horoscope page.
 */

export type ZodiacKey =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type Period = "daily" | "weekly" | "monthly";

export interface ZodiacSign {
  key: ZodiacKey;
  ja: string;
  symbol: string;
  dateRange: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { key: "aries", ja: "おひつじ座", symbol: "♈", dateRange: "3/21 - 4/19" },
  { key: "taurus", ja: "おうし座", symbol: "♉", dateRange: "4/20 - 5/20" },
  { key: "gemini", ja: "ふたご座", symbol: "♊", dateRange: "5/21 - 6/21" },
  { key: "cancer", ja: "かに座", symbol: "♋", dateRange: "6/22 - 7/22" },
  { key: "leo", ja: "しし座", symbol: "♌", dateRange: "7/23 - 8/22" },
  { key: "virgo", ja: "おとめ座", symbol: "♍", dateRange: "8/23 - 9/22" },
  { key: "libra", ja: "てんびん座", symbol: "♎", dateRange: "9/23 - 10/23" },
  { key: "scorpio", ja: "さそり座", symbol: "♏", dateRange: "10/24 - 11/22" },
  { key: "sagittarius", ja: "いて座", symbol: "♐", dateRange: "11/23 - 12/21" },
  { key: "capricorn", ja: "やぎ座", symbol: "♑", dateRange: "12/22 - 1/19" },
  { key: "aquarius", ja: "みずがめ座", symbol: "♒", dateRange: "1/20 - 2/18" },
  { key: "pisces", ja: "うお座", symbol: "♓", dateRange: "2/19 - 3/20" },
];

/** Map a zodiac key to its sign info. */
export function getSign(key: ZodiacKey): ZodiacSign {
  return ZODIAC_SIGNS.find((s) => s.key === key)!;
}

/** The freehoroscopeapi.com base URL. */
const API_BASE = "https://freehoroscopeapi.com/api/v1/get-horoscope";

/**
 * Fetch horoscope for all 12 signs for the given period from the free API.
 * Returns { [sign]: { date, period, sign, horoscope } }.
 */
export async function fetchAllHoroscopes(
  period: Period,
): Promise<Record<string, { date: string; period: string; sign: string; horoscope: string }>> {
  const results: Record<string, { date: string; period: string; sign: string; horoscope: string }> = {};
  await Promise.all(
    ZODIAC_SIGNS.map(async (s) => {
      const res = await fetch(`${API_BASE}/${period}?sign=${s.key}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`API ${res.status} for ${s.key}`);
      const json = await res.json();
      results[s.key] = json.data;
    }),
  );
  return results;
}

/** Today's date string in JST, used as a daily cache key. */
export function todayKey(): string {
  return new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
