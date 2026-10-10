import { cacheLife, cacheTag } from "next/cache";
import { fetchHeadlines, type Article } from "./newsApi";

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
 */
export async function getMorningNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAG);

  try {
    // Digital signage shows domestic sources only (NHK + Nikkei). The
    // international feeds (BBC / Guardian) are reserved for the AI summary
    // page and are intentionally excluded here.
    return await fetchHeadlines(["NHK", "日経新聞", "日経ビジネス"]);
  } catch {
    // On any upstream failure, return an empty list; the page shows a hint.
    return [];
  }
}
