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
 * Two-pass enrichment for Google News articles:
 *
 * Pass 1: Use r.jina.ai to follow the Google News redirect and get the
 *         article content as markdown. Extract the lead paragraph from the
 *         first substantial Japanese text line after the H1 heading.
 *         Also extract the actual article URL from share links in the
 *         markdown.
 *
 * Pass 2: Fetch the actual article page (from pass 1's URL) and read its
 *         og:image / twitter:image meta tags for the photo.
 *
 * Returns { description, urlToImage } — either can be null if not found.
 */
async function enrichGoogleNewsArticle(
  a: TrendingArticle,
): Promise<{ description: string | null; urlToImage: string | null }> {
  if (!a.url.startsWith("https://news.google.com/")) {
    const meta = await fetchArticleMeta(a.url, false);
    return {
      description: meta?.description ?? null,
      urlToImage: meta?.image ?? null,
    };
  }

  try {
    // Pass 1: jina.ai — get markdown + extract lead text + resolve URL.
    const jinaUrl = "https://r.jina.ai/" + encodeURIComponent(a.url);
    const res = await fetch(jinaUrl, {
      headers: { "User-Agent": "MorningNewsBot/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { description: null, urlToImage: null };
    const text = await res.text();

    const mdStart = text.indexOf("Markdown Content:");
    const body = mdStart >= 0 ? text.slice(mdStart + 17) : text;
    const lines = body.split("\n").map((l) => l.trim());

    // Common navigation words in site headers/footers.
    const navWords =
      /購読|ログイン|登録|ヘルプ|トップ|速報|朝刊|社説|オピニオン|動画|写真|ビジュアル|ポッドキャスト|連載|特集|天気予報|株式|為替|ニュース速報|関連記事|コメント|シェア|メール|印刷|フォント|文字サイズ|プレゼント|キャンペーン|広告|cookie|Cookie|クッキー/;

    // Extract lead paragraph: first substantial Japanese text after H1.
    let description: string | null = null;
    let foundHeading = false;
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith("#")) {
        foundHeading = true;
        continue;
      }
      if (!foundHeading) continue;
      if (line.startsWith("[") || line.startsWith("![")) continue;
      if (line.startsWith("*") || line.startsWith("-")) continue;
      if (line.length < 30) continue;
      if (!/[一-鿿]/.test(line)) continue;
      if (navWords.test(line)) continue;
      description = line.slice(0, 400);
      break;
    }

    // Extract the actual article URL from share links in the markdown.
    let articleUrl: string | null = null;
    const shareMatch = body.match(/url=(https?%3A%2F%2F[^&\s]+)/i);
    if (shareMatch) {
      articleUrl = decodeURIComponent(shareMatch[1]);
    }
    if (!articleUrl) {
      const urlRe =
        /https?:\/\/(?!news\.google|www\.google|accounts\.google|policies\.google|fonts\.googleapis|gstatic|lh[3-5]\.googleusercontent|twitter\.com|facebook\.com)[a-z0-9.-]+\.[a-z]{2,}\/[^\s"')\]]{20,}/gi;
      const urls = [...new Set(body.match(urlRe) || [])]
        .filter(
          (u) =>
            !/weather|subscribe|login|register|help|search|member|product|present|game|fukubuki|yomiuri-ryokou|yomiuriland|yomipo|komachi|tabiyomi/i.test(
              u,
            ),
        )
        .sort((a2, b2) => b2.length - a2.length);
      if (urls.length > 0) articleUrl = urls[0];
    }

    // Pass 2: fetch the article page for og:image.
    let urlToImage: string | null = null;
    if (articleUrl) {
      try {
        const artRes = await fetch(articleUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            accept: "text/html",
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (artRes.ok) {
          const html = await artRes.text();
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
          const img =
            metaContent("og:image") ?? metaContent("twitter:image");
          if (img && img.startsWith("http")) urlToImage = img;
        }
      } catch {
        // ignore — image is optional
      }
    }

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
 * The signage news slides come from the trending API (4 segments × top
 * 2 = 8 slides). Each article is enriched with a lead paragraph + image:
 *   1. r.jina.ai follows the Google News redirect → markdown (lead text).
 *   2. The actual article page is fetched for og:image (photo).
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
    try {
      return await fetchHeadlines(["NHK", "日経新聞", "日経ビジネス"]);
    } catch {
      return [];
    }
  }
}
