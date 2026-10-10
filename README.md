# 毎朝ニュース (デジタルサイネージ)

日本のニュース(日経新聞・日経ビジネス)を **最新10件を10秒間隔のスライドショー**で表示する、
デジタルサイネージ向けの Next.js ページ。
**Vercel** にデプロイし、**GitHub** をソースとしてプッシュで自動デプロイする。
毎朝 **Vercel Cron** でニュースをリフレッシュする。

AI 機能は **Vercel AI SDK** + **OITOMA(岡山大学の OpenAI 互換モデル)** で提供。

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

http://localhost:3000 を開く(RSS 部分はキー不要)。

### OITOMA AI を接続する

1. `.env.example` を `.env.local` にコピー(既に存在する場合はそのままでよい)
2. OITOMA の管理画面から **API キー** と **ベース URL** を取得
3. `.env.local` に記入:

   ```
   OITOMA_BASE_URL=https://api.oitoma.example/v1   # ← 実際の URL
   OITOMA_API_KEY=sk-...
   OITOMA_MODEL=oitoma/qwen3.8-27b-it
   ```

4. `npm run dev` を再起動
5. テスト:

   ```bash
   curl -X POST http://localhost:3000/api/ai \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"こんにちは"}],"stream":false}'
   ```

   → `{"ok":true,"text":"..."}` が返れば連携成功。

### Vercel にデプロイする

`vercel` CLI または [vercel.com/new](https://vercel.com/new) でデプロイ後、
**Project Settings → Environment Variables** に 3 環境変数
(`OITOMA_BASE_URL` / `OITOMA_API_KEY` / `OITOMA_MODEL`)を Production + Preview に追加する。

## AI API (`/api/ai`)

- **POST** `/api/ai`
  - Body: `{ messages: ModelMessage[], model?, maxOutputTokens?, stream? }`
  - `stream: true`(既定) → AI SDK UI message stream(クライアントの `useChat({ api: "/api/ai" })` とそのまま連携)
  - `stream: false` → `{ ok, text, usage }` の JSON

`useChat` での例(クライアントコンポーネント内):

```tsx
"use client";
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, status } =
    useChat({ api: "/api/ai" });
  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <p key={m.id}>{m.role}: {m.content}</p>
      ))}
      <input
        value={input}
        onChange={handleInputChange}
        placeholder={status === "streaming" ? "…" : "質問を入力"}
      />
    </form>
  );
}
```

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
2. **Environment Variables** に `OITOMA_BASE_URL` / `OITOMA_API_KEY` /
   `OITOMA_MODEL` を追加(「OITOMA AI を接続する」節を参照)
3. **Deploy**

`vercel.json` の cron 定義により、デプロイの直後に毎日朝 6:00 に
`/api/cron` が呼び出され、ニュースがリフレッシュされます。

## プロジェクト構造

```
app/
  page.tsx            # 記事を取得して SignageShow に渡す
  layout.tsx          # ルートレイアウト(フルスクリーン・暗い背景)
  api/
    ai/route.ts       # OITOMA へのプロキシ(AI SDK ストリーム対応)
    cron/route.ts     # Vercel Cron のターゲット。revalidateTag で更新
components/
  SignageShow.tsx     # スライドショー(最新10件・10秒間隔・アニメーション)
lib/
  newsApi.ts          # RSS 取得 + XML パース + 記事の整形/マージ
  news.ts             # use cache によるキャッシュラッパー
  oitoma.ts           # OITOMA プロバイダ(AI SDK createOpenAICompatible)
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
