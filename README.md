# 毎朝ニュース (デジタルサイネージ)

日本のニュース(**NHK NEWS WEB** と **日経新聞/日経ビジネス**)を **最新10件を10秒間隔のスライドショー**で表示する、
デジタルサイネージ向けの Next.js ページ。
**Vercel** にデプロイし、**GitHub** をソースとしてプッシュで自動デプロイする。
毎朝 **Vercel Cron** でニュースをリフレッシュする。

## 特徴(サイネージ)

- **フルスクリーン表示**(スクロールなし・大文字・暗い背景)
- **最新10件**を **10秒間隔**でスライド切替
- 見出し + **本文(リード文)** + **記事写真**(右側、写真がある記事のみ)
- スライドアニメーション(フェード/スライドイン)+ 進捗バー + 実時計
- 文字サイズは画面に全体が収まるよう調整済み
- **NHK NEWS WEB**(4カテゴリ) と **日経新聞/日経ビジネス** の RSS を直接取得
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

## ニュースサマリー(AI 要約)

`/summary` ページは、**OITOMA AI**(岡山大学の OpenAI 互換モデル)を使って
その日のニュースを 3 つのカテゴリに分類して箇条書きで要約します:

- 🇯🇵 **国内の出来事**: 日本の国内で起きた出来事
- 🌍 **国外の出来事**: 海外・国際で起きた出来事
- 📈 **経済ニュース**: 日本を含む世界の経済ニュース

メインページのヘッダーにある「📋 ニュースサマリー」ボタンから移動できます。

### 設定(必要な場合)

AI 要約機能を使うには `OITOMA_API_KEY` が必要です:

1. https://ironical.okayama-u.ac.jp/ai/keys で API キーを発行
2. Vercel: Project Settings → Environment Variables に `OITOMA_API_KEY` を追加
3. ローカル: `.env.local` に `OITOMA_API_KEY=sk-...` を記入

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
2. **cron**: NHK + 日経の RSS を取得 → `revalidateTag("news", "max")`
3. **ページ**: 次回のアクセス時に fresh なニュースで再レンダリング
4. **通常時**: `cacheLife('minutes')` が 1 分ごとにバックグラウンド再検証
5. **表示**: `SignageShow` が最新10件を 10秒ごとにスライド切替(クライアント)

## カスタマイズ

- **表示時間を変える**: `vercel.json` の `schedule` を変更(例 `0 7 * * *`)
- **RSS ソースを変える/追加**: `lib/newsApi.ts` の `FEEDS` 配列に
  `{ label: "サイト名", url: "https://..." }` を追加
- **表示件数**: `app/page.tsx` の `count`(スライドで表示する件数、既定 10)
- **スライド間隔**: `components/SignageShow.tsx` の `SLIDE_MS`(既定 10000ms = 10秒)

### 補足: RSS ソースについて

- **NHK NEWS WEB**(`news.web.nhk/n-data/conf/na/rss/`)は **RSS 2.0** 形式
  (`<item>`, `<pubDate>`)。4 カテゴリ(主要+社会+経済+国際)を組み合わせ、
  10 件以上を確実に取得します。各記事の `<description>` に**リード文が
  含まれている**ため、記事ページへの追加 fetch は本文には不要です。
- **日経新聞**(`assets.wor.jp/rss/rdf/nikkei/business.rdf`)は **RDF 1.0** 形式、
  **日経ビジネス**(`business.nikkei.com/rss/sns/nb.rdf`)は **RSS 2.0** 形式。
  本文と画像は記事ページから取得します。

### 補足: 本文と画像について

- **NHK**: RSS の `<description>` をそのまま本文として表示します。
- **日経**: 記事 URL の `<meta name="og:description">` から本文を取得し、
  **2文目(2つ目の「。」)まで**に短縮して表示します(長くなるため)。
- **記事写真**: 記事 URL の `<meta name="og:image">` を取得し、スライド右側に
  表示しています(写真がある記事のみ)。
- 本文・画像とも**取得失敗しても記事は表示**されます。
