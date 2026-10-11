/**
 * Fetch world steel production data from JISF "主要国粗鋼生産" Excel.
 * The world total is in column 17 (世界計).
 * Source: https://www.jisf.or.jp/data/jikeiretsu/syuyoukoku.html
 * File: /data/jikeiretsu/documents/syuyoukoku_s_YYYYMM.xls
 */

import * as XLSX from "xlsx";

/** Country-level crude steel production (million tonnes). */
export interface CountryProduction {
  name: string;
  value: number;
}

export interface WorldSteelMonth {
  year: number;
  month: number;
  period: string;
  /** World crude steel production in million tonnes. */
  worldCrudeSteel: number;
  /** Japan crude steel production in million tonnes. */
  japanCrudeSteel: number;
  /** China crude steel production in million tonnes. */
  chinaCrudeSteel: number;
  /** Country-level breakdown for stacked bar chart. */
  byCountry: CountryProduction[];
  /** YoY change for world production (%). */
  yoy: number;
}

/**
 * Fetch world and major countries crude steel production from JISF Excel.
 * Returns the last N months of data (newest last).
 */
export async function fetchWorldSteelProduction(months = 12): Promise<WorldSteelMonth[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Try the latest 3 candidates (data is published ~2 months behind)
  const candidates: { y: number; m: number }[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const d = new Date(currentYear, currentMonth - 1 - offset, 1);
    candidates.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const { y, m } of candidates) {
    const suffix = `${String(y).slice(2)}${String(m).padStart(2, "0")}`;
    const url = `https://www.jisf.or.jp/data/jikeiretsu/documents/syuyoukoku_s_${suffix}.xls`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const data = parseJisfWorldXls(buf);
      if (data.length > 0) {
        return data.slice(-months);
      }
    } catch {
      continue;
    }
  }

  // Fallback: try current year January
  const fallbackUrl = `https://www.jisf.or.jp/data/jikeiretsu/documents/syuyoukoku_s_${String(currentYear).slice(2)}01.xls`;
  const res = await fetch(fallbackUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error("Failed to fetch JISF world production data");
  const buf = Buffer.from(await res.arrayBuffer());
  const data = parseJisfWorldXls(buf);
  if (data.length === 0) throw new Error("No world production data found in JISF file");
  return data.slice(-months);
}

/** Parse the JISF world production Excel and extract monthly data. */
function parseJisfWorldXls(buf: Buffer): WorldSteelMonth[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const results: WorldSteelMonth[] = [];
  let currentYear = 0;

  for (const row of rows) {
    const col0 = row[0];
    const col2 = row[2];

    // Year column
    if (typeof col0 === "number" && col0 >= 2000 && col0 <= 2100) {
      currentYear = col0;
    }

    // Month column: must be a clean single number 1-12 (rejects quarterly
    // rows like " 7～ 9" or " 1～ 3" which parseInt would otherwise truncate).
    // January is written as " 1月" (with the 月 character), so strip it.
    const col2Str = String(col2 ?? "").trim().replace(/月$/, "");
    if (!/^\d{1,2}$/.test(col2Str)) continue;
    const monthVal = parseInt(col2Str, 10);
    if (
      monthVal >= 1 &&
      monthVal <= 12 &&
      currentYear > 0
    ) {
      const japan = row[3]; // 日本
      const china = row[4]; // 中国
      const world = row[17]; // 世界計

      if (
        typeof japan === "number" &&
        typeof china === "number" &&
        typeof world === "number"
      ) {
        // Country-level data (cols 3-16) for stacked bar chart.
        const countryCols: [number, string][] = [
          [3, "日本"],
          [4, "中国"],
          [5, "韓国"],
          [6, "台湾"],
          [7, "ベトナム"],
          [8, "インド"],
          [9, "イラン"],
          [10, "トルコ"],
          [11, "ロシア"],
          [12, "ドイツ"],
          [13, "米国"],
          [14, "ブラジル"],
          [15, "メキシコ"],
          [16, "EU27"],
        ];
        const byCountry: CountryProduction[] = [];
        for (const [col, name] of countryCols) {
          const v = row[col];
          if (typeof v === "number" && v > 0) {
            byCountry.push({ name, value: v / 1000 });
          }
        }
        // "Other" = world total minus all listed countries.
        const listedTotal = byCountry.reduce((s, c) => s + c.value, 0);
        const other = world / 1000 - listedTotal;
        if (other > 0.05) {
          byCountry.push({ name: "その他", value: other });
        }

        results.push({
          year: currentYear,
          month: monthVal,
          period: `${currentYear}年${monthVal}月`,
          japanCrudeSteel: japan / 1000, // Convert from thousand tonnes to million tonnes
          chinaCrudeSteel: china / 1000,
          worldCrudeSteel: world / 1000,
          byCountry,
          yoy: 0, // Will calculate later
        });
      }
    }
  }

  // Remove duplicates
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const key = `${r.year}-${r.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Calculate YoY
  for (let i = 0; i < unique.length; i++) {
    const current = unique[i];
    const prevYear = unique.find(
      (r) => r.year === current.year - 1 && r.month === current.month,
    );
    if (prevYear && prevYear.worldCrudeSteel > 0) {
      current.yoy =
        ((current.worldCrudeSteel - prevYear.worldCrudeSteel) /
          prevYear.worldCrudeSteel) *
        100;
    }
  }

  return unique;
}
