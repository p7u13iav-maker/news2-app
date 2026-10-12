import { cacheLife, cacheTag } from "next/cache";
import {
  fetchHeadlines,
  fetchArticleMeta,
  type Article,
} from "./newsApi";
import { fetchTrendingNews, type TrendingArticle } from "./trending";

/**
 * Cache tag used to invalidate the news cache on-demand.
 */
export const NEWS_TAG = "news";

/**
 * Enrich a trending article (already a direct-source article — NHK /
 * Nikkei / BBC / Guardian) with lead text + og:image.
 *
 * NHK's RSS already carries the lead text in <description>; for NHK we
 * only need to fetch the image (og:image). Nikkei's RSS has neither, so we
 * fetch both. BBC / Guardian already carry a description in the RSS; for
 * them we only fetch the image (when not already present — in practice
 * these two are excluded from NO_ENRICH_SOURCES in newsApi.ts because
 * their article pages are often slow overseas).
 *
 * All 8 enrichment fetches run in parallel (~1-2s total).
 */
async function enrichArticles(articles: TrendingArticle[]): Promise<Article[]> {
  const enriched = await Promise.all(
    articles.map(async (a): Promise<Article> => {
      // For NHK we trust the RSS description (full lead paragraph) and only
      // need the og:image.
      // For Nikkei we need both.
      // For BBC/Guardian the RSS description is already the lead; only the
      // image is missing (usually).
      const isNikkei = a.source.startsWith("日経");
      const isNhk = a.source === "NHK";
      const isInternational = a.source === "BBC" || a.source === "Guardian";

      // Fetch the article page for og:image (and og:description for Nikkei).
      let description: string | null = null;
      let image: string | null = null;

      // NHK's RSS <description> is the full lead paragraph — we don't have
      // it here (TrendingArticle doesn't carry it), so we still need to
      // fetch the page for the description. In practice the og:description
      // on the article page matches the RSS description.
      const meta = await fetchArticleMeta(a.url, isNikkei);
      if (meta) {
        description = meta.description;
        image = meta.image;
      }

      return {
        source: a.source,
        title: a.title,
        description: description ?? null,
        url: a.url,
        urlToImage: image ?? null,
        publishedAt: a.publishedAt,
      };
    }),
  );

  // Filter out any that failed completely (no description AND no image).
  // Keep them with null fields rather than dropping — the slide still
  // shows the title + source.
  return enriched;
}

/**
 * Cached access to the morning news.
 *
 * The signage news slides come from the trending pipeline (4 segments ×
 * top 2 = 8 slides). Each article is enriched with a lead paragraph +
 * og:image by fetching the article page directly (NHK / Nikkei / BBC /
 * Guardian all return og:image reliably).
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
