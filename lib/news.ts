import {
  fetchHeadlines,
  fetchArticleMeta,
  type Article,
} from "./newsApi";
import { fetchTrendingNews, type TrendingArticle } from "./trending";

/**
 * Cache tag (kept for the cron revalidate call; the news itself is now
 * fetched fresh on every request, so the tag no longer gates a cache).
 */
export const NEWS_TAG = "news";

/**
 * Cut a lead text to its last sentence: everything after the
 * second-to-last "。" is dropped, keeping the final sentence. A trailing
 * "。" on the last sentence is preserved (e.g. "AAA。BBB。" -> "BBB。").
 *
 *   "AAA。BBB。CCC。"  -> "CCC。"
 *   "AAA。BBB。CCC"    -> "CCC"
 *   "AAA。BBB。"       -> "BBB。"
 *   "AAA。BBB"         -> "BBB"
 *   "AAA"              -> "AAA"
 */
type Segment = "world" | "japan" | "sports" | "technology";

interface SegmentArticle {
  article: TrendingArticle;
  segment: Segment;
}

/**
 * Enrich a trending article (already a direct-source article) with lead
 * text + og:image. All 8 enrichment fetches run in parallel (~1-2s total).
 * The trending segment is carried through to the Article so the signage
 * slide can show which segment the story belongs to.
 */
async function enrichArticles(
  items: SegmentArticle[],
): Promise<Article[]> {
  const enriched = await Promise.all(
    items.map(async ({ article: a, segment }): Promise<Article> => {
      const meta = await fetchArticleMeta(a.url);
      let description: string | null = null;
      let image: string | null = null;

      if (meta) {
        // Keep the full lead paragraph; the slide wraps it naturally.
        description = meta.description ?? null;
        image = meta.image;
      }

      return {
        source: a.source,
        title: a.title,
        description,
        url: a.url,
        urlToImage: image,
        publishedAt: a.publishedAt,
        segment,
      };
    }),
  );
  return enriched;
}

/**
 * The signage news slides, fetched fresh on every request (no cache) so they
 * stay in sync with the trending ranking, which is also computed live.
 *
 * The 8 slides come from the trending pipeline (4 segments × top 2). Each
 * article is enriched with the full lead paragraph + og:image by fetching the
 * article page directly. The slide wraps the paragraph naturally
 * (line-clamp) rather than cutting it to one sentence.
 */
export async function getMorningNews(): Promise<Article[]> {
  try {
    const trending = await fetchTrendingNews();
    const top2: SegmentArticle[] = [
      ...trending.world.slice(0, 2).map((a) => ({ article: a, segment: "world" as const })),
      ...trending.japan.slice(0, 2).map((a) => ({ article: a, segment: "japan" as const })),
      ...trending.sports.slice(0, 2).map((a) => ({ article: a, segment: "sports" as const })),
      ...trending.technology.slice(0, 2).map((a) => ({ article: a, segment: "technology" as const })),
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
