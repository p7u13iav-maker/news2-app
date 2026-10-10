import { getMorningNews } from "@/lib/news";
import { TOP_HEADLINES } from "@/lib/newsApi";
import ArticleCard from "@/components/ArticleCard";
import Clock from "@/components/Clock";

/**
 * The page reads from a `'use cache'` scope (getMorningNews) with
 * cacheLife('minutes'), so it is automatically revalidated in the background.
 * A Vercel Cron hits /api/cron every morning, which calls revalidateTag so the
 * first visitor of the day gets the freshest batch immediately.
 */
export default async function Home() {
  const articles = await getMorningNews();
  const hasKey = Boolean(process.env.GNEWS_KEY);
  const top = articles.slice(0, TOP_HEADLINES);
  const rest = articles.slice(TOP_HEADLINES);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">
            毎朝ニュース
          </h1>
          <Clock />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {!hasKey && (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ニュース API のキーが設定されていません。 Vercel の環境変数に{" "}
            <code className="font-mono">GNEWS_KEY</code>{" "}
            を設定すると、ここから日本の朝のニュースが表示されます。
          </div>
        )}

        {hasKey && articles.length === 0 && (
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            現在取得できるニュースがありません。しばらくしてから再読み込みしてください。
          </div>
        )}

        {articles.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span className="h-4 w-1 rounded bg-rose-500" />
              トップニュース
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {top.map((a) => (
                <ArticleCard key={a.url} article={a} featured />
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span className="h-4 w-1 rounded bg-zinc-400" />
              その他のニュース
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.url} article={a} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-zinc-400 sm:flex-row">
          <span>ニュース提供: 日本 via GNews</span>
          <span>1 分ごとに自動再検証 · 毎朝の Cron でリフレッシュ</span>
        </div>
      </footer>
    </div>
  );
}
