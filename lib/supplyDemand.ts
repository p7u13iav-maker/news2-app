/**
 * JISF 普通鋼鋼材需給速報 (carbon steel supply-demand report) parser.
 *
 * Source: https://www.jisf.or.jp/data/zaiko/
 * File: /data/zaiko/documents/Jukyu_YYMM.xls
 *
 * Sheets:
 *   総括表 - latest month summary (production, shipments, inventory, ratio)
 *   推移表 - monthly time series (crude steel, carbon steel, shipments)
 */

import * as XLSX from "xlsx";

export interface SupplyDemandMonth {
  year: number;
  month: number;
  /** Crude steel production (crude steel, 10k tonnes). */
  crudeSteel: number;
  /** Carbon steel production (carbon steel, 10k tonnes). */
  carbonSteel: number;
  /** Total shipments (10k tonnes). */
  shipmentsTotal: number;
  /** Domestic shipments (10k tonnes). */
  shipmentsDomestic: number;
  /** Export shipments (10k tonnes). */
  shipmentsExport: number;
}

export interface SupplyDemandSummary {
  /** Report month label, e.g. "2026年8月". */
  period: string;
  /** Carbon steel production (10k tonnes). */
  production: number;
  /** Total shipments (10k tonnes). */
  shipments: number;
  /** Domestic shipments (10k tonnes). */
  shipmentsDomestic: number;
  /** Export shipments (10k tonnes). */
  shipmentsExport: number;
  /** Inventory (10k tonnes). */
  inventory: number;
  /** Inventory ratio (%). */
  inventoryRatio: number;
  /** MoM change of production (%). */
  productionMom: number;
  /** YoY change of production (%). */
  productionYoy: number;
}

/**
 * Fetch supply-demand data from JISF.
 * Returns { summary, trend } where summary is the latest month and
 * trend is the last N months of the time series.
 */
export async function fetchSupplyDemand(
  months = 12,
): Promise<{ summary: SupplyDemandSummary | null; trend: SupplyDemandMonth[] }> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const candidates: { y: number; m: number }[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const d = new Date(currentYear, currentMonth - 1 - offset, 1);
    candidates.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const { y, m } of candidates) {
    const suffix = `${String(y).slice(2)}${String(m).padStart(2, "0")}`;
    const url = `https://www.jisf.or.jp/data/zaiko/documents/Jukyu_${suffix}.xls`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const parsed = parseSupplyDemandXls(buf);
      if (parsed.summary || parsed.trend.length > 0) {
        return { summary: parsed.summary, trend: parsed.trend.slice(-months) };
      }
    } catch {
      continue;
    }
  }

  return { summary: null, trend: [] };
}

interface Parsed {
  summary: SupplyDemandSummary | null;
  trend: SupplyDemandMonth[];
}

/** Parse the JISF supply-demand Excel. */
function parseSupplyDemandXls(buf: Buffer): Parsed {
  const wb = XLSX.read(buf, { type: "buffer" });
  const summary = parseSummary(wb.Sheets["総括表"]);
  const trend = parseTrend(wb.Sheets["推移表"]);
  return { summary, trend };
}

/** Parse the 総括表 sheet (latest month summary). */
function parseSummary(sheet: XLSX.WorkSheet | undefined): SupplyDemandSummary | null {
  if (!sheet) return null;
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let period = "";
  let production = 0;
  let shipments = 0;
  let shipmentsDomestic = 0;
  let shipmentsExport = 0;
  let inventory = 0;
  let inventoryRatio = 0;
  let productionMom = 0;
  let productionYoy = 0;

  // Value column is 3; MoM(%) col 5; YoY(%) col 7.
  // Strip both ASCII and full-width (　) spaces from labels.
  const stripLabel = (v: unknown) => String(v ?? "").replace(/[\s　]+/g, "");
  let seenShipments = false;
  for (const row of rows) {
    const label = stripLabel(row[1]);
    if (label === "普通鋼鋼材生産") {
      production = Number(row[3]) || 0;
      productionMom = Number(row[5]) || 0;
      productionYoy = Number(row[7]) || 0;
    } else if (label === "普通鋼鋼材出荷") {
      shipments = Number(row[3]) || 0;
      seenShipments = true;
    } else if (label === "普通鋼鋼材在庫") {
      seenShipments = false;
      inventory = Number(row[3]) || 0;
    } else if (label === "在庫率") {
      inventoryRatio = Number(row[3]) || 0;
    } else if (seenShipments && label === "") {
      // Sub-labels (国内/輸出) are in col 2 on rows where col 1 is empty.
      const sub = stripLabel(row[2]);
      if (sub === "国内") shipmentsDomestic = Number(row[3]) || 0;
      else if (sub === "輸出") shipmentsExport = Number(row[3]) || 0;
    }
  }

  // Find period from the sheet (e.g. "2026年8月分")
  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      const s = String(cell ?? "");
      const m = s.match(/(\d{4})年(\d{1,2})月分/);
      if (m) {
        period = `${m[1]}年${m[2]}月`;
      }
    }
  }

  if (production === 0 && inventory === 0) return null;

  return {
    period,
    // Convert 1,000トン to 万トン (divide by 10)
    production: production / 10,
    shipments: shipments / 10,
    shipmentsDomestic: shipmentsDomestic / 10,
    shipmentsExport: shipmentsExport / 10,
    inventory: inventory / 10,
    inventoryRatio,
    productionMom,
    productionYoy,
  };
}

/** Parse the 推移表 sheet (monthly time series). */
function parseTrend(sheet: XLSX.WorkSheet | undefined): SupplyDemandMonth[] {
  if (!sheet) return [];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const results: SupplyDemandMonth[] = [];
  let currentYear = 0;

  for (const row of rows) {
    const col0 = String(row[0] ?? "").replace(/[\s　]+/g, "");

    // Year detection: col0 contains a 4-digit year followed by 年
    const yearMatch = col0.match(/^(\d{4})年/);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1], 10);
    }

    // Month detection: col0 ends with "N月" where N is 1-12.
    // Reject quarterly rows like "1～3" (no trailing 月, or contains ～).
    if (col0.includes("～")) continue;
    const monthMatch = col0.match(/(\d{1,2})月$/);
    if (!monthMatch) continue;
    const monthVal = parseInt(monthMatch[1], 10);
    if (monthVal < 1 || monthVal > 12 || currentYear < 2020) continue;

    const crudeSteel = Number(row[1]);
    const carbonSteel = Number(row[2]);
    const shipmentsTotal = Number(row[3]);
    const shipmentsDomestic = Number(row[4]);
    const shipmentsExport = Number(row[5]);

    if (Number.isFinite(crudeSteel) && Number.isFinite(carbonSteel)) {
      results.push({
        year: currentYear,
        month: monthVal,
        // Convert 1,000トン to 万トン
        crudeSteel: crudeSteel / 10,
        carbonSteel: carbonSteel / 10,
        shipmentsTotal: Number.isFinite(shipmentsTotal) ? shipmentsTotal / 10 : 0,
        shipmentsDomestic: Number.isFinite(shipmentsDomestic) ? shipmentsDomestic / 10 : 0,
        shipmentsExport: Number.isFinite(shipmentsExport) ? shipmentsExport / 10 : 0,
      });
    }
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
