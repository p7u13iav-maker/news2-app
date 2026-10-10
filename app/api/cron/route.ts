import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchHeadlines } from "@/lib/newsApi";
import { NEWS_TAG } from "@/lib/news";

/**
 * Vercel Cron target (see vercel.json). Runs once every morning and:
 *
 *  1. Forces a fresh fetch of the RSS feeds (NHK + GIGAZINE), bypassing cache.
 *  2. Calls revalidateTag("news") so the next page request re-renders with the
 *     fresh headlines (stale-while-revalidate).
 *
 * The tag invalidation is what keeps the page current; the fetch above is a
 * cheap "warm-up" that also surfaces feed errors in the cron logs.
 */
export async function GET() {
  const started = Date.now();
  try {
    const count = (await fetchHeadlines()).length;
    revalidateTag(NEWS_TAG, "max");
    return NextResponse.json({
      ok: true,
      count,
      ms: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message, ms: Date.now() - started },
      { status: 500 },
    );
  }
}
