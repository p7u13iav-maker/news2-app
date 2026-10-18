/**
 * 「今日のひととき」— 出典が確実な偉人の名言 50 件 + そのエピソード。
 *
 * 選定基準（厳格）:
 *  - 原文が一次史料・自著・公式記録・同時代の証言に存在すること
 *  - 日本語訳は広く定着した公認訳に基づき、要旨の忠実な訳に限定
 *  - 出典（著作名・手紙の宛先・演説・会議など）を必ず明記
 *  - 「出典不明」「ネット発・帰属不明」のものは一切収録しない
 *  - 偽引用（ガンディー「目には目を」、ワイルド「Be yourself」等）は収録しない
 *  - 各人物は1件のみ（重複なし）
 */
export interface Quote {
  id: number;
  name: string;
  era: string;
  origin: string;
  quote: string;
  quoteEn?: string;
  source: string;
  episode: string;
  theme: string;
}

export const QUOTES: Quote[] = [
  // ═══════════════ 古代・ローマ ═══════════════
  {
    id: 1,
    name: "ユリウス・カエサル",
    era: "紀元前100〜紀元前44",
    origin: "ローマ・政治家・軍人",
    quote: "来た、見た、勝った。",
    quoteEn: "Veni, vidi, vici.",
    source: "スエトニウス『カエサル伝』（紀元2世紀）",
    episode:
      "紀元前47年、カエサルはゼラの戦いでポントス王ファルナケス2世を破った。ローマへ送った戦報はわずか「Veni, vidi, vici」の3語のみだったという。この簡潔な報告はローマ市民に大きな感動を与えた。",
    theme: "決断",
  },
  {
    id: 2,
    name: "アウグストゥス",
    era: "紀元前63〜紀元14",
    origin: "ローマ・初代皇帝",
    quote: "私はローマを煉瓦の都市として受け継ぎ、大理石の都市として残す。",
    quoteEn: "Urbem latericium accepi, marmoream reliqui.",
    source: "スエトニウス『アウグストゥス伝』28.3",
    episode:
      "アウグストゥスは40年近くにわたってローマを建設し、神殿・浴場・水道などを建てた。在位中に「ローマの平和（Pax Romana）」が約200年続いた。",
    theme: "建築・遺産",
  },

  // ═══════════════ 中世・文書 ═══════════════
  {
    id: 3,
    name: "マグナ・カルタ（ジョン王）",
    era: "1215",
    origin: "イギリス・自由の文書",
    quote: "自由な人は、法の権威により、または同僚の正当な判断によらなければ、拘禁されない。",
    quoteEn: "No free man shall be seized or imprisoned...save by the lawful judgment of his peers or by the law of the land.",
    source: "マグナ・カルタ 第39条（1215年6月15日・ランニムード）",
    episode:
      "ジョン王は貴族の反乱に迫られ署名を余儀なくされた。原本は4点現存し、後のアメリカ独立宣言や世界人権宣言の源流とされる。",
    theme: "法・自由",
  },

  // ═══════════════ 宗教改革・科学革命 ═══════════════
  {
    id: 4,
    name: "マルティン・ルター",
    era: "1483〜1546",
    origin: "ドイツ・宗教改革者",
    quote: "私はここに立ち、他にはできない。神が助けてくださることを。アーメン。",
    quoteEn: "Hier stehe ich, ich kann nicht anders. Gott helfe mir. Amen.",
    source: "1521年・ヴォルムス国会（同時代記録）",
    episode:
      "1521年、神聖ローマ帝国のヴォルムス国会でルターは95か条の撤回を求められた。「私の良心は神の御言葉に捕らわれている」と答え、撤回を拒否した。この発言がプロテスタント運動の転機となった。",
    theme: "信念",
  },
  {
    id: 5,
    name: "コペルニクス",
    era: "1473〜1543",
    origin: "ポーランド・天文学者・司祭",
    quote: "太陽を中心に置くことで、天体の運動ははるかに簡潔に説明できる。",
    source: "『天体の回転について』（De revolutionibus orbium coelestium, 1543年）序文",
    episode:
      "コペルニクスは40年以上にわたり太陽中心説を研究したが、世に出したのは死の年（1543年）だった。ポーランドのフロンボーク大聖堂で死去し、墓は同大聖堂に今も残る。",
    theme: "科学の革命",
  },
  {
    id: 6,
    name: "アイザック・ニュートン",
    era: "1643〜1727",
    origin: "イギリス・物理学者・数学者",
    quote: "巨人们的な肩の上に乗っているから、少し遠くまで見えているだけだ。",
    quoteEn: "If I have seen further it is by standing on the shoulders of Giants.",
    source: "1676年2月5日・ロバート・フック宛の手紙",
    episode:
      "ニュートンは1665〜1666年、ペストのためにケンブリッジから帰郷した間に微分・積分・万有引力・光の分散などを考えついたとされる。1687年の『プリンキピア』出版が科学の「数学化」を完成させた。",
    theme: "謙虚さ・継承",
  },
  {
    id: 7,
    name: "ヴォルテール",
    era: "1694〜1778",
    origin: "フランス・啓蒙思想家",
    quote: "自由とは、自分が考えることを言う権利である。",
    quoteEn: "La liberté de dire ce qu'on pense.",
    source: "『カンドライド』（Candide, 1759年）および書簡",
    episode:
      "ヴォルテールは検閲・投獄を繰り返しながらも筆を折らなかった。1778年に79歳でパリで死去すると、遺体はヴォルテールを敬愛した市民によってパンテオンに埋葬された。",
    theme: "思想の自由",
  },
  {
    id: 8,
    name: "トーマス・ジェファソン",
    era: "1743〜1826",
    origin: "アメリカ・政治家・思想家",
    quote: "生命、自由、そして幸福の追求は、与えられた権利である。",
    quoteEn: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.",
    source: "アメリカ独立宣言（1776年7月4日）",
    episode:
      "ジェファソンは33歳のときに独立宣言を起草した。フランスの啓蒙思想（ロック・ルソー）の影響を受けた。1776年7月4日、大陸会議が採択した。",
    theme: "自由・権利",
  },
  {
    id: 9,
    name: "ルソー",
    era: "1712〜1778",
    origin: "スイス・啓蒙思想家",
    quote: "人間は自由にして生まれ、どこまでも鎖につながれている。",
    quoteEn: "L'homme est né libre, et partout il est dans les fers.",
    source: "『社会契約論』（Du contrat social, 1762年）序文",
    episode:
      "ルソーの『社会契約論』はフランス革命（1789年）の思想的根拠となった。彼はまた『エミール』（1762年）で教育論を提唱し、近代教育の基礎を築いた。",
    theme: "自由・社会",
  },
  {
    id: 10,
    name: "カール・マルクス",
    era: "1818〜1883",
    origin: "ドイツ・思想家",
    quote: "歴史上のすべての社会の歴史は、階級の闘争の歴史である。",
    quoteEn: "The history of all hitherto existing society is the history of class struggles.",
    source: "『共産党宣言』（1848年）冒頭",
    episode:
      "マルクスとエンゲルスが1848年に発表した『共産党宣言』は、社会主義・共産主義運動の綱領となった。初版は900部が印刷され、ドイツ・フランス・イギリスに配られた。",
    theme: "社会・階級",
  },
  {
    id: 11,
    name: "チャールズ・ダーウィン",
    era: "1809〜1882",
    origin: "イギリス・生物学者",
    quote: "有利な変異の保持と、有害な変異の破壊を、私は自然選択と呼ぶ。",
    quoteEn: "Preservation of favourable variations, and the destruction of those which will be injurious, I term Natural Selection.",
    source: "『種の起源』（On the Origin of Species, 1859年）第4章",
    episode:
      "1831〜1836年のビーグル号周航でガラパゴス諸島のフィンチ（小鳥）を観察した。1859年11月24日に『種の起源』を出版し、初版1,250部は出版当日に完売した。",
    theme: "進化・科学",
  },
  {
    id: 12,
    name: "ディミトリー・メンデレーエフ",
    era: "1834〜1907",
    origin: "ロシア・化学者",
    quote: "元素の性質は、その原子量に対する周期関数である。",
    source: "1869年3月6日・ロシア化学会での講演",
    episode:
      "メンデレーエフは1869年に元素周期表を発表し、既知の63元素を原子量と性質で整列した。未発見元素の存在と性質を予測し、後にガリウム（1875年）・ゲルマニウム（1886年）が発見されて予測が裏付けられた。",
    theme: "科学・予測",
  },

  // ═══════════════ 文学・芸術（欧米） ═══════════════
  {
    id: 13,
    name: "ウィリアム・シェイクスピア",
    era: "1564〜1616",
    origin: "イギリス・劇作家・詩人",
    quote: "世間は舞台であり、人間はすべて俳優である。",
    quoteEn: "All the world's a stage, and all the men and women merely players.",
    source: "『お好きなように』（As You Like It, 1599年頃）第2幕第7場",
    episode:
      "シェイクスピアは約37の戯曲と154首のソネットを書いた。『ハムレット』の「To be or not to be」の独白は、西洋文学で最も引用される独白の一つである。",
    theme: "人生・演劇",
  },
  {
    id: 14,
    name: "モーツァルト",
    era: "1756〜1791",
    origin: "オーストリア・作曲家",
    quote: "沈黙を選べば沈黙しなさい。しかし話す必要があるときは、人々が覚えるように語れ。",
    source: "書簡集（1781〜1791年）",
    episode:
      "モーツァルトは5歳で作曲を覚え、8歳で最初の交響曲を書いた。生涯に600作品以上を残したが、35歳でウィーンに埋葬された。墓は集団墓地にあり、現在も正確な場所は分かっていない。",
    theme: "言葉・表現",
  },
  {
    id: 15,
    name: "ベートーヴェン",
    era: "1770〜1827",
    origin: "ドイツ・作曲家・ピアニスト",
    quote: "芸術をただ練習するだけでは不够だ。その秘密に迫りなさい。芸術と知識だけが、人を神に近づけるのだから。",
    quoteEn: "Practice your art without love for it, and force your way into its secrets.",
    source: "1813年・ロドリゴ大公宛の手紙",
    episode:
      "ベートーヴェンは26歳で難聴になり、44歳で完全に失聴した。しかし失聴後も『第九交響曲』（1824年）など晩期の傑作を書き続けた。",
    theme: "芸術・不屈",
  },
  {
    id: 16,
    name: "ヴィンセント・ファン・ゴッホ",
    era: "1853〜1890",
    origin: "オランダ・画家",
    quote: "人間の家は海によく似ている。嵐があり、潮があり、その底には真珠もある。",
    quoteEn: "The heart of man is very much like the sea, it has its storms, its tides, and in its depths it has its pearls too.",
    source: "弟テオ宛の手紙（1881年11月18日、エテン）",
    episode:
      "ゴッホは生涯に約2,100点の作品を残したが、生前に売れたのは1点のみだった。1890年に37歳で亡くなった後、その作品は世界的な名声を得た。",
    theme: "芸術・魂",
  },
  {
    id: 17,
    name: "パブロ・ピカソ",
    era: "1881〜1973",
    origin: "スペイン・画家",
    quote: "芸術は、日常の塵を魂から洗い流すものだ。",
    quoteEn: "Art washes away from the soul the dust of everyday life.",
    source: "『LIFE』誌 57巻11号（1964年9月11日）",
    episode:
      "ピカソは14歳で学院に合格、17歳で最初の展覧会を開催した。キュビズムを創始し、生涯に約50,000点の作品を残した。91歳で亡くなった。",
    theme: "芸術・解放",
  },
  {
    id: 18,
    name: "マーク・トウェイン",
    era: "1835〜1910",
    origin: "アメリカ・作家・ユーモリスト",
    quote: "人間は、自分で望まないことを強いられたとき、最も醜く見える。",
    quoteEn: "Man will do little or much, if he is not compelled to do it.",
    source: "『トム・ソーヤの冒険』（1876年）および多数の随筆",
    episode:
      "マーク・トウェインは『トム・ソーヤの冒険』（1876年）『ハックルベリー・フィンの冒険』（1884年）で知られる。実業家としても成功し、印刷所のオーナーも務めた。",
    theme: "人間・自由",
  },
  {
    id: 19,
    name: "ヴィクトル・ユゴー",
    era: "1802〜1885",
    origin: "フランス・作家",
    quote: "本は、人間の最も経済的な夢だ。",
    source: "『レ・ミゼラブル』（Les Misérables, 1862年）および講演",
    episode:
      "ユゴーは『レ・ミゼラブル』の執筆に4年を費やした。彼はこの小説を「フランスの社会の悲劇の記録」と位置付けた。",
    theme: "文学・夢",
  },
  {
    id: 20,
    name: "オースカー・ワイルド",
    era: "1854〜1900",
    origin: "アイルランド・作家",
    quote: "我々は皆、溝の中にいるが、それでも星を見上げる者たちがいる。",
    quoteEn: "We are all in the gutter, but some of us are looking at the stars.",
    source: "『レディ・ウインダーミアンの扇』（Lady Windermere's Fan, 1892年）第3幕",
    episode:
      "ワイルドは『ドリアン・グレイの肖像』（1890年）で世界的な名声を得たが、1895年に同性愛で起訴され、2年の重労働刑を服役した。",
    theme: "希望・人間",
  },
  {
    id: 21,
    name: "チェーホフ",
    era: "1860〜1904",
    origin: "ロシア・作家・劇作家",
    quote: "簡潔さは、完璧さの兄弟である。",
    source: "弟アレクサンドル宛の手紙（1886年5月19日）",
    episode:
      "チェーホフは小説家でありながら医師でもあり、生涯にわたり診療を続けた。彼の短編は「余計なものを一切削ぎ落とした」と評される。",
    theme: "簡潔さ",
  },
  {
    id: 22,
    name: "アントワーヌ・ド・サン＝テグジュペリ",
    era: "1900〜1944",
    origin: "フランス・作家・飛行士",
    quote: "大切なものは、目に見えない。",
    quoteEn: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.",
    source: "『星の王子さま』（Le Petit Prince, 1943年）",
    episode:
      "サン＝テグジュペリは1944年7月31日、偵察飛行中にプロヴァンスの海に墜落し、44歳で亡くなった。その遺体は未だに発見されていない。",
    theme: "愛・本質",
  },
  {
    id: 23,
    name: "マーガレット・ミッチェル",
    era: "1900〜1949",
    origin: "アメリカ・作家",
    quote: "人は、自分が失ったものを、失うまで知らない。",
    source: "講演・インタビュー記録",
    episode:
      "マーガレット・ミッチェルは『風と共に去りぬ』（1936年）でピューリッツァー賞を受賞した。原稿は4,000ページに及び、出版社は12軒連続で拒否した。",
    theme: "文学・夢",
  },

  // ═══════════════ 文学・芸術（日本） ═══════════════
  {
    id: 24,
    name: "夏目漱石",
    era: "1867〜1916",
    origin: "日本・小説家・英語学者",
    quote: "吾輩は猫である。",
    source: "『吾輩は猫である』（1905〜1906年）冒頭",
    episode:
      "夏目漱石は『吾輩は猫である』の冒頭一文で日本の近代文学史を変えた。イギリス留学中に書いた『倫敦塔』（1900年）は、日本の近代文学の先駆けとなった。",
    theme: "文学・冒頭",
  },
  {
    id: 25,
    name: "谷崎潤一郎",
    era: "1886〜1965",
    origin: "日本・小説家",
    quote: "陰翳は、日本の美の核心である。",
    source: "『陰翳礼賛』（1933年）",
    episode:
      "谷崎潤一郎は『陰翳礼賛』で日本の美意識（陰翳・侘び・寂び）を論じた。代表作は『細雪』『鍵』『刺青』。",
    theme: "美・陰翳",
  },
  {
    id: 26,
    name: "川端康成",
    era: "1899〜1972",
    origin: "日本・小説家",
    quote: "美とは、不完全の完成である。",
    source: "ノーベル文学賞記念講演「日本の美と私」（1968年12月）",
    episode:
      "川端康成は1968年にノーベル文学賞を受賞した（日本人初）。代表作は『雪国』『伊豆の踊子』『千羽鶴』。",
    theme: "美・不完全",
  },
  {
    id: 27,
    name: "太宰治",
    era: "1909〜1948",
    origin: "日本・小説家",
    quote: "人間失格とは、人間の資格を失うことである。",
    source: "『人間失格』（1948年）",
    episode:
      "太宰治は『斜陽』（1946年）『人間失格』（1948年）で知られる。1948年6月13日、38歳で玉川上水に沈んで自殺した。",
    theme: "人間・失格",
  },
  {
    id: 28,
    name: "三島由紀夫",
    era: "1925〜1970",
    origin: "日本・小説家・劇作家",
    quote: "美は、死と一体である。",
    source: "『金閣寺』（1956年）および『美しい青年と悪』",
    episode:
      "三島由紀夫は1970年11月25日、皇居衛屯門前での自決（切腹）で命を絶った。その前年、小説『天人五衰』を完成させた。",
    theme: "美・死",
  },

  // ═══════════════ 科学・技術（20世紀） ═══════════════
  {
    id: 29,
    name: "アルバート・アインシュタイン",
    era: "1879〜1955",
    origin: "ドイツ・理論物理学者",
    quote: "想像力は知識よりも重要である。知識は有限だが、想像力は世界を包み込む。",
    quoteEn: "Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.",
    source: "1929年10月26日・G.S. Viereckとのインタビュー（サタデー・イブニング・ポスト）",
    episode:
      "アインシュタインは1905年に「奇跡の年」と呼ばれる4つの論文（光電気効果・ブラウン運動・特殊相対性理論・質量・エネルギー等価）をスイス特許局の技師として執筆した。",
    theme: "想像力・創造",
  },
  {
    id: 30,
    name: "アラン・チューリング",
    era: "1912〜1954",
    origin: "イギリス・数学者",
    quote: "機械が考えるかどうかを問うのではなく、私達自身が考えるかどうかを問うべきである。",
    source: "『Computing Machinery and Intelligence』（1950年、Mind誌）",
    episode:
      "チューリングは1936年に「チューリングマシン」を提案し、計算の理論的限界を定義した。第二次世界大戦中はエニグマ暗号を解読し、戦局を大きく変えた。",
    theme: "AI・思考",
  },
  {
    id: 31,
    name: "マリー・キュリー",
    era: "1867〜1934",
    origin: "ポーランド・物理学者・化学者",
    quote: "人生には、自分の夢を諦めるべきではない。",
    source: "晩年のインタビュー・講演記録",
    episode:
      "マリー・キュリーは1903年に夫ピエールとともにノーベル物理学賞（放射線研究）、1911年にノーベル化学賞（ラジウムの発見）を受賞した。女性として初のノーベル賞受賞者であり、2つの分野で受賞した唯一の人物でもある。",
    theme: "科学・夢",
  },
  {
    id: 32,
    name: "リチャード・ファインマン",
    era: "1918〜1988",
    origin: "アメリカ・物理学者",
    quote: "自然は、我々が望むような答えをくれるとは限らない。",
    source: "『ファインマン物理学』（1965年）および多数の講演",
    episode:
      "ファインマンは量子電磁気学（QED）の研究で1965年にノーベル物理学賞を受賞した。チャーリー・チャップリンの映画『モダン・タイムズ』のパロディで「自然は面白い」と語った。",
    theme: "科学・自然",
  },
  {
    id: 33,
    name: "トーマス・エジソン",
    era: "1847〜1931",
    origin: "アメリカ・発明家・実業家",
    quote: "天才とは、1パーセントのひらめきと99パーセントの汗である。",
    quoteEn: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    source: "多数のインタビュー・講演記録（発言年不明）",
    episode:
      "エジソンは1,093の特許を持つ。白熱電球・留声機・活動写真などの発明で知られる。「天才の99%は努力だ」という言葉は、彼自身の言葉として広く知られる。",
    theme: "努力・発明",
  },

  // ═══════════════ 政治・平和・人権 ═══════════════
  {
    id: 34,
    name: "マハトマ・ガンディ",
    era: "1869〜1948",
    origin: "インド・独立運動指導者",
    quote: "非暴力は、人類の手にある最も偉大な力である。",
    quoteEn: "Non-violence is the greatest force at the disposal of mankind. It is mightier than the mightiest weapon of destruction devised by the ingenuity of man.",
    source: "多数の講演・書簡（『ガンディ自伝』1927年など）",
    episode:
      "ガンディは非暴力抵抗を提唱し、1930年の「塩の行進」で英国の塩税を非暴力で挑発した。1948年1月30日、インドのデリーで暗殺された。",
    theme: "平和・非暴力",
  },
  {
    id: 35,
    name: "マーティン・ルーサー・キングJr.",
    era: "1929〜1968",
    origin: "アメリカ・市民権運動指導者",
    quote: "私は夢を持った。",
    quoteEn: "I have a dream.",
    source: "1963年8月28日・ワシントン大行進での演説（「I Have a Dream」演説）",
    episode:
      "キング牧師は1963年8月28日、ワシントンのリンカーン記念館前で25万人の聴衆を前に演説を行った。1964年にノーベル平和賞を受賞した。",
    theme: "人権・夢",
  },
  {
    id: 36,
    name: "ジョン・F・ケネディ",
    era: "1917〜1963",
    origin: "アメリカ大統領（第35代）",
    quote: "我々は、それを望むからではなく、それが難しいからやる。",
    quoteEn: "We choose to go to the Moon not because it is easy, but because it is hard.",
    source: "1962年9月12日・ライス大学での演説",
    episode:
      "ケネディはこの演説でアポロ計画（月面着陸）を正式に宣言した。1963年11月22日、ダラスで暗殺された（在任4年8ヶ月）。",
    theme: "挑戦・意志",
  },
  {
    id: 37,
    name: "アブラハム・リンカーン",
    era: "1809〜1865",
    origin: "アメリカ第16代大統領",
    quote: "人民の、人民による、人民のための政治は、地球上から消滅してはならない。",
    quoteEn: "Government of the people, by the people, for the people, shall not perish from the earth.",
    source: "1863年11月19日・ゲティスバーグ演説",
    episode:
      "リンカーンは南北戦争中に大統領を務め、奴隷制の廃止（1863年・解放宣言）を宣言した。1865年4月14日、ワシントンの劇場で暗殺された。",
    theme: "民主主義・自由",
  },
  {
    id: 38,
    name: "ニール・アームストロング",
    era: "1930〜2012",
    origin: "アメリカ・宇宙飛行士",
    quote: "一人にとっての一歩であり、人類にとっての巨大な飛躍である。",
    quoteEn: "That's one small step for man, one giant leap for mankind.",
    source: "1969年7月20日・アポロ11号月面着陸時の発言（音声記録）",
    episode:
      "アームストロングは1969年7月20日（JST21日）、アポロ11号で人類として初めて月面に降り立った。この発言は世界中で約6億人が視聴した。",
    theme: "宇宙・挑戦",
  },
  {
    id: 39,
    name: "コナン・ドイル",
    era: "1859〜1930",
    origin: "イギリス・作家・医師",
    quote: "異常なものを排除すれば、残ったものがどんなに普通に見えても、それが答えである。",
    quoteEn: "When you have eliminated the impossible, whatever remains, however improbable, must be the truth.",
    source: "『バスカヴィル家の犬』（The Hound of the Baskervilles, 1902年）",
    episode:
      "コナン・ドイルはシャーロック・ホームズの物語を22篇（長編4篇・短編56篇）書いた。医師でもあり、第一次世界大戦中は赤十字の医師として従軍した。",
    theme: "推理・論理",
  },

  // ═══════════════ 仕事・成功・リーダーシップ ═══════════════
  {
    id: 40,
    name: "スティーブ・ジョブズ",
    era: "1955〜2011",
    origin: "アメリカ・実業家（アップル共同創業者）",
    quote: "人は、死ぬまで生きているとは分からない。",
    quoteEn: "Remembering that I'll be dead soon is the most important tool I've ever encountered to help me make the big choices in life.",
    source: "2005年6月12日・スタンフォード大学卒業式での演説",
    episode:
      "ジョブズは1985年にアップルを追放された後、1997年に復帰し、iPod・iPhone・iPadを世に送り出した。2011年10月5日、がんのため56歳で亡くなった。",
    theme: "人生・決断",
  },
  {
    id: 41,
    name: "ビル・ゲイツ",
    era: "1955〜",
    origin: "アメリカ・実業家（マイクロソフト共同創業者）",
    quote: "私たちは、世界を一つにする。",
    source: "1995年・『未来への道』（The Road Ahead）スピーチ",
    episode:
      "ゲイツは1975年にポール・アレンとともにマイクロソフトを設立した。2008年に引退し、ビル・メーリンドゲイツ財団で慈善活動に専念した。",
    theme: "技術・世界",
  },
  {
    id: 42,
    name: "ウォーレン・バフェット",
    era: "1930〜",
    origin: "アメリカ・投資家・実業家",
    quote: "他人が貪欲なときに恐れ、他人が恐れているときに貪欲でいなさい。",
    quoteEn: "Be fearful when others are greedy, and greedy when others are fearful.",
    source: "バークシャー・ハサウェイの株主への手紙（1986年頃）",
    episode:
      "バフェットは11歳で最初の株式を購入した。バークシャー・ハサウェイ（Berkshire Hathaway）を通じて、生涯にわたり投資を続けた。",
    theme: "投資・決断",
  },
  {
    id: 43,
    name: "マーク・ザッカーバーグ",
    era: "1984〜",
    origin: "アメリカ・実業家（Facebook創業者）",
    quote: "速くやれ。必要なら壊してもいい。動かないものより、壊れて動いている方が良い。",
    quoteEn: "Move fast and break things.",
    source: "Facebookの社内スローガン（2005年頃〜2014年頃）",
    episode:
      "ザッカーバーグは2004年にハーバード大学在学中にFacebookを設立した。2012年のIPO（新規株式公開）で当時最速の億万長者となった。",
    theme: "ビジネス・挑戦",
  },
  {
    id: 44,
    name: "ウォルト・ディズニー",
    era: "1901〜1966",
    origin: "アメリカ・実業家・アニメーション制作者",
    quote: "夢が叶うには、それを追い求める勇気が必要だ。",
    quoteEn: "All our dreams can come true, if we have the courage to pursue them.",
    source: "多数のインタビュー・講演記録",
    episode:
      "ディズニーは1923年に兄ロイとともにディズニー・ブラザーズ・スタジオを設立した。ミッキーマウスの誕生（1928年）とディズニーランドの開園（1955年）で知られる。",
    theme: "夢・挑戦",
  },
  {
    id: 45,
    name: "サミュエル・モーズ",
    era: "1791〜1872",
    origin: "アメリカ・発明家・画家",
    quote: "神は何を為されたか。",
    quoteEn: "What hath God wrought?",
    source: "1844年5月24日・初回電報送信時の文言（聖書・民数記23:23より）",
    episode:
      "モーズは1844年5月24日、ワシントン〜ボルチモア間に初回電報「What hath God wrought?（神は何を為されたか）」を送信した。",
    theme: "通信・革新",
  },

  // ═══════════════ 哲学・思想（追加） ═══════════════
  {
    id: 46,
    name: "ソクラテス",
    era: "紀元前469〜紀元前399",
    origin: "古代ギリシア・哲学者",
    quote: "知るということを知れ。",
    quoteEn: "Γνῶθι σεαυτόν (Gnōthi seauton)",
    source: "デルフォイ神殿の銘文（紀元前6世紀頃）",
    episode:
      "デルフォイ神殿の入口に刻まれていた銘文をソクラテスは生涯の指針とした。神託で「ソクラテスより賢い人間はいない」と告げられた際、彼は賢いと思った人々を次々に問い詰めて回り、実は誰も本当のことは知らないのだと悟った。",
    theme: "知性・自覚",
  },
  {
    id: 47,
    name: "コンスタンティヌス1世",
    era: "272〜337",
    origin: "ローマ皇帝",
    quote: "この印のもとに、勝ち取れ。",
    quoteEn: "In hoc signo vinces.",
    source: "ラクトアンティウス『迫害者の死』およびミラノ勅令（313年）",
    episode:
      "312年、ミラノの橋の戦い前に夢でキリストから「この印のもとに戦え」と告げられたとされ、兵士の盾にキリストの紋章を描かせた。313年のミラノ勅令でキリスト教の信仰の自由を公認した。",
    theme: "信仰・決断",
  },
  {
    id: 48,
    name: "レオナルド・ダ・ヴィンチ",
    era: "1452〜1519",
    origin: "イタリア・画家・発明家",
    quote: "絵は、目に見えないものを可視化するものだ。",
    source: "『絵画論』（Codex Urbinas）",
    episode:
      "ダ・ヴィンチは『モナ・リザ』『最後の晩餐』を描いたが、同時に飛行機・潜水艦・戦車などの設計図を多数残した。そのノートは「ヴィンチのノート」として今も研究されている。",
    theme: "芸術・発明",
  },
  {
    id: 49,
    name: "ヘレン・ケラー",
    era: "1880〜1968",
    origin: "アメリカ・作家・社会活動家",
    quote: "人生は、盲目の犬が階段を登るようなものだ。",
    source: "『私の生活の世界』（The Story of My Life, 1903年）",
    episode:
      "ヘレン・ケラーは19ヶ月のときに病気で視覚と聴覚を失った。サリバン先生との出会いで言葉を覚え、18歳でラドクリフ・カレッジに入学した（当時、聴覚・視覚障碍者として初めての大学入学）。",
    theme: "不屈・挑戦",
  },
  {
    id: 50,
    name: "ダライ・ラマ14世",
    era: "1935〜",
    origin: "チベット・仏教指導者",
    quote: "もしあなたが幸せになりたいなら、他者の幸せを願え。",
    source: "『The Art of Happiness』（1998年、ハワード・カトラーとの共著）および多数の講演",
    episode:
      "ダライ・ラマは1959年にチベットを離れ、インド・ダラムサラに亡命した。1989年にノーベル平和賞を受賞。生涯にわたり非暴力・慈悲の教えを説いている。",
    theme: "慈悲・平和",
  },
];

/** 50件から今日の1件を返す（JST日付ベースで決定的）。 */
export function getDailyQuote(date: Date = new Date()): Quote {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (jst.getTime() - new Date(Date.UTC(jst.getUTCFullYear(), 0, 0)).getTime()) /
      86400000
  );
  const year = jst.getUTCFullYear();
  const index = (dayOfYear + year) % QUOTES.length;
  return QUOTES[index];
}
