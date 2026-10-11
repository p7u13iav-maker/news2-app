/**
 * Lightweight English→Japanese translation for BBC/Guardian headlines.
 * No AI — keyword matching against curated tables.
 *
 * Replaces English country names, people, and common news terms with
 * Japanese equivalents using word-boundary regex.
 */

const COUNTRIES: Record<string, string> = {
  "United States": "米国", "U.S.": "米国", "United Kingdom": "英国",
  "European Union": "EU", "United Nations": "国連", "South Korea": "韓国",
  "North Korea": "北朝鮮", "Saudi Arabia": "サウジアラビア", "Czech Republic": "チェコ",
  "South Africa": "南アフリカ", "New York": "ニューヨーク",
  "Washington": "ワシントン", "London": "ロンドン", "Paris": "パリ",
  "Berlin": "ベルリン", "Moscow": "モスクワ", "Beijing": "北京",
  "Tokyo": "東京", "Kyiv": "キーウ", "Tel Aviv": "テルアビブ",
  "Kabul": "カブール", "Baghdad": "バグダッド", "Riyadh": "リヤド",
  "New Delhi": "ニューデリー", "Seoul": "ソウル", "Islamabad": "イスラマバード",
  "Delhi": "デリー", "Mumbai": "ムンバイ", "Singapore": "シンガポール",
  "Bangkok": "バンコク", "Manila": "マニラ", "Jakarta": "ジャカルタ",
  "Sydney": "シドニー", "Melbourne": "メルボルン", "Vancouver": "バンクーバー",
  "Toronto": "トロント", "Mexico City": "メキシコシティ", "Buenos Aires": "ブエノスアイレス",
  "Lima": "リマ", "Santiago": "サンチアゴ", "Brasilia": "ブラジリア",
  "Geneva": "ジュネーブ", "Vienna": "ウィーン", "Helsinki": "ヘルシンキ",
  "Stockholm": "ストックホルム", "Oslo": "オスロ", "Copenhagen": "コペンハーゲン",
  "Amsterdam": "アムステルダム", "Brussels": "ブリュッセル", "Madrid": "マドリード",
  "Rome": "ローマ", "Athens": "アテネ", "Budapest": "ブダペスト",
  "Bucharest": "ブカレスト", "Prague": "プラハ", "Warsaw": "ワルシャワ",
  "Dublin": "ダブリン", "Edinburgh": "エディンバラ", "Cardiff": "カーディフ",
  "Manchester": "マンチェスター", "Birmingham": "バーミンガム",
  "Chicago": "シカゴ", "Boston": "ボストン", "Los Angeles": "ロサンゼルス",
  "San Francisco": "サンフランシスコ", "Seattle": "シアトル", "Denver": "デンバー",
  "Miami": "マイアミ", "Atlanta": "アトランタ", "Houston": "ヒューストン",
  "Phoenix": "フェニックス", "Las Vegas": "ラスベガス",
  "Britain": "英国", "UK": "英国",
  "US": "米国", "America": "米国", "China": "中国", "Russia": "ロシア",
  "Ukraine": "ウクライナ", "Israel": "イスラエル", "Gaza": "ガザ",
  "Iran": "イラン", "India": "インド", "Japan": "日本",
  "Germany": "ドイツ", "France": "フランス", "Europe": "欧州",
  "EU": "EU", "NATO": "NATO", "UN": "国連",
  "Africa": "アフリカ", "Middle East": "中東", "Asia": "アジア",
  "Australia": "オーストラリア", "Canada": "カナダ", "Mexico": "メキシコ",
  "Brazil": "ブラジル", "Pakistan": "パキスタン", "Afghanistan": "アフガニスタン",
  "Syria": "シリア", "Iraq": "イラク", "Turkey": "トルコ",
  "Egypt": "エジプト", "Nigeria": "ナイジェリア", "Kenya": "ケニア",
  "Italy": "イタリア", "Spain": "スペイン", "Poland": "ポーランド",
  "Greece": "ギリシャ", "Switzerland": "スイス", "Norway": "ノルウェー",
  "Sweden": "スウェーデン", "Denmark": "デンマーク", "Finland": "フィンランド",
  "Hungary": "ハンガリー", "Romania": "ルーマニア", "Austria": "オーストリア",
  "Belgium": "ベルギー", "Netherlands": "オランダ", "Ireland": "アイルランド",
  "Scotland": "スコットランド", "Wales": "ウェールズ", "England": "イングランド",
  "Taiwan": "台湾", "Hawaii": "ハワイ", "Alaska": "アラスカ",
  "California": "カリフォルニア", "Florida": "フロリダ", "Texas": "テキサス",
};

const PEOPLE: Record<string, string> = {
  "Trump": "トランプ", "Biden": "バイデン", "Obama": "オバマ",
  "Putin": "プーチン", "Zelensky": "ゼレンスキー", "Netanyahu": "ネタニヤフ",
  "Musk": "マスカ", "Gates": "ゲイツ", "Johnson": "ジョンソン",
  "Cameron": "キャメロン", "Sunak": "スナク", "Starmer": "スターマー",
  "Macron": "マクロン", "Scholz": "ショルツ", "Meloni": "メローニ",
  "Xi Jinping": "習近平", "Xi": "習", "Abe": "安倍",
  "Suga": "菅", "Modi": "モディ", "Yoon": "尹",
};

const TERMS: Record<string, string> = {
  "president": "大統領", "prime minister": "首相", "mayor": "市長",
  "governor": "知事", "minister": "大臣", "secretary": "国務長官",
  "ambassador": "大使", "government": "政府", "parliament": "議会",
  "congress": "議会", "senate": "上院", "house": "下院",
  "court": "裁判所", "judge": "裁判官", "police": "警察",
  "military": "軍", "army": "陸軍", "navy": "海軍",
  "air force": "空軍", "war": "戦争", "peace": "平和",
  "deal": "合意", "agreement": "合意", "treaty": "条約",
  "sanctions": "制裁", "election": "選挙", "voters": "有権者",
  "ballot": "投票", "poll": "世論調査", "polling": "世論調査",
  "victory": "勝利", "defeat": "敗北", "rise": "上昇",
  "fall": "下落", "crash": "暴落", "surge": "急騰",
  "plunge": "急落", "boom": "好況", "recession": "不況",
  "inflation": "インフレ", "deflation": "デフレ", "interest rate": "金利",
  "rate": "金利", "dollar": "ドル", "yuan": "元",
  "euro": "ユーロ", "pound": "ポンド", "yen": "円",
  "rupee": "ルピー", "ruble": "ルーブル", "won": "ウォン",
  "oil": "原油", "gold": "金", "silver": "銀",
  "stock": "株式", "stocks": "株式", "market": "市場",
  "markets": "市場", "trade": "貿易", "tariff": "関税",
  "tariffs": "関税", "export": "輸出", "exports": "輸出",
  "import": "輸入", "imports": "輸入", "economy": "経済",
  "economic": "経済", "federal reserve": "FRB", "Fed": "FRB",
  "bank": "銀行", "central bank": "中央銀行", "crisis": "危機",
  "crises": "危機", "emergency": "緊急事態", "disaster": "災害",
  "earthquake": "地震", "flood": "洪水", "floods": "洪水",
  "tsunami": "津波", "hurricane": "ハリケーン", "typhoon": "台風",
  "wildfire": "森林火災", "wildfires": "森林火災", "drought": "干ばつ",
  "heatwave": "熱波", "storm": "暴風雨", "blizzard": "吹雪",
  "tornado": "トルネード", "famine": "飢饉", "protest": "抗議行動",
  "protests": "抗議行動", "demonstration": "デモ", "demonstrations": "デモ",
  "riot": "暴動", "riots": "暴動", "strike": "ストライキ",
  "strikes": "ストライキ", "union": "労働組合", "workers": "労働者",
  "jobs": "雇用", "unemployment": "失業", "layoff": "解雇",
  "layoffs": "解雇", "wage": "賃金", "wages": "賃金",
  "salary": "給与", "prices": "物価", "price": "物価",
  "cost": "コスト", "costs": "コスト", "debt": "債務",
  "deficit": "赤字", "budget": "予算", "tax": "税",
  "taxes": "税", "spending": "支出", "growth": "成長",
  "GDP": "GDP", "consumer": "消費者", "consumers": "消費者",
  "retail": "小売", "company": "企業", "companies": "企業",
  "corporate": "企業", "firm": "企業", "firms": "企業",
  "board": "取締役会", "shareholder": "株主", "shareholders": "株主",
  "share": "株式", "shares": "株式", "investor": "投資家",
  "investors": "投資家", "investment": "投資", "invest": "投資",
  "startup": "スタートアップ", "startups": "スタートアップ", "tech": "テック",
  "technology": "テクノロジー", "artificial intelligence": "AI", "AI": "AI",
  "chip": "チップ", "chips": "チップ", "semiconductor": "半導体",
  "semiconductors": "半導体", "data": "データ", "cloud": "クラウド",
  "cyber": "サイバー", "hacking": "ハッキング", "cyberattack": "サイバー攻撃",
  "hacker": "ハッカー", "security": "セキュリティ",
  "privacy": "プライバシー", "surveillance": "監視", "law": "法律",
  "laws": "法律", "regulation": "規制", "regulations": "規制",
  "rule": "ルール", "rules": "ルール", "policy": "政策",
  "policies": "政策", "banning": "禁止", "ban": "禁止",
  "banned": "禁止", "allowed": "許可", "approve": "承認",
  "approved": "承認", "reject": "拒否", "rejected": "拒否",
  "pass": "可決", "passed": "可決", "fail": "否決",
  "failed": "否決", "vote": "投票", "voted": "投票",
  "voting": "投票", "referendum": "国民投票", "referenda": "国民投票",
  "campaign": "運動", "candidate": "候補者", "candidates": "候補者",
  "opponent": "対立候補", "rival": "ライバル", "party": "政党",
  "parties": "政党", "coalition": "連立", "opposition": "野党",
  "ruling": "与党", "independent": "独立", "neutrality": "中立",
  "diplomacy": "外交", "diplomat": "外交官", "diplomatic": "外交",
  "talks": "交渉", "talk": "交渉", "negotiation": "交渉",
  "negotiations": "交渉", "negotiate": "交渉", "summit": "首脳会談",
  "meeting": "会談", "meetings": "会談", "meet": "会談",
  "met": "会談", "call": "電話", "called": "電話",
  "phone": "電話", "phone call": "電話", "summon": "召喚",
  "summoned": "召喚", "warn": "警告", "warned": "警告",
  "warning": "警告", "threaten": "脅迫", "threatened": "脅迫",
  "threat": "脅迫", "threats": "脅迫", "attack": "攻撃",
  "attacked": "攻撃", "attacking": "攻撃", "attacks": "攻撃",
  "struck": "攻撃", "bomb": "爆弾", "bombed": "爆撃",
  "bombing": "爆撃", "bombs": "爆弾", "missile": "ミサイル",
  "missiles": "ミサイル", "drone": "ドローン", "drones": "ドローン",
  "weapon": "兵器", "weapons": "兵器", "nuclear": "核",
  "rocket": "ロケット", "rockets": "ロケット", "shell": "砲弾",
  "shells": "砲弾", "gun": "銃", "guns": "銃",
  "gunman": "銃撃犯", "shooting": "銃撃", "shooter": "銃撃犯",
  "shot": "撃たれる", "shots": "銃撃", "kill": "殺害",
  "killed": "殺害", "kills": "殺害", "killing": "殺害",
  "deaths": "死者", "dead": "死亡", "die": "死亡",
  "died": "死亡", "dies": "死亡", "death": "死亡",
  "fatal": "致命的", "injured": "負傷", "injury": "負傷",
  "injuries": "負傷", "wounded": "負傷", "rescue": "救助",
  "rescued": "救助", "rescuer": "救助隊", "survivor": "生存者",
  "survivors": "生存者", "survive": "生存", "survived": "生存",
  "victim": "犠牲者", "victims": "犠牲者", "casualty": "犠牲者",
  "casualties": "犠牲者", "hostage": "人質", "hostages": "人質",
  "release": "解放", "released": "解放", "capture": "捕獲",
  "captured": "捕獲", "arrest": "逮捕", "arrested": "逮捕",
  "detain": "拘束", "detained": "拘束", "detention": "拘束",
  "imprison": "投獄", "imprisoned": "投獄", "jail": "刑務所",
  "jailed": "刑務所", "prison": "刑務所", "prisoners": "囚人",
  "trial": "裁判", "trials": "裁判", "verdict": "判決",
  "verdicts": "判決", "sentence": "刑", "sentenced": "刑",
  "convict": "有罪", "convicted": "有罪", "acquittal": "無罪",
  "acquitted": "無罪", "guilty": "有罪", "innocent": "無罪",
  "crime": "犯罪", "crimes": "犯罪", "criminal": "犯罪者",
  "criminals": "犯罪者", "suspicion": "疑い", "suspect": "容疑者",
  "suspects": "容疑者", "investigation": "捜査", "investigations": "捜査",
  "investigate": "捜査", "probe": "捜査", "probes": "捜査",
  "inquiry": "調査", "inquiries": "調査", "report": "報告",
  "reported": "報告", "reporting": "報告", "reports": "報告",
  "said": "述べた", "say": "述べる", "says": "述べている",
  "statement": "声明", "statements": "声明", "announce": "発表",
  "announced": "発表", "announcement": "発表", "announcements": "発表",
  "reveal": "明らかにする", "revealed": "明らかにした", "expose": "暴露する",
  "exposed": "暴露された", "exposure": "暴露", "scandal": "スキャンダル",
  "scandals": "スキャンダル", "corruption": "汚職", "corrupt": "腐敗",
  "fraud": "詐欺", "embezzlement": "横領", "bribery": "収賄",
  "bribe": "賄賂", "bribes": "賄賂", "money": "資金",
  "funds": "資金", "funding": "資金", "cash": "現金",
  "billion": "10億", "trillion": "1兆", "million": "100万",
  "billionaires": "億万長者", "rich": "富裕層", "wealthy": "富裕層",
  "poor": "貧困層", "poverty": "貧困", "inequality": "格差",
  "homeless": "無家帰", "refugee": "難民", "refugees": "難民",
  "migrant": "移民", "migrants": "移民", "immigrant": "移民",
  "immigrants": "移民", "asylum": "亡命", "border": "国境",
  "borders": "国境", "crossing": "越境", "crossed": "越境",
  "cross": "越境", "migrating": "移住", "migration": "移住",
  "migrate": "移住", "immigration": "移民", "emigration": "出国",
  "emigrate": "出国", "expel": "追放", "expelled": "追放",
  "expulsion": "追放", "deport": "送還", "deported": "送還",
  "deportation": "送還", "sanction": "制裁", "embargo": "禁輸",
  "blockade": "封鎖", "isolation": "孤立", "isolate": "孤立",
  "isolated": "孤立", "alliance": "同盟", "alliances": "同盟",
  "ally": "同盟国", "allies": "同盟国", "partner": "パートナー",
  "partners": "パートナー", "partnership": "協力", "partnerships": "協力",
  "cooperation": "協力", "cooperate": "協力", "cooperating": "協力",
  "joint": "共同", "jointly": "共同で",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Translate an English headline to Japanese using keyword matching.
 * Replaces country names, people, and common terms with Japanese.
 * Returns the original text if no matches are found.
 */
export function translateHeadline(english: string): string {
  let result = english;

  // Step 1: Replace country names (longest first).
  for (const [en, ja] of Object.entries(COUNTRIES).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp(`\\b${escapeRegex(en)}\\b`, "gi"), ja);
  }

  // Step 2: Replace people names.
  for (const [en, ja] of Object.entries(PEOPLE).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp(`\\b${escapeRegex(en)}\\b`, "gi"), ja);
  }

  // Step 3: Replace common news terms.
  for (const [en, ja] of Object.entries(TERMS).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp(`\\b${escapeRegex(en)}\\b`, "gi"), ja);
  }

  return result;
}
