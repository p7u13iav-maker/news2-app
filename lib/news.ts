import { cacheLife, cacheTag } from "next/cache";
import {
  fetchHeadlines,
  mergeArticles,
  type Article,
} from "./newsApi";

/**
 * Cache tag used to invalidate the news cache on-demand. The morning cron
 * calls revalidateTag("news") after a fresh fetch so the page picks up the
 * new headlines on the next request (stale-while-revalidate).
 */
export const NEWS_TAG = "news";

/**
 * Cached access to the morning news.
 *
 * - `cacheLife('minutes')` keeps the page fresh without hammering NewsAPI on
 *   every request (1 min revalidate / 5 min stale / 1 h expire).
 * - `cacheTag(NEWS_TAG)` lets the cron force an on-demand invalidation every
 *   morning so the very first visitor of the day gets the freshest batch.
 *
 * This runs in a `'use cache'` scope, so it is NOT called from a Route
 * Handler (the cron revalidates the tag instead of calling this directly).
 */
export async function getMorningNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAG);

  const hasKey = Boolean(process.env.GNEWS_KEY);
  if (!hasKey) return [];

  try {
    // 日本語のトップニュース(jp)を取得
    const japan = await fetchHeadlines();
    return mergeArticles([japan]);
  } catch {
    // On any upstream failure, return whatever the last successful fetch
    // cached. If there is nothing cached, an empty list is returned and the
    // page shows a friendly hint.
    return [];
  }
}
