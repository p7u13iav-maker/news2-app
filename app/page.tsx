import { getMorningNews } from "@/lib/news";
import SignageShow from "@/components/SignageShow";

/**
 * Digital-signage layout.
 *
 * The page fetches the latest headlines (cached with cacheLife('minutes') and
 * refreshed by the morning cron) and hands them to the client-side
 * SignageShow, which displays the top 10 one at a time, advancing every 10s.
 *
 * Designed for a kiosk / signage display: full-screen, large type, no scroll.
 */
export default async function Home() {
  const articles = await getMorningNews();

  return <SignageShow articles={articles} count={10} />;
}
