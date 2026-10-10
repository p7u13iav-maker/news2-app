export interface Article {
  source: string;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

export const TOP_HEADLINES = 8;

const BASE = "https://newsapi.org/v2";

/**
 * Fetch top headlines (and optionally business / tech / science) for the
 * given source. NewsAPI key is read from the NEWSAPI_KEY env var, which on
 * Vercel is set as a project-level environment variable.
 */
export async function fetchHeadlines(
  source: "japan" | "world",
): Promise<Article[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) {
    // No key configured. Return an empty list; the UI shows a hint.
    return [];
  }

  // NewsAPI limits: /top-headlines 100 req/day (dev), /everything 30 req/day.
  // Top headlines is cheap and always has fresh results, so prefer it.
  const params = new URLSearchParams({
    country: source === "japan" ? "jp" : "us",
    pageSize: "20",
    apiKey: key,
  });
  if (source === "world") {
    // Add a couple of categories for a richer morning briefing.
    params.set("category", "general");
  }

  const res = await fetch(`${BASE}/top-headlines?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `NewsAPI request failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    articles?: Array<{
      source: { name: string | null };
      title: string | null;
      description: string | null;
      url: string;
      urlToImage: string | null;
      publishedAt: string | null;
    }>;
  };

  if (!json.articles || json.articles.length === 0) return [];

  return json.articles
    .filter((a) => a.title && a.url)
    .map((a) => ({
      source: a.source?.name ?? "Unknown",
      title: a.title as string,
      description: a.description,
      url: a.url,
      urlToImage: a.urlToImage,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
    }));
}

/**
 * Merge the two sources, dedupe by URL, sort by publishedAt desc, and cap.
 */
export function mergeArticles(
  lists: Article[][],
  max: number = TOP_HEADLINES * 3,
): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const list of lists) {
    for (const a of list) {
      const key = a.url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
  }
  out.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return out.slice(0, max);
}
