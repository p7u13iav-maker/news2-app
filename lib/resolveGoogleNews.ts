/**
 * Resolve Google News redirect URLs to actual article URLs using Google's
 * own batchexecute decode endpoint (no API key, no external services).
 *
 * Post-2024, Google News article IDs are opaque base64 that can no longer be
 * decoded locally. Instead, the redirect page embeds a signature + timestamp
 * that the frontend uses to call `/_/DotsSplashUi/data/batchexecute` to get
 * the real URL.
 *
 * Pipeline:
 *   Phase 1: GET the redirect page → extract data-n-a-sg + data-n-a-ts.
 *   Phase 2: POST batchexecute with all articles in one call → real URLs.
 *   Phase 3: Fetch each real URL for og:description / og:image.
 *
 * Total wall time: ~2s for 8 articles (parallel where possible).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Context array required by the garturlreq protocol. */
const CTX: unknown[] = [
  ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
  "X",
  "X",
  1,
  [1, 1, 1],
  1,
  1,
  null,
  0,
  0,
  null,
  0,
];

interface ResolvedUrl {
  originalUrl: string;
  realUrl: string | null;
}

/**
 * Phase 1: Fetch the Google News redirect page and extract the decode params
 * (data-n-a-sg, data-n-a-ts). Follows redirects that stay on news.google.com.
 */
async function fetchDecodeParams(
  articleUrl: string,
): Promise<{ sg: string; ts: string } | null> {
  try {
    const res = await fetch(articleUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        referer: "https://news.google.com/",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    // Follow redirects that stay on news.google.com.
    let currentUrl = articleUrl;
    let currentRes = res;
    for (let i = 0; i < 5; i++) {
      if (currentRes.status >= 300 && currentRes.status < 400) {
        const location = currentRes.headers.get("location");
        if (!location) break;
        const nextUrl = new URL(location, currentUrl).toString();
        if (!nextUrl.includes("news.google.com")) break;
        currentUrl = nextUrl;
        currentRes = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent": UA,
            referer: "https://news.google.com/",
            accept: "text/html",
          },
          signal: AbortSignal.timeout(10_000),
        });
      } else {
        break;
      }
    }

    if (!currentRes.ok) return null;
    const html = await currentRes.text();

    const sgMatch = html.match(/data-n-a-sg="([^"]+)"/);
    const tsMatch = html.match(/data-n-a-ts="([^"]+)"/);
    if (!sgMatch || !tsMatch) return null;

    return { sg: sgMatch[1], ts: tsMatch[1] };
  } catch {
    return null;
  }
}

/**
 * Phase 2: Call batchexecute to decode all article IDs in one request.
 */
async function batchDecode(
  entries: Array<{ articleUrl: string; artId: string; sg: string; ts: string }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (entries.length === 0) return result;

  try {
    const fReq = [
      entries.map((e, i) => [
        "Fbv4je",
        JSON.stringify(["garturlreq", CTX, e.artId, Number(e.ts), e.sg]),
        null,
        String(i),
      ]),
    ];

    const body = "f.req=" + encodeURIComponent(JSON.stringify(fReq));

    const res = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": UA,
          referer: "https://news.google.com/",
        },
        body,
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) return result;
    let text = await res.text();

    // Strip the ")]}'" prefix and any leading whitespace/newlines.
    text = text.replace(/^[\s)]+'}[\n]*/m, "").trim();
    if (!text.startsWith("[")) return result;

    const rows: unknown[][] = JSON.parse(text);
    for (const row of rows) {
      if (!Array.isArray(row) || row[0] !== "wrb.fr" || row[1] !== "Fbv4je")
        continue;
      const payload = row[2];
      if (typeof payload !== "string" || !payload.startsWith('"garturlres"'))
        continue;

      // row[2] is a JSON string: "["garturlres","https://...",1]"
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed) || parsed.length < 2) continue;

      const realUrl = parsed[1];
      if (typeof realUrl !== "string" || !realUrl.startsWith("http"))
        continue;

      // Match to input index via the last non-null cell in row.slice(3).
      let idx: string | null = null;
      for (let j = row.length - 1; j >= 3; j--) {
        if (row[j] != null) {
          idx = String(row[j]);
          break;
        }
      }
      if (idx !== null && entries[Number(idx)]) {
        result.set(entries[Number(idx)].articleUrl, realUrl);
      }
    }
  } catch {
    // batchexecute failed — return empty map, caller falls back to jina.
  }

  return result;
}

/**
 * Extract the article ID from a Google News redirect URL.
 * The ID is the path segment after /rss/articles/.
 */
function extractArticleId(url: string): string | null {
  const m = url.match(/news\.google\.com\/rss\/articles\/([^?]+)/);
  return m ? m[1] : null;
}

/**
 * Resolve Google News redirect URLs to actual article URLs.
 *
 * Returns a map of originalUrl → realUrl. Articles that can't be resolved
 * are simply absent from the map (caller should fall back to jina).
 *
 * All phase-1 requests run in parallel, then a single batchexecute call
 * decodes all articles at once.
 */
export async function resolveGoogleNewsUrls(
  urls: string[],
): Promise<Map<string, string>> {
  const gnewsUrls = urls.filter((u) =>
    u.startsWith("https://news.google.com/rss/articles/"),
  );
  if (gnewsUrls.length === 0) return new Map();

  // Phase 1: fetch decode params for all articles in parallel.
  const paramResults = await Promise.all(
    gnewsUrls.map(async (url) => {
      const artId = extractArticleId(url);
      if (!artId) return null;
      const params = await fetchDecodeParams(url);
      if (!params) return null;
      return { articleUrl: url, artId, sg: params.sg, ts: params.ts };
    }),
  );

  const entries = paramResults.filter(
    (e): e is { articleUrl: string; artId: string; sg: string; ts: string } =>
      e !== null,
  );

  if (entries.length === 0) return new Map();

  // Phase 2: batch decode.
  return batchDecode(entries);
}
