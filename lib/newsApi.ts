export interface Article {
  source: string;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

export const TOP_HEADLINES = 10;

/**
 * RSS feed sources. Each is fetched directly over HTTPS (no API key required).
 *
 * NHK NEWS WEB (new domain, effective 2025-10-01): RSS 2.0 feeds under
 * news.web.nhk. Each feed's <description> already contains the article's lead
 * paragraph (full free body text), so no per-article fetch is needed for the
 * body. The image (og:image) is still fetched per article.
 *
 * Several category feeds are combined so we reliably have 10+ fresh items:
 *   cat0 = 主要ニュース, cat1 = 社会, cat5 = 経済, cat6 = 国際
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
];

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
    // NHK's <description> is the full lead paragraph of the article (free text).
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
 * Fetch the article image (og:image) for an article by reading its <meta> tag
 * from the HTML page. The body text already comes from the RSS <description>,
 * so only the image is needed here.
 *
 * Returns null if the article can't be fetched at all.
 */
async function fetchArticleMeta(url: string): Promise<ArticleMeta | null> {
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
      // Keep the full lead paragraph; Nikkei's og:description is the lead text.
      if (plain.length > 0) description = plain.slice(0, 400);
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
 * Fetch all configured RSS feeds in parallel, then enrich each article with
 * its image (og:image) by fetching the article page.
 *
 * A failing feed is skipped so a single broken source never takes down the
 * whole page. Image fetches are best-effort: if one fails, the article is
 * kept without an image. The body text already comes from the RSS
 * <description>, so it is never overridden here.
 */
export async function fetchHeadlines(): Promise<Article[]> {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));
  const lists = results
    .filter(
      (r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled",
    )
    .map((r) => r.value);
  const merged = mergeArticles(lists);

  // Enrich with the article image (og:image). Only fetch for the top items we
  // will actually show, to limit outbound requests. All fetches run in
  // parallel.
  const ENRICH_LIMIT = 12;
  const toEnrich = merged.slice(0, ENRICH_LIMIT);
  await Promise.all(
    toEnrich.map(async (a) => {
      if (a.urlToImage) return; // RSS already provided one.
      const meta = await fetchArticleMeta(a.url);
      if (meta?.image) a.urlToImage = meta.image;
    }),
  );
  return merged;
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
