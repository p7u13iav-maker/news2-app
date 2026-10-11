/**
 * JISF 受注統計 (order statistics) parser.
 *
 * Source: https://www.jisf.or.jp/data/jikeiretsu/jyuchu.html
 * File: /data/jikeiretsu/documents/Jyuchu_s_YYMM.xls
 *
 * Sheet "普・用途別" has monthly order data by sector:
 *   col 0: 年月
 *   col 1: 合計 (total)
 *   col 2: 内需計 (domestic demand)
 *   col 3: 建設用 (construction)
 *   col 14: 産業機械用 (industrial machinery)
 *   col 16: 電気機械用 (electrical machinery)
 *   col 18: 船舶用 (ships)
 *   col 19: 自動車用 (automobiles)
 *   col 20: 鉄道車両用 (railway vehicles)
 *   col 21: その他輸送機械 (other transport machinery)
 *   col 27: 輸出 (export)
 *
 * Units: トン (tonnes). Convert to 万トン by dividing by 10,000.
 * Data lags ~1.5 months (1.5ヶ月後開示).
 */

import * as XLSX from "xlsx";

export interface OrderMonth {
  year: number;
  month: number;
  /** Total orders (10k tonnes). */
  total: number;
  /** Domestic demand (10k tonnes). */
  domestic: number;
  /** Construction (10k tonnes). */
  construction: number;
  /** Industrial machinery (10k tonnes). */
  machinery: number;
  /** Electrical machinery (10k tonnes). */
  electrical: number;
  /** Ships (10k tonnes). */
  ships: number;
  /** Automobiles (10k tonnes). */
  automobiles: number;
  /** Railway vehicles (10k tonnes). */
  railway: number;
  /** Other transport machinery (10k tonnes). */
  otherTransport: number;
  /** Export (10k tonnes). */
  export: number;
}

/**
 * Fetch order statistics from JISF.
 * Returns the last N months of data (newest last).
 */
export async function fetchOrderStatistics(months = 12): Promise<OrderMonth[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Order data lags ~1.5 months, so try a few candidates.
  const candidates: { y: number; m: number }[] = [];
  for (let offset = 1; offset <= 4; offset++) {
    const d = new Date(currentYear, currentMonth - 1 - offset, 1);
    candidates.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const { y, m } of candidates) {
    const suffix = `${String(y).slice(2)}${String(m).padStart(2, "0")}`;
    const url = `https://www.jisf.or.jp/data/jikeiretsu/documents/Jyuchu_s_${suffix}.xls`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const data = parseOrderXls(buf);
      if (data.length > 0) {
        return data.slice(-months);
      }
    } catch {
      continue;
    }
  }

  return [];
}

/** Parse the JISF order statistics Excel (普・用途別 sheet). */
function parseOrderXls(buf: Buffer): OrderMonth[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets["普・用途別"];
  if (!sheet) return [];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const results: OrderMonth[] = [];
  let currentYear = 0;

  for (const row of rows) {
    const col0 = String(row[0] ?? "").trim();

    // Year detection
    const yearMatch = col0.match(/(\d{4})/);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1], 10);
    }

    // Month detection: pure number 1-12. January is written as
    // "2026年  1月" (year + 年 + month + 月) while other months are just
    // " 2", " 3", etc., so strip 年 / 月 and any surrounding year digits
    // before validating.
    const col0Str = col0.replace(/年.*$/g, "").replace(/月/g, "").replace(/\D/g, "");
    if (!/^\d{1,2}$/.test(col0Str)) continue;
    const monthVal = parseInt(col0Str, 10);
    if (monthVal < 1 || monthVal > 12 || currentYear < 2020) continue;

    const total = Number(row[1]);
    if (!Number.isFinite(total) || total === 0) continue;

    results.push({
      year: currentYear,
      month: monthVal,
      // Convert トン to 万トン (divide by 10,000)
      total: total / 10000,
      domestic: Number(row[2]) / 10000,
      construction: Number(row[3]) / 10000,
      machinery: Number(row[14]) / 10000,
      electrical: Number(row[16]) / 10000,
      ships: Number(row[18]) / 10000,
      automobiles: Number(row[19]) / 10000,
      railway: Number(row[20]) / 10000,
      otherTransport: Number(row[21]) / 10000,
      export: Number(row[27]) / 10000,
    });
  }

  // Dedupe
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.year}-${r.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
