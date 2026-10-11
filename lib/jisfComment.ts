/**
 * Fetch JISF 鉄鋼生産概況月次 qualitative comment (official text summary).
 *
 * Source: https://www.jisf.or.jp/data/seisan/month.html
 * This page contains the monthly crude steel production overview in Japanese,
 * with a headline and bullet points (○) explaining trends.
 *
 * Returns { period, headline, bullets } where bullets are the key points.
 */

export interface JisfComment {
  /** Report period, e.g. "2026年8月". */
  period: string;
  /** Publication date, e.g. "2026年9月24日". */
  published: string;
  /** Headline, e.g. "8月粗鋼生産666万トン、前月比3.9％減、前年同月比0.4％増". */
  headline: string;
  /** Key bullet points (cleaned). */
  bullets: string[];
}

/**
 * Fetch the JISF production overview comment.
 * Returns null if parsing fails.
 */
export async function fetchJisfComment(): Promise<JisfComment | null> {
  const url = "https://www.jisf.or.jp/data/seisan/month.html";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const html = new TextDecoder("shift_jis").decode(buf);
    return parseJisfComment(html);
  } catch {
    return null;
  }
}

/** Parse the JISF comment from the HTML. */
function parseJisfComment(html: string): JisfComment | null {
  // Strip scripts and tags, normalize whitespace.
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Period: "鉄鋼生産概況2026年8月"
  const periodMatch = clean.match(/鉄鋼生産概況(\d{4})年(\d{1,2})月/);
  if (!periodMatch) return null;
  const period = `${periodMatch[1]}年${periodMatch[2]}月`;

  // Publication date: "2026年9月24日発表"
  const publishedMatch = clean.match(/(\d{4}年\d{1,2}月\d{1,2}日)発表/);
  const published = publishedMatch ? publishedMatch[1] : "";

  // Headline: the line with "粗鋼生産...万トン、前月比...前年同月比..."
  // Appears right after "発表".
  const headlineMatch = clean.match(
    /発表\s*(\d{1,2}月粗鋼生産[\d.,]+万トン、前月比[\d.]+％[増減]、前年同月比[\d.]+％[増増])/,
  );
  const headline = headlineMatch ? headlineMatch[1].trim() : "";

  // Bullet points: items starting with ○
  const bullets: string[] = [];
  const bulletRe = /○\s*([^○]+)/g;
  let m;
  while ((m = bulletRe.exec(clean)) !== null) {
    const text = m[1].trim();
    // Skip if it's navigation/footer text
    if (text.length < 20) continue;
    if (text.includes("問合せ先") || text.includes("ページの先頭")) continue;
    // Truncate very long bullets to a reasonable length
    bullets.push(text.length > 180 ? text.slice(0, 180) + "…" : text);
    if (bullets.length >= 5) break;
  }

  if (!headline && bullets.length === 0) return null;

  return { period, published, headline, bullets };
}
