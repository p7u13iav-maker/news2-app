export interface TrendingArticle {
  source: string;
  title: string;
  url: string;
  publishedAt: string;
}

export type Segment = "world" | "japan" | "sports" | "technology";

export interface TrendingData {
  world: TrendingArticle[];
  japan: TrendingArticle[];
  sports: TrendingArticle[];
  technology: TrendingArticle[];
}

export const TOP_N = 5;

/**
 * Google News RSS endpoints (public, no API key required).
 *
 * - Each query is in Japanese and scoped to `qdr:2d` (past 48 hours) so the
 *   results reflect the last two days' news.
 * - `hl=ja&gl=JP&ceid=JP:ja` keeps the results in Japanese and Japan-centric.
 * - "OR" in the query widens the net (Google News supports boolean OR).
 *
 * The `publishedAt` for a Google News item is the feed's <pubDate>. We keep
 * that as-is; the "past 48h" filter is enforced by `qdr:2d`.
 */
const GOOGLE_NEWS_FEEDS: Record<Segment, { url: string; query: string }> = {
  world: {
    query: "世界 OR 国際 OR 海外",
    // Use the dedicated world-news feed (no search query) so we get actual
    // world events rather than a keyword search that returns Japan-related
    // articles that merely mention a foreign country.
    url:
      "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ja&gl=JP&ceid=JP:ja",
  },
  japan: {
    query: "日本 OR 国内 OR 日本国内",
    url:
      "https://news.google.com/rss/search?q=%E6%97%A5%E6%9C%AC%20OR%20%E5%9B%BD%E5%86%85&hl=ja&gl=JP&ceid=JP:ja&qdr=2d",
  },
  sports: {
    query: "スポーツ OR 野球 OR サッカー OR 相撲 OR ゴルフ OR バレーボール",
    url:
      "https://news.google.com/rss/search?q=%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%82%B9%20OR%20%E5%9F%BA%E7%90%83%20OR%20%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%20OR%20%E7%9B%B8%E6%A5%BD%20OR%20%E3%82%B4%E3%83%AB%E3%83%95%20OR%20%E3%83%90%E3%83%AC%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%AB&hl=ja&gl=JP&ceid=JP:ja&qdr=2d",
  },
  technology: {
    query: "テクノロジー OR IT OR 半導体 OR AI OR 人工知能",
    url:
      "https://news.google.com/rss/search?q=%E3%83%86%E3%82%B3%E3%83%AD%E3%82%B8%E3%83%BC%20OR%20IT%20OR%20%E5%8D%8A%E5%B0%8E%E4%BD%93%20OR%20AI%20OR%20%E4%BA%BA%E5%B7%A5%E7%9F%A5%E8%83%BD&hl=ja&gl=JP&ceid=JP:ja&qdr=2d",
  },
};

const FETCH_TIMEOUT_MS = 10_000;

/** Decode HTML entities that Google News wraps around titles. */
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

/** Extract the first <tag>...</tag> from an XML fragment. */
function tagValue(xml: string, tag: string): string | null {
  const re = new RegExp(
    "<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">",
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse a Google News RSS feed. Each <item> becomes a TrendingArticle.
 *
 * Google News titles are already clean (no HTML inside), so we just decode
 * entities and trim. The <source url="..."> child gives us the publisher
 * name, which is much more useful than the raw feed label.
 */
function parseGoogleNewsItem(itemXml: string): TrendingArticle | null {
  const rawTitle = tagValue(itemXml, "title");
  if (!rawTitle) return null;
  const title = decodeEntities(rawTitle).trim();
  if (!title) return null;

  const rawLink = tagValue(itemXml, "link") ?? "";
  const url = decodeEntities(rawLink).trim();
  if (!url.startsWith("http")) return null;

  // Publisher name from <source url="...">Publisher</source>
  const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
  const source = sourceMatch ? decodeEntities(sourceMatch[1]).trim() : "Google News";

  const rawDate = tagValue(itemXml, "pubDate") ?? tagValue(itemXml, "dc:date") ?? "";
  const publishedAt =
    rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? new Date(rawDate).toISOString()
      : new Date().toISOString();

  return { source, title, url, publishedAt };
}

/**
 * Segment-level title filters. A regex that matches any of these patterns
 * in the title causes the article to be dropped from that segment (before
 * clustering / ranking).
 *
 * - "world": keep it focused on actual world/international events rather
 *   than Japanese stories that merely mention a foreign country.
 * - "japan": exclude sports (the sports segment has its own feed).
 */
const SEGMENT_TITLE_BLACKLIST: Partial<Record<Segment, RegExp[]>> = {
  world: [
    // Japanese sports
    /日本.*(サッカー|野球|ソフトボール|体操|柔道|水泳|陸上|テニス|バレー|卓球|スケート|スキー|ゴルフ|相撲|プロレス|レスリング|アーチェリー|バドミントン|フェンシング|ボクシング|カーリング|ホッケー|ハンドボール|バスケ|野球)/,
    /日本.*(代表|選手|チーム|リーグ|大会|五輪|オリンピック|パラリンピック)/,
    // Japanese domestic
    /日本.*(国内|政府|内閣|首相|総理|与野|国会|参院|衆院|都道府県|自治体|地方|地域)/,
    // "Japan" as the main subject (not as a modifier for a foreign event)
    /^日本/,
    /日本.*(が|を|は).*(発表|実施|開催|開始|終了|決定|承認|可決|否決|採択|成立|廃止|中止|延期)/,
  ],
  japan: [
    // Sports (handled by the dedicated sports segment)
    /スポーツ|野球|サッカー|ソフトボール|体操|柔道|水泳|陸上|テニス|バレー|卓球|スケート|スキー|ゴルフ|相撲|プロレス|レスリング|アーチェリー|バドミントン|フェンシング|ボクシング|カーリング|ホッケー|ハンドボール|バスケ|馬術|フェンシング|自転車|ボート|セーリング|射撃|ウエイトリフティング|空手|剣道|弓道/,
    /選手|チーム|リーグ|大会|五輪|オリンピック|パラリンピック|ワールドカップ|スーパーリーグ|J1|J2|J3|セ・リーグ|パ・リーグ|NPB|MLB|NFL|NBA|EPL|JFL|J1リーグ/,
    /監督|コーチ|キャプテン|ゴール|得点|勝利|敗北|優勝|順位|順位戦|プレーオフ|ポストシーズン|WS|CS|CS/,
  ],
};

/**
 * Returns true if the article should be excluded from the given segment.
 */
function isExcludedFromSegment(segment: Segment, title: string): boolean {
  const patterns = SEGMENT_TITLE_BLACKLIST[segment];
  if (!patterns) return false;
  for (const re of patterns) {
    if (re.test(title)) return true;
  }
  return false;
}

/**
 * Generic title filter applied to ALL segments. Drops articles whose title
 * matches any of these "tabloid / trash" patterns. We keep legitimate
 * entertainment news (film, music, theatre, game launches, industry awards)
 * but cut purely sensational / gossip / tabloid topics.
 */
const TABLOID_PATTERNS: RegExp[] = [
  // Dating / romance / relationships
  /熱愛|不倫|浮気|交際|破局|離婚|結婚|婚約|同棲/,
  // Scandals / personal issues
  /スキャンダル|不倫|浮気|不祥事|私生活|プライベート|恋愛|デート|婚約|離婚|交際/,
  // Celebrity gossip / tabloid
  /グラドル|グラビア|コスプレ|暴露|スキャンダル|不倫|熱愛/,
  // Shiny / "cute" / gossip framing
  /めっちゃ愛い|めち愛い|カワイイ|かわいい|可愛い|美|美人|美女|イケメン|美男|萌え|萌|推し活/,
  // Fan reactions
  /ファン.*興奮|ファン.*大興奮|ファン.*歓喜|ファン.*悲鳴|ファン.*騒然/,
  // Rumor / unverified
  /暴露|スクープ|衝撃の真相|衝撃|裏側|闇|闇に葬る/,
  // Clickbait
  /衝撃|驚愕|衝撃の事実|衝撃の真相|実は|意外な|意外な事実|意外な真相|意外な/,
  // Tabloid framing
  /疑惑|疑われる/,
  // Personal / family drama
  /母子|父子|親子関係|父子関係|母子関係|家族関係|家庭内/,
  // Sex / adult
  /セックス|性行為|性的|不倫|浮気|一夜/,
];

/**
 * Returns true if the article title is "too tabloid" and should be dropped
 * from every segment.
 */
function isTabloidTitle(title: string): boolean {
  for (const re of TABLOID_PATTERNS) {
    if (re.test(title)) return true;
  }
  return false;
}

/** Fetch one Google News RSS feed and parse its items. */
async function fetchSegment(segment: Segment): Promise<TrendingArticle[]> {
  const { url } = GOOGLE_NEWS_FEEDS[segment];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const xml = await res.text();

    // Split into <item>...</item> blocks.
    const items = xml
      .split(/<item(?:\s[^>]*)?[\s>]/)
      .slice(1)
      .map((block) => {
        const closeIdx = block.indexOf("</item>");
        return "<item>" + (closeIdx >= 0 ? block.slice(0, closeIdx) : block);
      });

    const out: TrendingArticle[] = [];
    for (const item of items) {
      const a = parseGoogleNewsItem(item);
      if (!a) continue;
      if (isTabloidTitle(a.title)) continue;
      if (isExcludedFromSegment(segment, a.title)) continue;
      out.push(a);
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Attention scoring ----------
 *
 * Priority (high -> low):
 *   1. Coverage — how many distinct outlets reported the same story in
 *      the past 48h. More coverage = more attention = higher rank.
 *   2. Source prestige — well-known outlets (NHK, Nikkei, Reuters, …)
 *      weigh higher. The "world" segment uses a stronger prestige weight
 *      (international outlets like Reuters / AP / BBC are more relevant
 *      for world news).
 *   3. "Readability" proxy — longer titles (with real content) tend to be
 *      the lead articles, not short follow-ups. Mild bonus.
 *   4. Recency — used only as a tiebreak within similar coverage, so a
 *      fresh version of the same story beats an older one.
 *
 *   score = 10·min(10, distinct_publishers)
 *           + prestigeWeight·prestige       (prestigeWeight = 3 for world/japan, 0.5 otherwise)
 *           + 0.5·min(5, floor(title_length / 20))
 *           + 1.0·recency           (recency = exp(-age/τ), τ = 12h)
 *
 * Story clustering:
 *   Two articles are considered the same story when ≥ 45% of their
 *   significant Japanese words (n-grams of length 2-3, with a stopword
 *   list) overlap (Jaccard). This is much more robust than the previous
 *   "first 12 characters" heuristic and correctly groups paraphrased
 *   headlines from different outlets.
 */
const RECENCY_TAU_MS = 12 * 60 * 60 * 1000;
const COVERAGE_WEIGHT = 10; // per distinct publisher (capped at 10)
const PRESTIGE_WEIGHT = 0.5; // per prestige point (prestige ∈ [1,5])
const WORLD_PRESTIGE_WEIGHT = 3; // stronger for the world segment
const JAPAN_PRESTIGE_WEIGHT = 3; // stronger for the japan segment
const LENGTH_WEIGHT = 0.5;  // per 20 chars of title (capped at 5)
const RECENCY_WEIGHT = 1.0; // tiebreak: fresher wins within similar coverage
const SIMILARITY_THRESHOLD = 0.45; // Jaccard for "same story"

/**
 * Source prestige (1-5). Well-known national / international outlets get 4-5,
 * mid-tier outlets get 3, everything else defaults to 2.
 */
const SOURCE_PRESTIGE: Record<string, number> = {
  "NHK": 5,
  "日経新聞": 5,
  "日経ビジネス": 4,
  "朝日新聞": 4,
  "毎日新聞": 4,
  "読売新聞": 4,
  "共同通信": 4,
  "ロイター": 4,
  "AFP": 4,
  "AP": 3,
  "BBC": 3,
  "Guardian": 3,
  "CNN": 3,
  "Bloomberg": 3,
  "Reuters": 3,
  "Yahoo!ニュース": 3,
  "Yahoo! JAPAN": 3,
};

function sourcePrestige(source: string): number {
  return SOURCE_PRESTIGE[source] ?? 2;
}

/** Common Japanese function words / particles to drop from the n-gram set. */
const STOPWORDS = new Set([
  "の", "に", "が", "を", "は", "と", "で", "て", "も", "や", "れ", "へ",
  "より", "まで", "から", "ため", "こと", "など", "ほか",
  "その", "これ", "それ", "あれ", "この", "あの",
  "われ", "わたくし", "自分",
  "今日", "昨日", "明日", "今年", "来年",
  "月", "日", "年", "時", "分", "秒",
  "円", "億", "万", "千",
  "日本", "世界", "国内", "海外", "国際",
]);

/**
 * Extract a set of "significant" n-grams (length 2-3) from a Japanese
 * title, dropping n-grams that are entirely stopwords or that contain
 * only ASCII (so "AI" / "IT" don't pollute the set).
 */
function titleTokens(title: string): Set<string> {
  // Strip ASCII (including spaces) and common punctuation.
  const cleaned = title.replace(/[A-Za-z0-9\s.,\/\-_:;!?'"()（）【】「」『』・、。，．！？:;'"()]+/g, " ");
  const tokens = new Set<string>();
  const s = cleaned.replace(/\s+/g, "").trim();
  if (s.length < 2) return tokens;
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i + len <= s.length; i++) {
      const gram = s.slice(i, i + len);
      if (STOPWORDS.has(gram)) continue;
      tokens.add(gram);
    }
  }
  return tokens;
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface StoryCluster {
  representative: TrendingArticle;
  publishers: Set<string>;
  members: TrendingArticle[];
}

/**
 * Cluster articles into "story" groups using Jaccard similarity on their
 * title n-gram sets. Greedy: each article joins the first cluster whose
 * similarity to the cluster representative is ≥ threshold; otherwise it
 * starts a new cluster.
 */
function clusterStories(items: TrendingArticle[]): StoryCluster[] {
  const withTokens = items.map((a) => ({ a, tokens: titleTokens(a.title) }));
  const clusters: StoryCluster[] = [];
  for (const { a, tokens } of withTokens) {
    let placed = false;
    for (const c of clusters) {
      if (jaccard(tokens, titleTokens(c.representative.title)) >= SIMILARITY_THRESHOLD) {
        c.members.push(a);
        c.publishers.add(a.source);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ representative: a, publishers: new Set([a.source]), members: [a] });
    }
  }
  return clusters;
}

function recencyFactor(ageMs: number): number {
  return Math.exp(-Math.max(0, ageMs) / RECENCY_TAU_MS);
}

function storyScore(
  a: TrendingArticle,
  nowMs: number,
  publisherCount: number,
  segment: Segment,
): number {
  const coverage = COVERAGE_WEIGHT * Math.min(10, publisherCount);
  // World and Japan segments get stronger prestige weights (international
  // outlets for world news, major national press for Japan news).
  const prestigeWeight =
    segment === "world"
      ? WORLD_PRESTIGE_WEIGHT
      : segment === "japan"
        ? JAPAN_PRESTIGE_WEIGHT
        : PRESTIGE_WEIGHT;
  const prestige = prestigeWeight * sourcePrestige(a.source);
  const length = LENGTH_WEIGHT * Math.min(5, Math.floor(a.title.length / 20));
  const ageMs = nowMs - new Date(a.publishedAt).getTime();
  const recency = RECENCY_WEIGHT * recencyFactor(ageMs);
  return coverage + prestige + length + recency;
}

/**
 * Dedupe by URL, cluster into stories, then rank.
 *
 * For each story cluster, pick the best representative (highest
 * storyScore) and emit it. Then sort the representatives by storyScore
 * desc. Cap at TOP_N.
 *
 * Because coverage dominates the score (weight 10 vs recency 1), a story
 * reported by 5 outlets in the last 24h will outrank a story reported by
 * 1 outlet 5 minutes ago.
 */
function rankByAttention(
  items: TrendingArticle[],
  nowMs: number,
  segment: Segment,
): TrendingArticle[] {
  const seen = new Set<string>();
  const unique: TrendingArticle[] = [];
  for (const a of items) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    unique.push(a);
  }

  const clusters = clusterStories(unique);
  const representatives: TrendingArticle[] = [];
  for (const c of clusters) {
    // Pick the best representative: highest coverage-aware score, tie-break
    // by freshest.
    let best = c.members[0];
    let bestScore = -Infinity;
    for (const m of c.members) {
      const s = storyScore(m, nowMs, c.publishers.size, segment);
      if (s > bestScore + 1e-9) {
        best = m;
        bestScore = s;
      }
    }
    representatives.push(best);
  }

  representatives.sort((a, b) => {
    const ca = clusters.find((c) => c.members.includes(a))!;
    const cb = clusters.find((c) => c.members.includes(b))!;
    const sa = storyScore(a, nowMs, ca.publishers.size, segment);
    const sb = storyScore(b, nowMs, cb.publishers.size, segment);
    const d = sb - sa;
    if (Math.abs(d) < 1e-9) {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
    return d;
  });

  return representatives.slice(0, TOP_N);
}

/**
 * Fetch all 4 segments in parallel. A failing segment returns an empty list
 * so one broken feed never takes down the whole page.
 */
export async function fetchTrendingNews(): Promise<TrendingData> {
  const nowMs = Date.now();
  const [world, japan, sports, technology] = await Promise.allSettled([
    fetchSegment("world"),
    fetchSegment("japan"),
    fetchSegment("sports"),
    fetchSegment("technology"),
  ]);

  const pick = (r: PromiseSettledResult<TrendingArticle[]>) =>
    r.status === "fulfilled" ? r.value : [];

  return {
    world: rankByAttention(pick(world), nowMs, "world"),
    japan: rankByAttention(pick(japan), nowMs, "japan"),
    sports: rankByAttention(pick(sports), nowMs, "sports"),
    technology: rankByAttention(pick(technology), nowMs, "technology"),
  };
}
