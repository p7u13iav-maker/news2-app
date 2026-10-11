/**
 * JISF (Japan Iron and Steel Federation) production data parser.
 *
 * Downloads the monthly production Excel from JISF and extracts
 * pig iron (銑鉄) and crude steel (粗鋼) production in 10k tons.
 *
 * Source: https://www.jisf.or.jp/data/jikeiretsu/seisan.html
 * The Excel file is at: /data/jikeiretsu/documents/seisan_s_YYYYMM.xls
 *
 * Data structure (Sheet 1: 鉄鋼生産(総括)):
 *   Row 0: Header
 *   Row 1: 年月 | | | 銑鉄 | フェロアロイ | 粗鋼 | ...
 *   Row 2: | | | 計 | | 計 | ...
 *   Row 3: | | | | | | 前年 | ...
 *   Row 4: | | | | | | 同月比 | ...
 *   Row 5-8: Annual data (2022-2025)
 *   Row 9-12: Fiscal year data
 *   Row 13-18: Quarterly data (2025-2026)
 *   Row 19-36: Monthly data (2025 Feb - 2026 Jul)
 *   Row 37: Source note
 *
 * Monthly rows have:
 *   col 0: year (e.g. 2026) or blank (same year as above)
 *   col 2: month number (e.g. " 1", " 2", ... " 12")
 *   col 3: 銑鉄 (pig iron, 10k tons)
 *   col 5: 粗鋼 (crude steel, 10k tons)
 *   col 6: 前年同月比 (%)
 */

import * as XLSX from "xlsx";

export interface ProductionMonth {
  year: number;
  month: number;
  /** Pig iron production in 10k tons. */
  pigIron: number;
  /** Crude steel production in 10k tons. */
  crudeSteel: number;
  /** Carbon steel (普通鋼) portion of crude steel, in 10k tons. */
  carbonSteel: number;
  /** Special/other steel (特殊鋼) portion of crude steel, in 10k tons. */
  specialSteel: number;
  /** Year-over-year change for crude steel (%). */
  yoy: number;
}

/**
 * Fetch and parse JISF production data.
 * Returns the last N months of production data (newest last).
 */
export async function fetchJisfProduction(months = 12): Promise<ProductionMonth[]> {
  // Determine the latest available month (usually 2 months ago).
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // JISF publishes about 2-3 months behind. Try the latest 3 candidates.
  const candidates: { y: number; m: number }[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const d = new Date(currentYear, currentMonth - 1 - offset, 1);
    candidates.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const { y, m } of candidates) {
    const suffix = `${String(y).slice(2)}${String(m).padStart(2, "0")}`;
    const url = `https://www.jisf.or.jp/data/jikeiretsu/documents/seisan_s_${suffix}.xls`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const data = parseJisfXls(buf);
      if (data.length > 0) {
        // Return last N months.
        return data.slice(-months);
      }
    } catch {
      continue;
    }
  }

  // Fallback: try the current year's file.
  const fallbackUrl = `https://www.jisf.or.jp/data/jikeiretsu/documents/seisan_s_${String(currentYear).slice(2)}01.xls`;
  const res = await fetch(fallbackUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error("Failed to fetch JISF production data");
  const buf = Buffer.from(await res.arrayBuffer());
  const data = parseJisfXls(buf);
  if (data.length === 0) throw new Error("No production data found in JISF file");
  return data.slice(-months);
}

/** Parse the JISF Excel buffer and extract monthly production data. */
function parseJisfXls(buf: Buffer): ProductionMonth[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const results: ProductionMonth[] = [];
  let currentYear = 0;

  for (const row of rows) {
    const col0 = row[0];
    const col2 = row[2];

    // Year column: a 4-digit number indicates a new year.
    if (typeof col0 === "number" && col0 >= 2000 && col0 <= 2100) {
      currentYear = col0;
    }

    // Month column: must be a clean single number 1-12 (rejects quarterly
    // rows like " 1～ 3" or " 4～ 6" which parseInt would otherwise truncate
    // to 1 or 4 and wrongly include as monthly data).
    const col2Str = String(col2 ?? "").trim();
    if (!/^\d{1,2}$/.test(col2Str)) continue;
    const monthVal = parseInt(col2Str, 10);
    if (
      monthVal >= 1 &&
      monthVal <= 12 &&
      currentYear > 0
    ) {
      const pigIron = row[3];
      const crudeSteel = row[5];
      const yoy = row[6];
      // 粗鋼 鋼種別内訳: col 13 = 普通鋼, col 14 = 特殊鋼 (1000t).
      const carbonSteel = row[13];
      const specialSteel = row[14];

      if (
        typeof pigIron === "number" &&
        typeof crudeSteel === "number"
      ) {
        // Excel values are in 千トン (thousand tonnes). Convert to 万トン
        // (10k tonnes) for display: 1万トン = 10千トン.
        // Fallback: if the split columns are missing, derive special = crude - carbon.
        const cSteel = typeof carbonSteel === "number" ? carbonSteel : 0;
        const sSteel =
          typeof specialSteel === "number"
            ? specialSteel
            : crudeSteel - cSteel;
        results.push({
          year: currentYear,
          month: monthVal,
          pigIron: pigIron / 10,
          crudeSteel: crudeSteel / 10,
          carbonSteel: cSteel / 10,
          specialSteel: sSteel / 10,
          yoy: typeof yoy === "number" ? yoy : 0,
        });
      }
    }
  }

  // Filter: only keep monthly rows (not annual/quarterly).
  // Monthly rows have months 1-12; annual rows have "年" in col 2.
  // We already filter by monthVal 1-12, so this should be clean.
  // Remove any duplicates (same year+month).
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.year}-${r.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
