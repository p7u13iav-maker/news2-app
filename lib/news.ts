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
 * Jina.ai fallback for articles that the direct resolver can't handle
 * (e.g. paywalled or 401/403 responses).
 */
async function enrichViaJina(
  articleUrl: string,
): Promise<{ description: string | null; urlToImage: string | null }> {
  try {
    const jinaUrl = "https://r.jina.ai/" + encodeURIComponent(articleUrl);
    const res = await fetch(jinaUrl, {
      headers: { "User-Agent": "MorningNewsBot/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { description: null, urlToImage: null };
    const text = await res.text();

    const mdStart = text.indexOf("Markdown Content:");
    const body = mdStart >= 0 ? text.slice(mdStart + 17) : text;
    const lines = body.split("\n").map((l) => l.trim());

    const navWords =
      /購読|ログイン|登録|ヘルプ|トップ|速報|朝刊|社説|オピニオン|動画|写真|ビジュアル|ポッドキャスト|連載|特集|天気予報|株式|為替|ニュース速報|関連記事|コメント|シェア|メール|印刷|フォント|文字サイズ|プレゼント|キャンペーン|広告|cookie|Cookie|クッキー|会員限定|IDで|パスワード|新規取得|サインイン|Skip to/;

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

    return { description, urlToImage: null };
  } catch {
    return { description: null, urlToImage: null };
  }
}

/**
 * Enrich articles with lead text + image.
 *
 * Primary path: resolveGoogleNewsUrls → fetch each real URL → og:image.
 * Fallback: jina.ai for articles that fail the primary path.
 */
async function enrichArticles(
  articles: TrendingArticle[],
): Promise<Article[]> {
  // Split into Google News URLs and direct URLs.
  const gnews = articles.filter((a) =>
    a.url.startsWith("https://news.google.com/"),
  );
  const direct = articles.filter(
    (a) => !a.url.startsWith("https://news.google.com/"),
  );

  const results = new Map<string, Article>();

  // Direct URLs: use fetchArticleMeta.
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

  // Google News URLs: batch resolve, then fetch meta in parallel.
  if (gnews.length > 0) {
    const resolvedMap = await resolveGoogleNewsUrls(gnews.map((a) => a.url));

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
            // fall through to jina
          }
        }

        // Fallback: jina.ai for description.
        const jina = await enrichViaJina(a.url);
        results.set(a.url, {
          source: a.source,
          title: a.title,
          description: jina.description ?? null,
          url: a.url,
          urlToImage: jina.urlToImage ?? null,
          publishedAt: a.publishedAt,
        });
      }),
    );
  }

  return articles.map((a) => results.get(a.url)!).filter(Boolean);
}

/**
 * Cached access to the morning news.
 *
 * The signage news slides come from the trending API (4 segments × top
 * 2 = 8 slides). Each article is enriched with a lead paragraph + image:
 *   1. resolveGoogleNewsUrls decodes the Google News redirect URLs.
 *   2. The real article pages are fetched for og:description / og:image.
 *   3. Jina.ai fallback for articles that fail the primary path.
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
