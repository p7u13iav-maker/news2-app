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
function trimToLastSentence(s: string): string {
  const parts = s.split("。");
  if (parts.length < 2) return s;
  const last = parts[parts.length - 1];
  // If the text ends with "。", the final segment is empty; re-append the
  // period to the previous segment so the last sentence keeps its "。".
  return last === "" ? parts[parts.length - 2] + "。" : last;
}

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
      const isNikkei = a.source.startsWith("日経");

      const meta = await fetchArticleMeta(a.url, isNikkei);
      let description: string | null = null;
      let image: string | null = null;

      if (meta) {
        // Cut the lead text to its last sentence for the signage display.
        description = meta.description ? trimToLastSentence(meta.description) : null;
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
 * Cached access to the morning news.
 *
 * The signage news slides come from the trending pipeline (4 segments ×
 * top 2 = 8 slides). Each article is enriched with a lead paragraph (trimmed
 * to its last sentence) + og:image by fetching the article page directly.
 */
export async function getMorningNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAG);

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
