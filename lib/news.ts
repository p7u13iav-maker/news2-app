import { cacheLife, cacheTag } from "next/cache";
import {
  fetchHeadlines,
  fetchArticleMeta,
  type Article,
} from "./newsApi";
import { fetchTrendingNews, type TrendingArticle } from "./trending";
import { resolveGoogleNewsUrls } from "./resolveGoogleNews";

/**
 * Cache tag used to invalidate the news cache on-demand.
 */
export const NEWS_TAG = "news";

/** Extract og:description / og:image from an HTML page. */
function extractMeta(html: string): {
  description: string | null;
  image: string | null;
} {
  const metaContent = (name: string): string | null => {
    const re = new RegExp(
      '<meta[^>]+(?:property|name)="' +
        name +
        '"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="' +
        name +
        '"',
    );
    const m = html.match(re);
    return m ? m[1] || m[2] || null : null;
  };

  const decodeEntities = (s: string): string =>
    s
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
        String.fromCodePoint(parseInt(n, 16)),
      )
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, "&");

  const rawDesc =
    metaContent("og:description") ?? metaContent("description");
  let description: string | null = null;
  if (rawDesc) {
    const plain = decodeEntities(rawDesc).replace(/\s+/g, " ").trim();
    if (plain.length > 0) description = plain.slice(0, 400);
  }

  const rawImg = metaContent("og:image") ?? metaContent("twitter:image");
  let image: string | null = null;
  if (rawImg) {
    const img = decodeEntities(rawImg).trim();
    if (img.startsWith("http")) image = img;
  }

  return { description, image };
}

/**
 * Keyword-based matching: find a direct-RSS article (NHK / Nikkei / BBC /
 * Guardian) whose title shares enough 2-3 char n-grams with a trending
 * title. Returns the matched article or null.
 */
function matchTrendingToDirect(
  trendingTitle: string,
  pool: Article[],
): Article | null {
  // Extract 2-3 char n-grams from Japanese text.
  const ngrams = (title: string): Set<string> => {
    const s = title
      .replace(/[A-Za-z0-9\s.,\/\-_:;!?'"()（）【】「」『』・、。，．！？:;'"()]+/g, " ")
      .replace(/\s+/g, "");
    const grams = new Set<string>();
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i + len <= s.length; i++) {
        grams.add(s.slice(i, i + len));
      }
    }
    return grams;
  };

  const trendGrams = ngrams(trendingTitle);
  if (trendGrams.size === 0) return null;

  let best: Article | null = null;
  let bestScore = 0;
  for (const a of pool) {
    const aGrams = ngrams(a.title);
    if (aGrams.size === 0) continue;
    let inter = 0;
    for (const g of trendGrams) if (aGrams.has(g)) inter++;
    const union = trendGrams.size + aGrams.size - inter;
    const score = union === 0 ? 0 : inter / union;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  // Require at least 40% similarity.
  return bestScore >= 0.4 ? best : null;
}

/**
 * Enrich trending articles with lead text + image.
 *
 * Strategy:
 * 1. Fetch direct RSS pools (NHK, Nikkei, BBC, Guardian) in parallel.
 * 2. For each trending article, try to match a direct-RSS article by title
 *    similarity. If matched, use the direct article (guaranteed og:image).
 * 3. If no match, fall back to the batchexecute resolver + og:image fetch.
 * 4. Final fallback: jina.ai for description only.
 */
async function enrichArticles(
  trendingArticles: TrendingArticle[],
): Promise<Article[]> {
  // Step 1: Fetch direct RSS pools in parallel.
  const [nhkResult, nikkeiResult, bbcResult, guardianResult] =
    await Promise.allSettled([
      fetchHeadlines(["NHK"]),
      fetchHeadlines(["日経新聞", "日経ビジネス"]),
      fetchHeadlines(["BBC"]),
      fetchHeadlines(["Guardian"]),
    ]);
  const pick = (
    r: PromiseSettledResult<Article[]>,
  ): Article[] => (r.status === "fulfilled" ? r.value : []);
  const directPool = [
    ...pick(nhkResult),
    ...pick(nikkeiResult),
    ...pick(bbcResult),
    ...pick(guardianResult),
  ];

  const results = new Map<string, Article>();
  const unmatched: TrendingArticle[] = [];

  // Step 2: Try to match each trending article to a direct-RSS article.
  for (const t of trendingArticles) {
    const match = matchTrendingToDirect(t.title, directPool);
    if (match) {
      // Use the direct article (guaranteed og:image from RSS or meta).
      results.set(t.url, {
        source: match.source,
        title: t.title,
        description: match.description ?? null,
        url: match.url,
        urlToImage: match.urlToImage ?? null,
        publishedAt: t.publishedAt,
      });
    } else {
      unmatched.push(t);
    }
  }

  // Step 3: For unmatched articles, use batchexecute + og:image.
  if (unmatched.length > 0) {
    const gnews = unmatched.filter((a) =>
      a.url.startsWith("https://news.google.com/"),
    );
    const direct = unmatched.filter(
      (a) => !a.url.startsWith("https://news.google.com/"),
    );

    // Direct URLs (non-Google): fetch meta directly.
    await Promise.all(
      direct.map(async (a) => {
        const meta = await fetchArticleMeta(a.url, false);
        results.set(a.url, {
          source: a.source,
          title: a.title,
          description: meta?.description ?? null,
          url: a.url,
          urlToImage: meta?.image ?? null,
          publishedAt: a.publishedAt,
        });
      }),
    );

    // Google News URLs: batch resolve, then fetch meta.
    if (gnews.length > 0) {
      const resolvedMap = await resolveGoogleNewsUrls(
        gnews.map((a) => a.url),
      );
      await Promise.all(
        gnews.map(async (a) => {
          const realUrl = resolvedMap.get(a.url);
          if (realUrl) {
            try {
              const res = await fetch(realUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                  accept: "text/html",
                },
                signal: AbortSignal.timeout(8_000),
              });
              if (res.ok) {
                const html = await res.text();
                const meta = extractMeta(html);
                if (meta.image) {
                  results.set(a.url, {
                    source: a.source,
                    title: a.title,
                    description: meta.description ?? null,
                    url: a.url,
                    urlToImage: meta.image,
                    publishedAt: a.publishedAt,
                  });
                  return;
                }
              }
            } catch {
              // fall through
            }
          }
          // Title-only fallback (no jina — keeps things fast and reliable).
          results.set(a.url, {
            source: a.source,
            title: a.title,
            description: null,
            url: a.url,
            urlToImage: null,
            publishedAt: a.publishedAt,
          });
        }),
      );
    }
  }

  return trendingArticles.map((a) => results.get(a.url)!).filter(Boolean);
}

/**
 * Cached access to the morning news.
 *
 * The signage news slides come from the trending API (4 segments × top
 * 2 = 8 slides). Each article is enriched with a lead paragraph + image:
 *   1. Match trending titles to direct RSS (NHK/Nikkei/BBC/Guardian) —
 *      these have guaranteed og:image.
 *   2. Unmatched: batchexecute decode → og:image from the real article.
 *   3. Final fallback: title only.
 */
export async function getMorningNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAG);

  try {
    const trending = await fetchTrendingNews();
    const top2: TrendingArticle[] = [
      ...trending.world.slice(0, 2),
      ...trending.japan.slice(0, 2),
      ...trending.sports.slice(0, 2),
      ...trending.technology.slice(0, 2),
    ];
    return await enrichArticles(top2);
  } catch {
    try {
      return await fetchHeadlines(["NHK", "日経新聞", "日経ビジネス"]);
    } catch {
      return [];
    }
  }
}
