/**
 * Fetch world steel production data from statorigin.org (sourced from worldsteel).
 * License: CC BY 4.0 (attributed to worldsteel)
 */

export interface WorldSteelMonth {
  year: number;
  month: number;
  period: string;
  /** World crude steel production in million tonnes. */
  worldCrudeSteel: number;
  /** Japan crude steel production in million tonnes (if available). */
  japanCrudeSteel?: number;
  /** YoY change for world production (%). */
  yoy: number;
}

/**
 * Fetch world and Japan crude steel production data.
 * Returns the last N months of data (newest last).
 */
export async function fetchWorldSteelProduction(months = 12): Promise<WorldSteelMonth[]> {
  const url = "https://statorigin.org/api/v1/indicators/crude-steel-production/export.csv";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error("Failed to fetch worldsteel data");
  const csv = await res.text();
  return parseWorldSteelCsv(csv).slice(-months);
}

/** Parse the statorigin CSV and extract worldsteel production data. */
function parseWorldSteelCsv(csv: string): WorldSteelMonth[] {
  const lines = csv.split("\n");
  const header = lines[0].split(",");
  const results: WorldSteelMonth[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser (handles quoted fields)
    const fields = parseCsvLine(line);
    if (fields.length < 30) continue;

    const region = fields[3]; // region name
    const regionCode = fields[4]; // GLOBAL, JP, etc.
    const period = fields[5]; // e.g. "July 2026"
    const periodStart = fields[6]; // e.g. "2026-07-01"
    const valueNumeric = parseFloat(fields[29]); // last column: value_numeric

    if (Number.isNaN(valueNumeric)) continue;

    // Extract year and month from period_start
    const [yearStr, monthStr] = periodStart.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (year < 2020) continue; // Only recent data

    // Find existing entry for this month (world data)
    let entry = results.find((r) => r.year === year && r.month === month);

    if (!entry) {
      entry = {
        year,
        month,
        period,
        worldCrudeSteel: 0,
        yoy: 0,
      };
      results.push(entry);
    }

    if (regionCode === "GLOBAL" || region === "Global") {
      entry.worldCrudeSteel = valueNumeric;
    } else if (regionCode === "JP" || region === "Japan") {
      entry.japanCrudeSteel = valueNumeric;
    }
  }

  // Sort by date
  results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Calculate YoY
  for (let i = 0; i < results.length; i++) {
    const current = results[i];
    const prevYear = results.find(
      (r) => r.year === current.year - 1 && r.month === current.month,
    );
    if (prevYear && prevYear.worldCrudeSteel > 0) {
      current.yoy =
        ((current.worldCrudeSteel - prevYear.worldCrudeSteel) /
          prevYear.worldCrudeSteel) *
        100;
    }
  }

  return results;
}

/** Parse a CSV line handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}
