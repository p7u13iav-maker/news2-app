/**
 * Rule-based market commentary generator.
 *
 * Returns 3 lines:
 *   1. 為替 (FX)
 *   2. 米国 (yields + stocks)
 *   3. 日本 (stocks)
 */

export interface MarketSeries {
  key: string;
  label: string;
  unit: "%" | "円" | "";
  points: { t: number; v: number }[];
}

type Trend = "up-strong" | "up" | "flat" | "down" | "down-strong";

function trendOf(pct: number, strongPct = 3, flatPct = 0.5): Trend {
  if (pct >= strongPct) return "up-strong";
  if (pct >= flatPct) return "up";
  if (pct <= -strongPct) return "down-strong";
  if (pct <= -flatPct) return "down";
  return "flat";
}

function trendPhrase(t: Trend): string {
  switch (t) {
    case "up-strong":
      return "上昇基調";
    case "up":
      return "上昇";
    case "flat":
      return "もみ合い";
    case "down":
      return "下落";
    case "down-strong":
      return "下落基調";
  }
}

function fmtNum(v: number, integer: boolean): string {
  if (integer) {
    return v.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  }
  return v.toLocaleString("ja-JP", {
    maximumFractionDigits: v < 10 ? 2 : 1,
    minimumFractionDigits: v < 10 ? 2 : 0,
  });
}

const INTEGER_KEYS = new Set(["sp500", "nasdaq", "nikkei", "jfe"]);

/**
 * Build 3 comment lines: FX, US (yields+stocks), JP (stocks).
 */
export function buildMarketComment(markets: MarketSeries[]): string[] {
  const byKey: Record<string, MarketSeries> = {};
  for (const m of markets) byKey[m.key] = m;

  const stat = (key: string) => {
    const m = byKey[key];
    if (!m || m.points.length < 2) return null;
    const first = m.points[0].v;
    const last = m.points[m.points.length - 1].v;
    const pct = first !== 0 ? ((last - first) / first) * 100 : 0;
    return { m, first, last, diff: last - first, pct };
  };

  const lines: string[] = [];

  // --- Line 1: FX ---
  const fx = stat("usdjpy");
  if (fx) {
    const dir = fx.diff >= 0 ? "円安" : "円高";
    const pctStr = Math.abs(fx.pct) >= 0.5 ? ` (${fx.pct >= 0 ? "+" : ""}${fmtNum(fx.pct, false)}%)` : "";
    lines.push(
      `為替: ${dir}傾向で、円/ドルは${fmtNum(fx.last, false)}円${pctStr}。`,
    );
  }

  // --- Line 2: US (yields + stocks) ---
  const usParts: string[] = [];
  const y10 = stat("us10y");
  const y2 = stat("us2y");
  if (y10 && y2) {
    const t10 = trendOf(y10.pct, 0.5, 0.15);
    if (t10 === "flat") {
      usParts.push(`米債10年${fmtNum(y10.last, false)}%は横ばい`);
    } else {
      usParts.push(
        `米債10年${fmtNum(y10.last, false)}%は${trendPhrase(t10)}`,
      );
    }
  }
  const sp = stat("sp500");
  const nd = stat("nasdaq");
  if (sp && nd) {
    const tsp = trendOf(sp.pct);
    const inde =
      tsp === "up-strong"
        ? "上昇基調"
        : tsp === "up"
          ? "上昇"
          : tsp === "flat"
            ? "もみ合い"
            : tsp === "down"
              ? "下落"
              : "下落基調";
    usParts.push(`S&P 500は${inde}(3ヶ月${sp.pct >= 0 ? "+" : ""}${fmtNum(sp.pct, false)}%)`);
  }
  if (usParts.length > 0) {
    lines.push(`米国: ${usParts.join("、")}。`);
  }

  // --- Line 3: JP stocks ---
  const nk = stat("nikkei");
  const jfe = stat("jfe");
  if (nk && jfe) {
    const tnk = trendOf(nk.pct);
    const nj =
      tnk === "up-strong"
        ? "上昇基調"
        : tnk === "up"
          ? "上昇"
          : tnk === "flat"
            ? "もみ合い"
            : tnk === "down"
              ? "下落"
              : "下落基調";
    lines.push(
      `日本: 日経平均は${nj}(3ヶ月${nk.diff >= 0 ? "+" : ""}${fmtNum(nk.diff, INTEGER_KEYS.has("nikkei"))}円)、JFEは${fmtNum(jfe.last, true)}円。`,
    );
  }

  if (lines.length === 0) {
    lines.push("市場データを取得中です。");
  }
  return lines;
}
