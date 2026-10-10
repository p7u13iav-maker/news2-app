"use client";

import { useEffect, useState } from "react";

/**
 * The header's clock and date are rendered on the client so they never clash
 * with Next.js's static prerender (which forbids calling new Date() during a
 * build). They update live every minute.
 */
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="flex flex-col items-end text-sm text-zinc-400">
        <span>最終更新: --:--</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end text-sm text-zinc-400">
      <span>
        {now.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })}
      </span>
      <span>
        最終更新:{" "}
        {now.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
