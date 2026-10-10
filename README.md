# 毎朝ニュース (Morning News)

毎朝、日本のニュースを **NHK** と **GIGAZINE** の RSS から取得して表示する Next.js ページ。
**Vercel** にデプロイし、**GitHub** をソースとしてプッシュで自動デプロイする。
毎朝 **Vercel Cron** でニュースをリフレッシュする。

## 特徴

- **Next.js 16 (App Router) + Tailwind CSS 4**
- **NHK**(総合ニュース) と **GIGAZINE**(IT・科学) の RSS を直接取得
- **API キー不要**(RSS は公開フィードなので環境変数不要)
- **Vercel Cron** が毎日朝 6:00 に `/api/cron` を叩き、`revalidateTag` でページを強制更新
- `use cache` + `cacheLife('minutes')` で 1 分ごとに自動再検証
- GitHub にプッシュ → Vercel が自動デプロイ

## セットアップ

### ローカルで試す

```bash
npm install
npm run dev
```

http://localhost:3000 を開く(キーは不要)。

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
2. **Deploy**(環境変数は不要)

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
  ArticleCard.tsx     # ニュースカード(ソース・時刻・説明文)
  Clock.tsx           # ヘッダーの日付・時刻(クライアント)
  TimeAgo.tsx         # "x 分前"(クライアント)
lib/
  newsApi.ts          # RSS 取得 + XML パース + 記事の整形/マージ
  news.ts             # use cache によるキャッシュラッパー
vercel.json           # cron 定義(毎日朝 6:00)
```

## 仕組み

1. **毎朝**: Vercel Cron が `0 6 * * *` に `/api/cron` を呼ぶ
2. **cron**: NHK + GIGAZINE の RSS を取得 → `revalidateTag("news", "max")`
3. **ページ**: 次回のアクセス時に fresh なニュースで再レンダリング
4. **通常時**: `cacheLife('minutes')` が 1 分ごとにバックグラウンド再検証

## カスタマイズ

- **表示時間を変える**: `vercel.json` の `schedule` を変更(例 `0 7 * * *`)
- **RSS ソースを変える/追加**: `lib/newsApi.ts` の `FEEDS` 配列に
  `{ label: "サイト名", url: "https://..." }` を追加
- **表示件数**: `lib/newsApi.ts` の `TOP_HEADLINES` / `mergeArticles` の `max`

### 補足: 画像について

NHK と GIGAZINE の RSS は `<enclosure>` や `<img>` を含んでいないため、
記事カードは**画像なし(テキストのみ)**で表示されます。
画像付きにしたい RSS ソースを追加した場合、`<enclosure ... type="image/...">`
や `<description>` 内の `<img src>` があれば自動的に表示されます。
