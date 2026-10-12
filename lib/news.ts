import { cacheLife, cacheTag } from "next/cache";
import {
  fetchHeadlines,
  fetchArticleMeta,
  type Article,
} from "./newsApi";
import { fetchTrendingNews, type TrendingArticle } from "./trending";

/**
 * Cache tag used to invalidate the news cache on-demand. The morning cron
 * calls revalidateTag("news") after a fresh fetch so the page picks up the
 * new headlines on the next request (stale-while-revalidate).
 */
export const NEWS_TAG = "news";

/**
 * Enrich a Google News article with a lead paragraph + og:image by
 * resolving the Google News redirect URL to the actual article page.
 *
 * Uses the free r.jina.ai reader (no API key required) to fetch the
 * article content. The reader follows the Google News redirect and
 * returns the article's markdown, from which we extract the first
 * paragraph as the lead text.
 *
 * Returns null if the resolution fails (e.g. jina.ai is down or the
 * article is paywalled).
 */
async function enrichGoogleNewsArticle(
  a: TrendingArticle,
): Promise<{ description: string | null; urlToImage: string | null }> {
  if (!a.url.startsWith("https://news.google.com/")) {
    // Not a Google News URL — try direct meta fetch.
    const meta = await fetchArticleMeta(a.url, false);
    return {
      description: meta?.description ?? null,
      urlToImage: meta?.image ?? null,
    };
  }

  try {
    const jinaUrl = "https://r.jina.ai/" + encodeURIComponent(a.url);
    const res = await fetch(jinaUrl, {
      headers: { "User-Agent": "MorningNewsBot/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { description: null, urlToImage: null };
    const text = await res.text();

    // Extract the lead paragraph: first non-empty, non-heading, non-link
    // line after the "Markdown Content:" marker.
    const mdStart = text.indexOf("Markdown Content:");
    const body = mdStart >= 0 ? text.slice(mdStart + 17) : text;
    const lines = body.split("\n").map((l) => l.trim());
    let description: string | null = null;
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith("#") || line.startsWith("[")) continue;
      if (line.startsWith("*") || line.startsWith("-")) continue;
      if (line.length < 20) continue;
      description = line.slice(0, 400);
      break;
    }

    // Extract the first image URL from the markdown.
    const imgMatch = body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    const urlToImage = imgMatch ? imgMatch[1] : null;

    return { description, urlToImage };
  } catch {
    return { description: null, urlToImage: null };
  }
}

/**
 * Cached access to the morning news.
 *
 * - `cacheLife('minutes')` keeps the page fresh without re-fetching the RSS
 *   feeds on every request (1 min revalidate / 5 min stale / 1 h expire).
 * - `cacheTag(NEWS_TAG)` lets the cron force an on-demand invalidation every
 *   morning so the very first visitor of the day gets the freshest batch.
 *
 * This runs in a `'use cache'` scope, so it is NOT called from a Route
 * Handler (the cron revalidates the tag instead of calling this directly).
 *
 * The signage news slides now come from the trending API (4 segments × top
 * 2 = 8 slides). Each article is enriched with a lead paragraph + image by
 * resolving the Google News redirect URL via the r.jina.ai reader.
 */
export async function getMorningNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAG);

  try {
    // Fetch the 4 trending segments (world / japan / sports / technology).
    const trending = await fetchTrendingNews();
    // Take the top 2 from each segment → 8 slides total.
    const top2: TrendingArticle[] = [
      ...trending.world.slice(0, 2),
      ...trending.japan.slice(0, 2),
      ...trending.sports.slice(0, 2),
      ...trending.technology.slice(0, 2),
    ];
    // Enrich each article with a lead paragraph + image (parallel).
    const enriched = await Promise.all(
      top2.map(async (a) => {
        const { description, urlToImage } =
          await enrichGoogleNewsArticle(a);
        return {
          source: a.source,
          title: a.title,
          description: description ?? null,
          url: a.url,
          urlToImage: urlToImage ?? null,
          publishedAt: a.publishedAt,
        } as Article;
      }),
    );
    return enriched;
  } catch {
    // Fallback: if the trending API fails, use the legacy RSS headlines.
    try {
      return await fetchHeadlines(["NHK", "日経新聞", "日経ビジネス"]);
    } catch {
      return [];
    }
  }
}
