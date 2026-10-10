"use client";

import { useEffect, useState } from "react";

/**
 * "x 分前"-style timestamp, computed on the client so the static prerender
 * (which forbids new Date() / Date.now() at build time) is not blocked.
 */
export default function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    function update() {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return setLabel("");
      const diff = Date.now() - then;
      const min = Math.floor(diff / 60000);
      if (min < 1) setLabel("たった今");
      else if (min < 60) setLabel(`${min} 分前`);
      else {
        const hr = Math.floor(min / 60);
        if (hr < 24) setLabel(`${hr} 時間前`);
        else setLabel(`${Math.floor(hr / 24)} 日前`);
      }
    }
    update();
    const id = setInterval(update, 60 * 1000);
    return () => clearInterval(id);
  }, [iso]);

  return <>{label}</>;
}
