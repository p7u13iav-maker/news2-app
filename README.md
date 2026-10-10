# 毎朝ニュース (Morning News)

毎朝、日本と世界のニュースを **NewsAPI** から取得して表示する Next.js ページ。
**Vercel** にデプロイし、**GitHub** をソースとしてプッシュで自動デプロイする。
毎朝 **Vercel Cron** でニュースをリフレッシュする。

## 特徴

- **Next.js 16 (App Router) + Tailwind CSS 4**
- **NewsAPI** で日本 (`jp`) と世界 (`us`) のトップニュースを取得
- **Vercel Cron** が毎日朝 6:00 (JST/UTC) に `/api/cron` を叩き、`revalidateTag` でページを強制更新
- `use cache` + `cacheLife('minutes')` で 1 分ごとに自動再検証(レート制限に配慮)
- GitHub にプッシュ → Vercel が自動デプロイ

## セットアップ

### 1. ニュース API キーの取得

[newsapi.org/register](https://newsapi.org/register) で無料キーを取得する
(無料プランは 1 日 100 リクエスト / 開発用途)。

### 2. ローカルで試す

```bash
npm install
cp .env.example .env.local   # 中の NEWSAPI_KEY= に自分のキーを入力
npm run dev
```

http://localhost:3000 を開く。

### 3. GitHub に push して Vercel にデプロイ

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
2. **Environment Variables** に `NEWSAPI_KEY=<キー>` を追加
   (Production / Preview / Development いずれも)
3. Deploy

`vercel.json` の cron 定義により、デプロイの直後に毎日朝 6:00 に
`/api/cron` が呼び出され、ニュースがリフレッシュされます。

## プロジェクト構造

```
app/
  page.tsx            # メインページ(ニュース一覧)
  layout.tsx          # ルートレイアウト
  api/
    cron/route.ts     # Vercel Cron のターゲット。revalidateTag で更新
components/
  ArticleCard.tsx     # ニュースカード(画像・ソース・時刻)
  Clock.tsx           # ヘッダーの日付・時刻(クライアント)
  TimeAgo.tsx         # "x 分前"(クライアント)
lib/
  newsApi.ts          # NewsAPI クライアント + 記事の整形/マージ
  news.ts             # use cache によるキャッシュラッパー
vercel.json           # cron 定義(毎日朝 6:00)
.env.example          # 環境変数のひな型
```

## 仕組み

1. **毎朝**: Vercel Cron が `0 6 * * *` に `/api/cron` を呼ぶ
2. **cron**: NewsAPI を叩いて最新記事を取得 → `revalidateTag("news", "max")`
3. **ページ**: 次回のアクセス時に fresh なニュースで再レンダリング
4. **通常時**: `cacheLife('minutes')` が 1 分ごとにバックグラウンド再検証

## カスタマイズ

- **表示時間を変える**: `vercel.json` の `schedule` を変更(例 `0 7 * * *`)
- **国・カテゴリ**: `lib/newsApi.ts` の `fetchHeadlines` を変更
  (例: `country: "jp"` を `"us"` に、`category` を `"business"` などに)
- **表示件数**: `lib/newsApi.ts` の `TOP_HEADLINES` / `mergeArticles` の `max`
