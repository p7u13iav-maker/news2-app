import { getMorningNews } from "@/lib/news";
import UnifiedSignage from "@/components/UnifiedSignage";

/**
 * Unified digital-signage layout.
 *
 * Rotates through 4 sections in a single fullscreen slideshow:
 *   1.  📋 Summary   (AI-categorized news: domestic / international / economy)
 *   2.  📊 Market    (bond yields + US/JP stocks with sparklines)
 *   3-10. 📰 News    (8 latest headlines with photos)
 *   11-13. ✨ Horoscope (12 zodiac signs, 4 per page × 3 pages)
 *
 * Each slide shows for 10 seconds. Full cycle: 130 seconds (2 min 10 sec).
 * Data is fetched server-side and cached for the day (refreshed by cron at 6:30).
 */
export default async function Home() {
  const articles = await getMorningNews();

  return <UnifiedSignage articles={articles} newsCount={8} />;
}
