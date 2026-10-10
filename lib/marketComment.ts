/**
 * Rule-based market commentary generator.
 *
 * Takes the fetched market series (3-month daily closes) and produces a short
 * Japanese "one-liner" that summarizes what moved over the period. No AI /
 * Gemini involved, so it works instantly and is never rate-limited.
 */

export interface MarketSeries {
  key: string;
  label: string;
  unit: "%" | "";
  points: { t: number; v: number }[];
}

/** Direction bucket for a percentage change over the period. */
type Trend = "up-strong" | "up" | "flat" | "down" | "down-strong";

function trendOf(pct: number, strongPct = 3, flatPct = 0.5): Trend {
  if (pct >= strongPct) return "up-strong";
  if (pct >= flatPct) return "up";
  if (pct <= -strongPct) return "down-strong";
  if (pct <= -flatPct) return "down";
  return "flat";
}

/** Short human phrase for a trend + its sign. */
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
 * Build the commentary. Each sentence focuses on one area (yields, US stocks,
 * JP stocks). Missing series are skipped.
 */
export function buildMarketComment(markets: MarketSeries[]): string {
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

  const sentences: string[] = [];

  // --- Yields (US 10Y / 2Y) ---
  const y10 = stat("us10y");
  const y2 = stat("us2y");
  if (y10 && y2) {
    const t10 = trendOf(y10.pct, 0.5, 0.15);
    const t2 = trendOf(y2.pct, 0.5, 0.15);
    if (t10 === "flat" && t2 === "flat") {
      sentences.push(
        `米国の金利はほぼ横ばいで、10年金利は${fmtNum(y10.last, false)}%、2年は${fmtNum(
          y2.last,
          false,
        )}%です。`,
      );
    } else {
      sentences.push(
        `米国の金利は${trendPhrase(t10)}で、10年金利は${fmtNum(
          y10.last,
          false,
        )}%、2年は${fmtNum(y2.last, false)}%と推移しています。`,
      );
    }
  }

  // --- US stocks (S&P 500 / NASDAQ) ---
  const sp = stat("sp500");
  const nd = stat("nasdaq");
  if (sp && nd) {
    const tsp = trendOf(sp.pct);
    const inde =
      tsp === "up-strong"
        ? "堅調な上昇"
        : tsp === "up"
          ? "上昇"
          : tsp === "flat"
            ? "小幅な値動き"
            : tsp === "down"
              ? "下落"
              : "軟調な展開";
    sentences.push(
      `米国株は${inde}で、S&P 500は${fmtNum(sp.last, true)}(+${fmtNum(
        sp.pct,
        false,
      )}%)、NASDAQは${fmtNum(nd.last, true)}です。`,
    );
  }

  // --- JP stocks (Nikkei / JFE) ---
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
              : "軟調";
    sentences.push(
      `日本株は${nj}で、日経平均は${fmtNum(
        nk.last,
        true,
      )}円(3ヶ月で${nk.diff >= 0 ? "+" : ""}${fmtNum(nk.diff, true)}円)、JFEは${fmtNum(
        jfe.last,
        true,
      )}円です。`,
    );
  }

  if (sentences.length === 0) {
    return "市場データを取得中です。";
  }
  return sentences.join("");
}

/** Convenience: pass the API `markets` array straight in. */
export function marketCommentFor(
  markets: MarketSeries[],
): string {
  return buildMarketComment(markets);
}
