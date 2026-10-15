import { fetchFeedArticles } from "./newsApi";

export interface TrendingArticle {
  source: string;
  title: string;
  url: string;
  publishedAt: string;
}

/**
 * A single article from a Google News RSS feed, used only to count how many
 * distinct outlets are covering the same story (for the coverage bonus).
 * The article itself is NOT displayed — we only use it to build the coverage
 * index.
 */
interface GoogleNewsItem {
  title: string;
  source: string;
}

/**
 * Fetch Google News RSS for a topic and return the parsed items.
 * Used only for coverage counting, not for display.
 */
async function fetchGoogleNews(
  url: string,
): Promise<GoogleNewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "application/rss+xml, application/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml
      .split(/<item(?:\s[^>]*)?[\s>]/)
      .slice(1)
      .map((block) => {
        const closeIdx = block.indexOf("</item>");
        return "<item>" + (closeIdx >= 0 ? block.slice(0, closeIdx) : block);
      });
    const out: GoogleNewsItem[] = [];
    for (const item of items) {
      const titleMatch = item.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/);
      const sourceMatch = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/);
      if (!titleMatch || !sourceMatch) continue;
      const title = decodeXml(titleMatch[1]).trim();
      const source = decodeXml(sourceMatch[1]).trim();
      if (title && source) out.push({ title, source });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Decode XML entities. */
function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Build a coverage index from Google News RSS: maps each story (by title
 * n-gram Jaccard similarity) to the set of distinct outlets that reported it.
 * Used to count how many outlets covered the same news.
 */
async function buildCoverageIndex(
  items: GoogleNewsItem[],
): Promise<Map<string, Set<string>>> {
  // Group items by story using the same Jaccard similarity as the main
  // ranking. Returns a map from representative title -> set of outlet names.
  const withTokens = items.map((it) => ({
    it,
    tokens: titleTokens(it.title),
  }));
  const clusters: Array<{ rep: GoogleNewsItem; outlets: Set<string> }> = [];
  for (const { it, tokens } of withTokens) {
    let placed = false;
    for (const c of clusters) {
      const repTokens = titleTokens(c.rep.title);
      if (jaccard(tokens, repTokens) >= SIMILARITY_THRESHOLD) {
        c.outlets.add(it.source);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ rep: it, outlets: new Set([it.source]) });
    }
  }
  // Build a map: normalized title -> outlets. We use the first 20 chars of
  // the representative title as the key (good enough for lookup).
  const index = new Map<string, Set<string>>();
  for (const c of clusters) {
    const key = c.rep.title.slice(0, 20);
    if (!index.has(key)) index.set(key, c.outlets);
  }
  return index;
}

/**
 * Count how many distinct outlets (from Google News) covered a story with a
 * title similar to `title`. Returns the count (0 if no match found).
 */
function countCoverage(
  title: string,
  index: Map<string, Set<string>>,
): number {
  const tokens = titleTokens(title);
  // Find the best-matching cluster by Jaccard similarity.
  let best = 0;
  for (const [key, outlets] of index) {
    const repTokens = titleTokens(key);
    const sim = jaccard(tokens, repTokens);
    if (sim >= SIMILARITY_THRESHOLD && outlets.size > best) {
      best = outlets.size;
    }
  }
  return best;
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
 * Verified direct RSS sources for the trending ranking (see FEEDS in
 * lib/newsApi.ts). Google News RSS is used ONLY to count cross-outlet
 * coverage for the trending score; the displayed articles always come from
 * these verified direct sources:
 *
 *   - NHK            (cat0/cat1/cat5/cat6 — social, economy, international)
 *   - 日経新聞 / 日経ビジネス (business / economy)
 *   - 西日本新聞      (general domestic + sports)
 *   - 日刊スポーツ ×5 / 朝日スポーツ (sports, Atom feeds)
 *   - Football Channel (soccer)
 *   - ITmedia / Gizmodo (technology)
 *
 * Each article is classified into at most one of the four segments by
 * keyword matching, then ranked by "attention" within its segment.
 */

/**
 * Articles that are clearly about sport.
 *
 * Only unambiguous terms: sport/event names, official ranks, and
 * league/competition names. Ambiguous words that also appear in
 * non-sport contexts are excluded:
 *   - スキー  -> matches "ゼレンスキー" (Zelensky)  => use スキージャンプ / アルペンスキー
 *   - 監督    -> "映画監督" / "病院の医長" etc.    => drop (rely on 【チーム名】 prefix below)
 *   - 先発    -> "先発登板" in other contexts      => use 予告先発 / 先発投手
 *   - エース  -> "エース級" in non-sport           => use 先発エース / エース格
 *   - 勝利 / 得点 / ゴール / チーム / 選手 / 大会 / 優勝 => too generic, drop
 *
 * Sports-specialist sources (日刊スポーツ / 朝日スポーツ / Football Channel)
 * are handled separately in classifySegment, so their articles don't need
 * to match a sport keyword to land in the sports segment.
 */
const SPORTS_RE =
  /野球|サッカー|ソフトボール|体操|新体操|柔道|水泳|水球|陸上|駅伝|マラソン|テニス|ソフトテニス|バレーボール|バレー|卓球|スケート|スノボ|スノーボード|スキージャンプ|アルペンスキー|フィギュア|ゴルフ|相撲|大相撲|力士|横綱|大関|関脇|稀勢の里|土俵|プロレス|レスリング|アーチェリー|バドミントン|フェンシング|ボクシング|格闘技|UFC|RIZIN|K-1|カーリング|ホッケー|ハンドボール|バスケ|バスケットボール|馬術|自転車|ケイリン|ボート|カヌー|ヨット|ローイング|トライアスロン|セーリング|射撃|空手|剣道|弓道|ラグビー|スポーツ|五輪|オリンピック|パラリンピック|ワールドカップ|NPB|MLB|NFL|NBA|EPL|J1|J2|J3|J1リーグ|明治安田|順位戦|プレーオフ|セントラルリーグ|パシフィックリーグ|イースタンリーグ|ウェスタンリーグ|日本シリーズ|オールスター|競馬|競輪|オートレース|JRA|中央競馬|G1|JG1|騎手|調教師|厩舎|追い切り|本塁打|ホームラン|打点|予告先発|先発投手|クローザー|先発エース|エース格|スターター|日本代表|代表チーム|国民スポーツ大会|アジア大会|世界水泳|全日本選手権|日本選手権/;

/** Articles about technology / business & economy. */
const TECH_RE =
  /テクノロジー|テック|人工知能|\bAI\b|\bIT\b|半導体|データセンター|クラウド|\bGPU\b|\bAPI\b|スマートフォン|スマホ|モバイル|\b5G\b|\b6G\b|\bIoT\b|ロボット|電気自動車|\bEV\b|電池|バッテリー|充電|量子|\bVR\b|\bAR\b|\bMR\b|メタバース|ゲーム|アプリ|プログラミング|開発者|スタートアップ|ベンチャー|\bIPO\b|上場|時価総額|株式|株価|株高|株安|日経平均|TOPIX|東証|市場|為替|ドル円|円安|円高|ドル高|ドル安|金利|日銀|FRB|米ドル|米国株|米経済|米政府|景気|景気後退|不況|成長率|GDP|インフレ|物価|賃金|失業|雇用|貿易|輸出|輸入|関税|地政学|エネルギー|原油|天然ガス|石炭|電力|原子力|再生可能|太陽光|風力|環境|気候|温室効果|二酸化炭素|地球温暖化|脱炭素|カーボン|脱石油|省エネ/;

/** Articles about international / world affairs. */
const WORLD_RE =
  /国際|海外|外交|外相|駐日大使|大使|国際機関|国連|WHO|IMF|WTO|NATO|G7|G20|北朝鮮|韓国|中国|台湾|ロシア|米国|アメリカ|イラン|イスラエル|ウクライナ|中東|パレスチナ|ガザ|シリア|イラク|アフガン|パキスタン|インド|東南アジア|インドネシア|フィリピン|ベトナム|ミャンマー|タイ|マレーシア|シンガポール|オーストラリア|ニュージーランド|欧州|EU|ドイツ|フランス|イタリア|スペイン|イギリス|北欧|東欧|アフリカ|南米|中南米|ブラジル|メキシコ|カナダ|米大統領|中・|露・|欧・/;

/**
 * Guard: titles about a crime / abuse / incident where a sport word is
 * incidental. E.g. "高齢者グループホームでプロレス技などの虐待行為" — a
 * pro-wrestling move used in abuse, not pro-wrestling news.
 *
 * Deliberately EXCLUDES terms that are routine in sports contexts and would
 * wrongly demote legitimate sports stories: 事故 / 逮捕 / 拘留 / 問題 /
 * 調査 / 裁判 / 訴訟 / 事件 (e.g. "監督が体罰で謹慎処分" and "王皓監督への
 * 暴言で女性3人を拘留" are both sports news), and all injury / illness /
 * disaster terms (骨折 / 靱帯 / 手術 / 入院 / 地震 / 台風 are everyday in
 * sports reporting).
 */
const CRIME_RE =
  /虐待|不祥事|スキャンダル|窃盗|盗難|詐欺|横領|汚職|偽造|恐喝|強盗|脅迫|痴漢|わいせつ|盗撮|ストーカー|嫌がらせ|告発|暴露|テロ|爆破|誘拐|人質|拉致|失踪|行方不明|死亡|遺体|意識不明|重体|重傷|飲酒|酒気帯び|酩酊/;

/**
 * Royal family names / titles. Combined with an "attendance" verb (ROYAL_
 * WATCH below) these identify "the Emperor / Crown Princess watched a match"
 * stories, which are domestic news, not sports.
 */
const ROYAL_RE =
  /天皇|皇后|両陛下|愛子さま|秋篠宮|紀子さま|皇太子|敬宮|皇嗣|徳仁|雅子|眞子|佳子|高円宮|文仁|典子|紀宮|皇族|宮内庁|宮家|宮家|皇居|東宮|離宮/;

/**
 * Attendance / visit verbs. When a royal name AND one of these appear in the
 * same title, the article is about the royal attending an event (a match,
 * a ceremony), not about the sport itself. Routed to japan.
 */
const ROYAL_WATCH_RE = /観戦|観覧|視察|出席|来場|来訪|参観|見学/;

/**
 * Classify an article into exactly one segment, or null if it doesn't fit
 * any. Order matters:
 *   1. sports — sport keyword, or any article from a sports-specialist
 *      source (日刊スポーツ / 朝日スポーツ / Football Channel). A
 *      crime/abuse guard (CRIME_RE) prevents sport words in crime titles
 *      (e.g. "ゼレンスキー", "プロレス技の虐待") from misfiring.
 *   2. world  — named countries / international affairs.
 *   3. technology — business/economy/tech keywords, OR any article from a
 *      dedicated tech source (ITmedia / Gizmodo) that didn't match sports
 *      or world.
 *   4. japan  — domestic fallback for NHK / Nikkei / Nishinippon articles
 *      that aren't about the world or tech.
 */

function classifySegment(title: string, source: string): Segment | null {
  // "Royal watched a match" stories are domestic news, not sports.
  // e.g. "愛子さま 青森でフェンシング観戦" / "両陛下 国民スポーツ大会開会式に出席"
  const isRoyalWatch = ROYAL_RE.test(title) && ROYAL_WATCH_RE.test(title);

  // Sport keyword match (any source), unless the title is about a crime /
  // incident / abuse or a royal watching a match.
  if (SPORTS_RE.test(title) && !CRIME_RE.test(title) && !isRoyalWatch) {
    return "sports";
  }
  // Sports-specialist sources: articles that mention a country name or
  // tech term are still sports (e.g. "大の里がサッカー日本代表を観戦",
  // "eスポーツのワールドカップ延期"). Everything else from these sources
  // is sports by default — but a crime/abuse article from a sports source
  // is still a crime story, not sports.
  const isSportsSource =
    source === "日刊スポーツ" ||
    source === "朝日新聞" ||
    source === "Football Channel";
  if (isSportsSource && !CRIME_RE.test(title) && !isRoyalWatch) {
    return "sports";
  }
  if (WORLD_RE.test(title)) return "world";
  if (TECH_RE.test(title)) return "technology";
  // Dedicated tech sources: everything that didn't match sports/world is
  // technology (their entire content is tech-focused).
  if (source === "ITmedia" || source === "Gizmodo") return "technology";
  // Domestic fallback: NHK / Nikkei / Nishinippon articles that aren't
  // about the world or tech are domestic news.
  if (
    source === "NHK" ||
    source.startsWith("日経") ||
    source === "西日本新聞"
  ) {
    return "japan";
  }
  return null;
}

/**
 * Tabloid / sensational title filter. Any match drops the article from
 * every segment.
 */
const TABLOID_PATTERNS: RegExp[] = [
  /熱愛|不倫|浮気|交際|破局|離婚|結婚|婚約|同棲/,
  /スキャンダル|不祥事|私生活|恋愛|デート/,
  /グラドル|グラビア|コスプレ|暴露/,
  /カワイイ|かわいい|可愛い|美人|美女|イケメン|萌え|萌|推し活/,
  /ファン.*興奮|ファン.*大興奮|ファン.*歓喜|ファン.*悲鳴|ファン.*騒然/,
  /暴露|スクープ|衝撃の真相|衝撃|裏側|闇|闇に葬る/,
  /衝撃|驚愕|実は|意外な|意外/,
  /疑惑|疑われる/,
  /母子|父子|親子関係|父子関係|母子関係|家庭内/,
  /セックス|性行為|性的|一夜/,
];

function isTabloidTitle(title: string): boolean {
  for (const re of TABLOID_PATTERNS) {
    if (re.test(title)) return true;
  }
  return false;
}

/* ---------- Attention scoring ----------
 *
 * With direct RSS sources we can't measure cross-outlet coverage the way we
 * could with a single aggregator feed. Instead we rank by:
 *   1. Prestige  — well-known outlets (NHK, Nikkei, BBC, Guardian) weigh
 *                  higher.
 *   2. Readability proxy — longer, more informative titles tend to be the
 *                  lead articles, not short follow-ups.
 *   3. Recency   — fresher articles win ties.
 *
 *   score = 3·prestige
 *           + 0.5·min(5, floor(title_length / 20))
 *           + 1.0·exp(-age/τ)   (τ = 12h)
 *
 * Same-story dedupe: two articles are considered the same story when ≥ 45%
 * of their significant Japanese 2-3 char n-grams overlap (Jaccard).
 */
const RECENCY_TAU_MS = 12 * 60 * 60 * 1000;
const PRESTIGE_WEIGHT = 3.0;
const LENGTH_WEIGHT = 0.5;
const RECENCY_WEIGHT = 1.0;
const SIMILARITY_THRESHOLD = 0.45;
// A story covered by N different outlets gets a coverage bonus. This is the
// main signal of "trending": the same news reported by many sites means it's
// the big story. Each additional outlet adds COVERAGE_PER_OUTLET points,
// with diminishing returns (sqrt) so 5 outlets ≈ 2.2× a single-outlet story.
const COVERAGE_PER_OUTLET = 3.0;

/** Source prestige (1-5). */
const SOURCE_PRESTIGE: Record<string, number> = {
  NHK: 5,
  日経新聞: 5,
  日経ビジネス: 4,
  BBC: 4,
  Guardian: 4,
  日刊スポーツ: 4,
  朝日新聞: 4,
  ITmedia: 4,
  西日本新聞: 3,
  "Football Channel": 3,
  Gizmodo: 3,
};

function sourcePrestige(source: string): number {
  return SOURCE_PRESTIGE[source] ?? 2;
}

/** Common Japanese particles / function words to drop from the n-gram set. */
const STOPWORDS = new Set([
  "の", "に", "が", "を", "は", "と", "で", "て", "も", "や", "れ", "へ",
  "より", "まで", "から", "ため", "こと", "など", "ほか",
  "その", "これ", "それ", "あれ", "この", "あの",
  "今日", "昨日", "明日", "今年", "来年",
  "月", "日", "年", "時", "分", "秒",
  "円", "億", "万", "千",
  "日本", "世界", "国内", "海外", "国際",
]);

/**
 * Extract significant 2-3 char Japanese n-grams from a title, dropping
 * n-grams made only of stopwords or ASCII.
 */
function titleTokens(title: string): Set<string> {
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

function storyScore(a: TrendingArticle, nowMs: number): number {
  const prestige = PRESTIGE_WEIGHT * sourcePrestige(a.source);
  const length = LENGTH_WEIGHT * Math.min(5, Math.floor(a.title.length / 20));
  const ageMs = nowMs - new Date(a.publishedAt).getTime();
  const recency = RECENCY_WEIGHT * Math.exp(-Math.max(0, ageMs) / RECENCY_TAU_MS);
  return prestige + length + recency;
}

interface StoryCluster {
  representative: TrendingArticle;
  members: TrendingArticle[];
}

/**
 * Cluster articles into "story" groups by Jaccard similarity on their title
 * n-gram sets. Greedy: an article joins the first cluster whose
 * representative is ≥ threshold similar; otherwise it starts a new cluster.
 */
function clusterStories(items: TrendingArticle[]): StoryCluster[] {
  const withTokens = items.map((a) => ({ a, tokens: titleTokens(a.title) }));
  const clusters: StoryCluster[] = [];
  for (const { a, tokens } of withTokens) {
    let placed = false;
    for (const c of clusters) {
      if (jaccard(tokens, titleTokens(c.representative.title)) >= SIMILARITY_THRESHOLD) {
        c.members.push(a);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ representative: a, members: [a] });
    }
  }
  return clusters;
}

/**
 * Dedupe by URL, cluster into stories, pick the best representative per
 * story, and sort by attention score + Google News coverage. Cap at TOP_N.
 *
 * The coverage bonus uses Google News RSS to count how many distinct outlets
 * reported the same story. This is the main "trending" signal: a story
 * covered by 10 outlets outranks one covered by 2.
 */
function rankByAttention(
  items: TrendingArticle[],
  nowMs: number,
  coverageIndex: Map<string, Set<string>>,
): TrendingArticle[] {
  const seen = new Set<string>();
  const unique: TrendingArticle[] = [];
  for (const a of items) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    unique.push(a);
  }

  const clusters = clusterStories(unique);
  const scored: Array<{ article: TrendingArticle; score: number }> = [];
  for (const c of clusters) {
    // Pick the best representative article by its individual score.
    let best = c.members[0];
    let bestScore = -Infinity;
    for (const m of c.members) {
      const s = storyScore(m, nowMs);
      if (s > bestScore + 1e-9) {
        best = m;
        bestScore = s;
      }
    }
    // Coverage: how many distinct outlets (per Google News) reported this
    // story. Added on top of the representative's individual score.
    const outletCount = countCoverage(best.title, coverageIndex);
    const coverage = COVERAGE_PER_OUTLET * Math.sqrt(outletCount);
    scored.push({ article: best, score: bestScore + coverage });
  }

  scored.sort((a, b) => {
    const d = b.score - a.score;
    if (Math.abs(d) < 1e-9) {
      return new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime();
    }
    return d;
  });

  return scored.slice(0, TOP_N).map((s) => s.article);
}

/**
 * Google News RSS URLs for coverage detection. We fetch all four topic
 * feeds in parallel and merge them into a single coverage index.
 */
const GOOGLE_NEWS_URLS = [
  "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
  "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ja&gl=JP&ceid=JP:ja",
  "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=ja&gl=JP&ceid=JP:ja",
  "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ja&gl=JP&ceid=JP:ja",
];

/**
 * Fetch all verified RSS feeds in parallel, classify each article into at
 * most one segment, drop tabloid titles, and rank. A failing feed never
 * takes down the whole page.
 *
 * Coverage detection uses Google News RSS (fetched separately) to count how
 * many distinct outlets reported each story. The displayed articles still
 * come from the verified direct sources.
 */
export async function fetchTrendingNews(): Promise<TrendingData> {
  const nowMs = Date.now();

  // Fetch direct-source pool and Google News coverage in parallel.
  const [pool, googleNews] = await Promise.all([
    fetchFeedArticles().catch(() => []),
    Promise.all(GOOGLE_NEWS_URLS.map((url) => fetchGoogleNews(url))),
  ]);
  const googleItems = googleNews.flat();
  const coverageIndex = await buildCoverageIndex(googleItems);

  const bySegment: Record<Segment, TrendingArticle[]> = {
    world: [],
    japan: [],
    sports: [],
    technology: [],
  };
  for (const a of pool) {
    if (isTabloidTitle(a.title)) continue;
    const seg = classifySegment(a.title, a.source);
    if (!seg) continue;
    bySegment[seg].push({
      source: a.source,
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
    });
  }

  return {
    world: rankByAttention(bySegment.world, nowMs, coverageIndex),
    japan: rankByAttention(bySegment.japan, nowMs, coverageIndex),
    sports: rankByAttention(bySegment.sports, nowMs, coverageIndex),
    technology: rankByAttention(bySegment.technology, nowMs, coverageIndex),
  };
}
