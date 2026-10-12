import { NextResponse } from "next/server";
import { fetchTrendingNews } from "@/lib/trending";

/**
 * GET /api/trending
 *
 * Returns the top-10 most attention-grabbing news items from the past 48
 * hours, split into 4 segments (world / japan / economy / technology).
 *
 * Data source: Google News RSS (no API key). Each segment is a Japanese
 * keyword query scoped to the last two days (`qdr=2d`). Items are ranked by a
 * simple attention score (recency + source prestige).
 */
export async function GET() {
  try {
    const data = await fetchTrendingNews();
    return NextResponse.json({ ok: true, date: new Date().toISOString(), ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch trending news: " + msg },
      { status: 500 },
    );
  }
}
