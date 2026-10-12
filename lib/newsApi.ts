export interface Article {
  source: string;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  /** Trending segment the article was classified into (if any). */
  segment?: "world" | "japan" | "sports" | "technology";
}

export const TOP_HEADLINES = 10;

/**
 * RSS feed sources. Each is fetched directly over HTTPS (no API key required).
 *
 * - NHK NEWS WEB (new domain, effective 2025-10-01): RSS 2.0 feeds under
 *   news.web.nhk. Each feed's <description> already contains the article's
 *   lead paragraph (full free body text), so no per-article fetch is needed
 *   for the body. The image (og:image) is still fetched per article.
 *   Several category feeds are combined so we reliably have 10+ fresh items:
 *   cat0 = 主要ニュース, cat1 = 社会, cat5 = 経済, cat6 = 国際
 *
 * - 日経新聞 (business): RDF 1.0 feed of Nikkei business news.
 * - 日経ビジネス: RSS 2.0 feed of Nikkei Business electronic edition.
 *   The body text (lead paragraph) and image (og:image) are fetched per
 *   article from the article's HTML page, since the RSS feeds do not include
 *   them. Nikkei's lead text is longer, so we trim it to the first sentence
 *   (up to the second "。") to keep the signage display clean.
 */
const FEEDS = [
  {
    label: "NHK",
    url: "https://news.web.nhk/n-data/conf/na/rss/cat0.xml",
  },
  {
    label: "NHK",
    url: "https://news.web.nhk/n-data/conf/na/rss/cat1.xml",
  },
  {
    label: "NHK",
    url: "https://news.web.nhk/n-data/conf/na/rss/cat5.xml",
  },
  {
    label: "NHK",
    url: "https://news.web.nhk/n-data/conf/na/rss/cat6.xml",
  },
  {
    label: "日経新聞",
    url: "https://assets.wor.jp/rss/rdf/nikkei/business.rdf",
  },
  {
    label: "日経ビジネス",
    url: "https://business.nikkei.com/rss/sns/nb.rdf",
  },
  // Sports: Nishinippon Shimbun (Kyushu regional paper with national sports
  // coverage — MLB, J.League, Ekiden, Sumo, etc.). Verified: 30 items,
  // 100% og:image + og:description.
  {
    label: "西日本新聞",
    url: "https://www.nishinippon.co.jp/feed",
  },
  // Sports: Football Channel (soccer-focused, also covers J.League, EPL,
  // and general sports). Verified: 10 items, 100% og:image + og:description.
  {
    label: "Football Channel",
    url: "https://www.footballchannel.jp/feed",
  },
  // Sports: Nikkan Sports (日刊スポーツ) — major national sports paper with
  // dedicated Atom feeds per sport. Verified: 10-20 items/feed, 100%
  // og:image + og:description.
  {
    label: "日刊スポーツ",
    url: "https://www.nikkansports.com/sports/atom.xml",
  },
  {
    label: "日刊スポーツ",
    url: "https://www.nikkansports.com/baseball/atom.xml",
  },
  {
    label: "日刊スポーツ",
    url: "https://www.nikkansports.com/soccer/atom.xml",
  },
  {
    label: "日刊スポーツ",
    url: "https://www.nikkansports.com/baseball/mlb/atom.xml",
  },
  {
    label: "日刊スポーツ",
    url: "https://www.nikkansports.com/battle/sumo/atom.xml",
  },
  // Sports: Asahi Shimbun (朝日新聞) — major national paper with a
  // dedicated sports RSS. Verified: 10 items, 100% og:image + og:description.
  {
    label: "朝日新聞",
    url: "https://www.asahi.com/rss/asahi/sports.rdf",
  },
  // Technology: ITmedia — Japan's largest tech media group (ITmedia News,
  // エンタープライズ, PC USER, Mobile, AI+, ビジネスオンライン). Verified:
  // 50 items, 100% og:image + og:description.
  {
    label: "ITmedia",
    url: "https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml",
  },
  // Technology: Gizmodo Japan — consumer tech, gadgets, AI, space. Verified:
  // 20 items, 100% og:image + og:description.
  {
    label: "Gizmodo",
    url: "https://gizmodo.jp/feed/",
  },
];

/**
 * Sources that already carry a usable <description> in their RSS feed, so we
 * skip the extra per-article page fetch for them (keeps the request fast).
 */
const NO_ENRICH_SOURCES = new Set<string>([]);

const FETCH_TIMEOUT_MS = 10_000;

/** Decode common HTML entities that appear in RSS (e.g. &amp; &#45; &lt;). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Unwrap CDATA if present, then decode entities. */
function unwrapCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

/** Extract a single XML tag value from a string (non-greedy). */
function tagValue(xml: string, tag: string): string | null {
  const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** Parse one RSS <item> block into an Article. Returns null on bad items. */
function parseItem(itemXml: string, source: string): Article | null {
  const rawTitle = tagValue(itemXml, "title");
  if (!rawTitle) return null;
  const title = decodeEntities(unwrapCdata(rawTitle)).trim();
  if (!title) return null;

  const rawLink = tagValue(itemXml, "link") ?? "";
  let url = decodeEntities(unwrapCdata(rawLink)).trim();
  // Normalise http -> https and drop stray whitespace.
  if (url.startsWith("http://")) url = url.replace("http://", "https://");
  if (!url.startsWith("http")) return null;

  const rawDesc = tagValue(itemXml, "description");
  let description: string | null = null;
  if (rawDesc) {
    const plain = decodeEntities(unwrapCdata(rawDesc)).replace(/<[^>]+>/g, " ");
    description = plain.replace(/\s+/g, " ").trim().slice(0, 400) || null;
  }

  // Image: prefer <enclosure ... type="image/...">, then <img src> in description.
  let urlToImage: string | null = null;
  const enc = itemXml.match(
    /<enclosure[^>]+url="([^"]+)"[^>]+type="image\/[^"]*"/,
  );
  if (enc) urlToImage = decodeEntities(enc[1]);
  if (!urlToImage && rawDesc) {
    const img = rawDesc.match(/<img[^>]+src="([^"]+)"/);
    if (img) urlToImage = decodeEntities(img[1]);
  }

  const rawDate =
    tagValue(itemXml, "pubDate") ?? tagValue(itemXml, "dc:date") ?? "";
  const publishedAt =
    rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? new Date(rawDate).toISOString()
      : new Date().toISOString();

  return {
    source,
    title,
    description,
    url,
    urlToImage,
    publishedAt,
  };
}

/** Fetch and parse a single RSS feed into an Article list. */
async function fetchFeed(feed: {
  label: string;
  url: string;
}): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MorningNewsBot/1.0; +https://news2-app-p7u13iav.vercel.app)",
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${feed.url}`);
    }
    const xml = await res.text();
    // Split into <item>...</item> blocks. Matches both RSS 2.0 (<item>) and
    // RDF 1.0 (<item rdf:about="...">) item openings.
    const items = xml
      .split(/<item(?:\s[^>]*)?[\s>]/)
      .slice(1)
      .map((block) => {
        // Re-attach the opening tag so tagValue works on the full item.
        const closeIdx = block.indexOf("</item>");
        return "<item>" + (closeIdx >= 0 ? block.slice(0, closeIdx) : block);
      });
    const out: Article[] = [];
    for (const item of items) {
      const a = parseItem(item, feed.label);
      if (a) out.push(a);
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

interface ArticleMeta {
  description: string | null;
  image: string | null;
}

/**
 * Keep a lead text up to its last complete sentence. If the text ends in the
 * middle of a sentence (no trailing "。"), cut back to the last "。" so the
 * display never shows a dangling fragment. A trailing "。" is preserved.
 *
 *   "AAA。BBB。"        -> "AAA。BBB。"   (already ends on a sentence)
 *   "AAA。BBB"          -> "AAA。"        (drop the partial "BBB")
 *   "AAA。BBB。CCC"      -> "AAA。BBB。CCC"
 *   "No period here"    -> "No period here"
 *
 * "。" is a UTF-16 surrogate pair, so we locate the cut by re-joining the
 * split parts rather than slicing at a raw index.
 */
function cutToLastCompleteSentence(s: string): string {
  const parts = s.split("。");
  if (parts.length < 2) return s;
  // Last part empty => text already ends with "。": return as-is.
  if (parts[parts.length - 1] === "") return s;
  // Otherwise the last part is a partial sentence: drop it and re-append "。".
  return parts.slice(0, -1).join("。") + "。";
}

/**
 * Extract a <meta> tag's content attribute by name/property, regardless of
 * attribute order in the tag.
 */
function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    '<meta[^>]+(?:property|name)="' +
      name +
      '"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="' +
      name +
      '"',
  );
  const m = html.match(re);
  return m ? m[1] || m[2] || null : null;
}

/**
 * Fetch the lead paragraph (body text) and article image for an article by
 * reading its <meta> tags from the HTML page. Used for Nikkei, whose RSS does
 * not include the body text. The image (og:image) is also used for NHK, whose
 * RSS does include the body text but not the image.
 *
 * When `trimDescription` is true (Nikkei), the lead text is trimmed to the
 * first sentence (up to the second "。").
 *
 * Returns null if the article can't be fetched at all.
 *
 * Exported so the trending pipeline (lib/news.ts) can enrich Google News
 * redirect URLs with a lead paragraph + og:image.
 */
export async function fetchArticleMeta(url: string): Promise<ArticleMeta | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "text/html",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Lead text: prefer og:description, then meta description.
    const rawDesc =
      metaContent(html, "og:description") ?? metaContent(html, "description");
    let description: string | null = null;
    if (rawDesc) {
      const plain = decodeEntities(rawDesc).replace(/\s+/g, " ").trim();
      if (plain.length > 0) {
        // Show the full lead text, but if it ends mid-sentence, cut back to
        // the last complete "。" so the display never shows a fragment.
        description = cutToLastCompleteSentence(plain);
      }
    }

    // Image: og:image (twitter:image fallback).
    let image: string | null = null;
    const rawImg = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
    if (rawImg) {
      const img = decodeEntities(rawImg).trim();
      if (img.startsWith("http")) image = img;
    }

    return { description, image };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch configured RSS feeds in parallel, then enrich each article from its
 * article page.
 *
 * `sources` (optional) limits which feed labels are included. When omitted,
 * ALL feeds (NHK + Nikkei + sports + tech) are returned. The digital-
 * signage page passes `["NHK", "日経新聞", "日経ビジネス"]` so it only
 * shows domestic sources.
 *
 * - NHK: body text already comes from the RSS <description>, so only the
 *   image (og:image) is fetched.
 * - Nikkei: neither the body text nor the image is in the RSS, so both are
 *   fetched. The lead text is trimmed to the first sentence (up to the second
 *   "。") because Nikkei's og:description is longer.
 *
 * A failing feed is skipped so a single broken source never takes down the
 * whole page. Fetches are best-effort: if one fails, the article is kept
 * without that field.
 */
export async function fetchHeadlines(
  sources?: string[],
): Promise<Article[]> {
  const feeds = sources ? FEEDS.filter((f) => sources.includes(f.label)) : FEEDS;
  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f)));
  const lists = results
    .filter(
      (r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled",
    )
    .map((r) => r.value);
  const merged = mergeArticles(lists);

  // Enrich from the article page. Only fetch for the top items we will
  // actually show, to limit outbound requests. All fetches run in parallel.
  const ENRICH_LIMIT = 14;
  const toEnrich = merged.slice(0, ENRICH_LIMIT);
  await Promise.all(
    toEnrich.map(async (a) => {
      if (NO_ENRICH_SOURCES.has(a.source)) return;
      if (a.urlToImage) return; // Image already present, nothing to fetch.
      const meta = await fetchArticleMeta(a.url);
      if (!meta) return;
      if (!a.urlToImage && meta.image) a.urlToImage = meta.image;
    }),
  );
  return merged;
}

/**
 * Fetch the raw RSS articles from the configured feeds WITHOUT the
 * per-article page enrichment. NHK's RSS already carries the lead paragraph
 * in <description>; for NHK the image still needs the og:image fetch, so
 * callers that need images should run the matching articles through
 * `fetchArticleMeta` afterwards (see lib/trending.ts).
 *
 * Exported so the trending pipeline (lib/trending.ts) can build its 4
 * segments from the same verified direct sources used by the signage news
 * slides.
 */
export async function fetchFeedArticles(
  sources?: string[],
): Promise<Article[]> {
  const feeds = sources ? FEEDS.filter((f) => sources.includes(f.label)) : FEEDS;
  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f)));
  const lists = results
    .filter(
      (r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled",
    )
    .map((r) => r.value);
  return mergeArticles(lists, Infinity);
}

/**
 * Dedupe by URL, sort by publishedAt desc, and cap.
 */
export function mergeArticles(
  lists: Article[][],
  max: number = TOP_HEADLINES * 3,
): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const list of lists) {
    for (const a of list) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      out.push(a);
    }
  }
  out.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return out.slice(0, max);
}
