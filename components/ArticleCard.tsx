import Image from "next/image";
import type { Article } from "@/lib/newsApi";
import TimeAgo from "@/components/TimeAgo";

export default function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        featured ? "sm:flex-row" : ""
      }`}
    >
      {article.urlToImage && (
        <div
          className={
            featured
              ? "aspect-video w-full shrink-0 sm:aspect-auto sm:w-2/5"
              : "aspect-video w-full"
          }
        >
          <Image
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-cover"
            // next/image requires a fixed size when the layout is unknown.
            // We size the wrapper with aspect-ratio and stretch the image.
            width={800}
            height={450}
            sizes={featured ? "(max-width: 640px) 100vw, 40vw" : "(max-width: 1024px) 50vw, 33vw"}
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-500">{article.source}</span>
          <span aria-hidden>·</span>
          <span>
            <TimeAgo iso={article.publishedAt} />
          </span>
        </div>
        <h3
          className={`font-semibold leading-snug text-zinc-900 group-hover:text-rose-600 ${
            featured ? "text-base sm:text-lg" : "text-sm"
          }`}
        >
          {article.title}
        </h3>
        {article.description && (
          <p
            className={`mt-2 text-zinc-500 ${
              featured ? "line-clamp-3 text-sm" : "line-clamp-2 text-xs"
            }`}
          >
            {article.description}
          </p>
        )}
      </div>
    </a>
  );
}
