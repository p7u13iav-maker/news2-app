import { Suspense } from "react";
import { connection } from "next/server";
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
 *
 * The news + trending data are fetched fresh at request time (no cache) so
 * the 8 news slides stay in sync with the trending ranking. The fetch is
 * wrapped in <Suspense> so the static shell ships instantly while the live
 * data streams in.
 */

async function SignageContent() {
  // Defer to request time so Date.now() inside the trending pipeline is
  // evaluated per-request, not at build time.
  await connection();
  const articles = await getMorningNews();
  return <UnifiedSignage articles={articles} newsCount={8} />;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <SignageContent />
    </Suspense>
  );
}
