export interface Article {
  source: string;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

export const TOP_HEADLINES = 8;

/**
 * RSS feed sources. Each is fetched directly over HTTPS (no API key required).
 * NHK provides general news, GIGAZINE provides tech/science news.
 */
const FEEDS = [
  {
    label: "NHK",
    url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
  },
  {
    label: "GIGAZINE",
    url: "https://gigazine.net/news/rss_2.0/1/",
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
    const plain = decodeEntities(unwrapCdata(rawDesc)).replace(/<[^>]+>/g, " ");
    description = plain.replace(/\s+/g, " ").trim().slice(0, 220) || null;
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
    // Split into <item>...</item> blocks.
    const items = xml
      .split(/<item[\s>]/)
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

/**
 * Fetch all configured RSS feeds in parallel. A failing feed is skipped so a
 * single broken source never takes down the whole page.
 */
export async function fetchHeadlines(): Promise<Article[]> {
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f)),
  );
  const lists = results
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled")
    .map((r) => r.value);
  return mergeArticles(lists);
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
