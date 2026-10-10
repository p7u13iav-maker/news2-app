export interface Article {
  source: string;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

export const TOP_HEADLINES = 8;

const BASE = "https://gnews.io/api/v4";

/**
 * Fetch Japanese top headlines from GNews (https://gnews.io).
 *
 * GNews key is read from the GNEWS_KEY env var, set as a project-level
 * environment variable on Vercel.
 *
 * We use the /top-headlines endpoint with lang=ja & country=jp, which is
 * reliable for Japanese news (unlike NewsAPI, where country=jp returns 0).
 */
export async function fetchHeadlines(): Promise<Article[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) {
    // No key configured. Return an empty list; the UI shows a hint.
    return [];
  }

  const params = new URLSearchParams({
    lang: "ja",
    country: "jp",
    max: "20",
    apikey: key,
  });

  const res = await fetch(`${BASE}/top-headlines?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GNews request failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    articles?: Array<{
      title: string | null;
      description: string | null;
      url: string | null;
      image: string | null;
      publishedAt: string | null;
      source?: { name: string | null };
    }>;
    errors?: string[];
  };

  // GNews returns { errors: [...] } on rate-limit or quota issues.
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GNews error: ${json.errors.join(", ")}`);
  }
  if (!json.articles || json.articles.length === 0) return [];

  return json.articles
    .filter((a) => a.title && a.url)
    .map((a) => ({
      source: a.source?.name ?? "Unknown",
      title: a.title as string,
      description: a.description,
      url: a.url as string,
      urlToImage: a.image,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
    }));
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
