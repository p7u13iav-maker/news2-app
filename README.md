# 毎朝ニュース (デジタルサイネージ)

日本のニュース(日経新聞・日経ビジネス)を **最新10件を10秒間隔のスライドショー**で表示する、
デジタルサイネージ向けの Next.js ページ。
**Vercel** にデプロイし、**GitHub** をソースとしてプッシュで自動デプロイする。
毎朝 **Vercel Cron** でニュースをリフレッシュする。

## 特徴(サイネージ)

- **フルスクリーン表示**(スクロールなし・大文字・暗い背景)
- **最新10件**を **10秒間隔**でスライド切替
- 見出し + **本文(リード文)** + **記事写真**(右側、写真がある記事のみ)
- スライドアニメーション(フェード/スライドイン)+ 進捗バー + 実時計
- 文字サイズは画面に全体が収まるよう調整済み
- **日経新聞**(business、RDF 1.0) と **日経ビジネス**(RSS 2.0) を直接取得
- **API キー不要**(RSS は公開フィードなので環境変数不要)
- **Vercel Cron** が毎日朝 6:00 に `/api/cron` を叩き、`revalidateTag` で強制更新
- `use cache` + `cacheLife('minutes')` で 1 分ごとに自動再検証
- GitHub にプッシュ → Vercel が自動デプロイ

## サイネージとして使う

1. デプロイ後、URL をブラウザで**フルスクリーン(F11)**にして表示
2. サイネージ機器(テレビ + Chrome など)で URL を開く
   - 自動再生・自動フルスクリーン設定はお使いの環境に合わせて
   - 例: Chrome の `--kiosk --start-fullscreen` 起動
3. 10秒ごとに次のニュースへ自動切替、10件で一周

## セットアップ

### ローカルで試す

```bash
npm install
npm run dev
```

http://localhost:3000 を開く(RSS は公開フィードなのでキー不要)。

### Vercel にデプロイする

`vercel` CLI または [vercel.com/new](https://vercel.com/new) でデプロイするだけ。
環境変数は**不要**です。

### GitHub に push して Vercel にデプロイ

```bash
git init
git add -A
git commit -m "feat: morning news page"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/<リポジトリ名>.git
git push -u origin main
```

その後:

1. [vercel.com/new](https://vercel.com/new) に GitHub リポジトリを import する
   (Framework: Next.js は自動認識)
2. **Deploy**(環境変数不要)

`vercel.json` の cron 定義により、デプロイの直後に毎日朝 6:00 に
`/api/cron` が呼び出され、ニュースがリフレッシュされます。

## プロジェクト構造

```
app/
  page.tsx            # 記事を取得して SignageShow に渡す
  layout.tsx          # ルートレイアウト(フルスクリーン・暗い背景)
  api/
    cron/route.ts     # Vercel Cron のターゲット。revalidateTag で更新
components/
  SignageShow.tsx     # スライドショー(最新10件・10秒間隔・アニメーション)
lib/
  newsApi.ts          # RSS 取得 + XML パース + 記事の整形/マージ
  news.ts             # use cache によるキャッシュラッパー
vercel.json           # cron 定義(毎日朝 6:00)
```

## 仕組み

1. **毎朝**: Vercel Cron が `0 6 * * *` に `/api/cron` を呼ぶ
2. **cron**: 日経新聞 + 日経ビジネスの RSS を取得 → `revalidateTag("news", "max")`
3. **ページ**: 次回のアクセス時に fresh なニュースで再レンダリング
4. **通常時**: `cacheLife('minutes')` が 1 分ごとにバックグラウンド再検証
5. **表示**: `SignageShow` が最新10件を 10秒ごとにスライド切替(クライアント)

## カスタマイズ

- **表示時間を変える**: `vercel.json` の `schedule` を変更(例 `0 7 * * *`)
- **RSS ソースを変える/追加**: `lib/newsApi.ts` の `FEEDS` 配列に
  `{ label: "サイト名", url: "https://..." }` を追加
- **表示件数**: `app/page.tsx` の `count`(スライドで表示する件数、既定 10)
- **スライド間隔**: `components/SignageShow.tsx` の `SLIDE_MS`(既定 10000ms = 10秒)

### 補足: RSS 形式について

- **日経新聞**(`assets.wor.jp/rss/rdf/nikkei/business.rdf`)は **RDF 1.0** 形式
  (`<item rdf:about="...">`、日付は `<dc:date>`)。
- **日経ビジネス**(`business.nikkei.com/rss/sns/nb.rdf`)は **RSS 2.0** 形式
  (`<item>`, `<dc:date>`)。
- 両形式を `lib/newsApi.ts` のパーサーが自動判別・解析します。

### 補足: 本文と画像について

- **本文(リード文)**: 日経の RSS は説明文を含んでいないため、記事 URL の
  `<meta name="og:description">` を取得して表示しています。
- **記事写真**: 記事 URL の `<meta name="og:image">` を取得し、スライド右側に
  表示しています(写真がある記事のみ)。
- 本文・画像とも**取得失敗しても記事は表示**されます(タイトルだけの表示)。
