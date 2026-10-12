import { fetchFeedArticles } from "./newsApi";

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
 * Verified direct RSS sources for the trending ranking.
 *
 * We no longer use Google News RSS (its redirect URLs are unreliable to
 * resolve and many publishers block direct fetches). Instead we classify
 * articles from the five verified sources whose feeds we pull:
 *
 *   - NHK          (cat0/cat1/cat5/cat6 — social, economy, international)
 *   - 日経新聞      (business / economy)
 *   - 日経ビジネス  (business)
 *   - BBC          (world, English)
 *   - Guardian     (world, English)
 *
 * Each article is classified into at most one of the four segments by
 * keyword matching, then ranked by "attention" within its segment.
 */

/** Articles that are clearly about sport. */
const SPORTS_RE =
  /野球|サッカー|ソフトボール|体操|柔道|水泳|陸上|テニス|バレーボール|卓球|スケート|スキー|ゴルフ|相撲|プロレス|レスリング|アーチェリー|バドミントン|フェンシング|ボクシング|カーリング|ホッケー|ハンドボール|バスケ|馬術|自転車|ボート|セーリング|射撃|空手|剣道|弓道|スポーツ|選手|チーム|リーグ|優勝|決勝|準決勝|大会|五輪|オリンピック|パラリンピック|ワールドカップ|J1リーグ|NPB|MLB|NFL|NBA|EPL|監督|コーチ|キャプテン|ゴール|得点|勝利|敗北|順位戦|プレーオフ/;

/** Articles about technology / business & economy. */
const TECH_RE =
  /テクノロジー|テック|人工知能|\bAI\b|\bIT\b|半導体|データセンター|クラウド|\bGPU\b|\bAPI\b|スマートフォン|スマホ|モバイル|\b5G\b|\b6G\b|\bIoT\b|ロボット|電気自動車|\bEV\b|電池|バッテリー|充電|量子|\bVR\b|\bAR\b|\bMR\b|メタバース|ゲーム|アプリ|プログラミング|開発者|スタートアップ|ベンチャー|\bIPO\b|上場|時価総額|株式|株価|株高|株安|日経平均|TOPIX|東証|市場|為替|ドル円|円安|円高|ドル高|ドル安|金利|日銀|FRB|米ドル|米国株|米経済|米政府|景気|景気後退|不況|成長率|GDP|インフレ|物価|賃金|失業|雇用|貿易|輸出|輸入|関税|地政学|エネルギー|原油|天然ガス|石炭|電力|原子力|再生可能|太陽光|風力|環境|気候|温室効果|二酸化炭素|地球温暖化|脱炭素|カーボン|脱石油|省エネ/;

/** Articles about international / world affairs. */
const WORLD_RE =
  /国際|海外|外交|外相|駐日大使|大使|国際機関|国連|WHO|IMF|WTO|NATO|G7|G20|北朝鮮|韓国|中国|台湾|ロシア|米国|アメリカ|イラン|イスラエル|ウクライナ|中東|パレスチナ|ガザ|シリア|イラク|アフガン|パキスタン|インド|東南アジア|インドネシア|フィリピン|ベトナム|ミャンマー|タイ|マレーシア|シンガポール|オーストラリア|ニュージーランド|欧州|EU|ドイツ|フランス|イタリア|スペイン|イギリス|北欧|東欧|アフリカ|南米|中南米|ブラジル|メキシコ|カナダ|米大統領|中・|露・|欧・/;

/**
 * Classify an article into exactly one segment, or null if it doesn't fit
 * any. Order matters:
 *   1. sports — sport keywords (most specific).
 *   2. world  — named countries / international affairs.
 *   3. technology — business/economy/tech keywords, OR any article from a
 *      dedicated tech source (ITmedia / Gizmodo) that didn't match sports
 *      or world. This ensures tech-source articles always land in the
 *      technology segment, even when their titles lack explicit tech words.
 *   4. japan  — domestic fallback for NHK / Nikkei articles that aren't
 *      clearly about the world.
 */
function classifySegment(title: string, source: string): Segment | null {
  if (SPORTS_RE.test(title)) return "sports";
  if (WORLD_RE.test(title)) return "world";
  if (TECH_RE.test(title)) return "technology";
  // Dedicated tech sources: everything that didn't match sports/world is
  // technology (their entire content is tech-focused).
  if (source === "ITmedia" || source === "Gizmodo") return "technology";
  // Domestic fallback: NHK / Nikkei articles that aren't about the world.
  if (source === "NHK" || source.startsWith("日経")) return "japan";
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
 *                  higher. The weight is reduced for the sports and
 *                  technology segments so that freshness and specificity
 *                  (title length) matter more than the outlet's name —
 *                  these segments have many specialist sources (日刊スポーツ,
 *                  朝日, ITmedia, Gizmodo) and we don't want one outlet to
 *                  dominate the ranking.
 *   2. Readability proxy — longer, more informative titles tend to be the
 *                  lead articles, not short follow-ups.
 *   3. Recency   — fresher articles win ties.
 *
 *   score = prestigeWeight(segment)·prestige
 *           + 0.5·min(5, floor(title_length / 20))
 *           + 1.0·exp(-age/τ)   (τ = 12h)
 *
 *   prestigeWeight: 3.0 (world/japan), 1.5 (sports/technology)
 *
 * Same-story dedupe: two articles are considered the same story when ≥ 45%
 * of their significant Japanese 2-3 char n-grams overlap (Jaccard).
 */
const RECENCY_TAU_MS = 12 * 60 * 60 * 1000;
const PRESTIGE_WEIGHT = 3.0;
const SPORTS_TECH_PRESTIGE_WEIGHT = 1.5;
const LENGTH_WEIGHT = 0.5;
const RECENCY_WEIGHT = 1.0;
const SIMILARITY_THRESHOLD = 0.45;

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

function storyScore(a: TrendingArticle, nowMs: number, segment: Segment): number {
  const prestigeWeight =
    segment === "sports" || segment === "technology"
      ? SPORTS_TECH_PRESTIGE_WEIGHT
      : PRESTIGE_WEIGHT;
  const prestige = prestigeWeight * sourcePrestige(a.source);
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
 * story, and sort by attention score. Cap at TOP_N.
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
    let best = c.members[0];
    let bestScore = -Infinity;
    for (const m of c.members) {
      const s = storyScore(m, nowMs, segment);
      if (s > bestScore + 1e-9) {
        best = m;
        bestScore = s;
      }
    }
    representatives.push(best);
  }

  representatives.sort((a, b) => {
    const d = storyScore(b, nowMs, segment) - storyScore(a, nowMs, segment);
    if (Math.abs(d) < 1e-9) {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
    return d;
  });

  return representatives.slice(0, TOP_N);
}

/**
 * Fetch all verified RSS feeds in parallel, classify each article into at
 * most one segment, drop tabloid titles, and rank. A failing feed never
 * takes down the whole page.
 */
export async function fetchTrendingNews(): Promise<TrendingData> {
  const nowMs = Date.now();

  const pool = await fetchFeedArticles().catch(() => []);

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
    world: rankByAttention(bySegment.world, nowMs, "world"),
    japan: rankByAttention(bySegment.japan, nowMs, "japan"),
    sports: rankByAttention(bySegment.sports, nowMs, "sports"),
    technology: rankByAttention(bySegment.technology, nowMs, "technology"),
  };
}
