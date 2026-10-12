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
 * 2 = 8 slides) instead of the raw RSS headline list, so the slideshow shows
 * the most attention-grabbing stories of the past 48 hours. Each article is
 * enriched with a lead paragraph + og:image by fetching the article's HTML
 * page (Google News redirect URLs are followed automatically).
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
    // Enrich each article with a lead paragraph + og:image (parallel).
    const enriched = await Promise.all(
      top2.map(async (a) => {
        const meta = await fetchArticleMeta(a.url, false);
        return {
          source: a.source,
          title: a.title,
          description: meta?.description ?? null,
          url: a.url,
          urlToImage: meta?.image ?? null,
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
