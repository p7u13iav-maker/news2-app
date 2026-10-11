"use client";

import { useEffect, useState } from "react";
import { SteelSlide } from "@/components/SteelSlide";
import type { SteelData } from "@/components/SteelSlide";

export default function SteelPage() {
  const [data, setData] = useState<SteelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/steel")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error || "Failed to load data");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return <SteelSlide data={data} loading={loading} error={error} />;
}
