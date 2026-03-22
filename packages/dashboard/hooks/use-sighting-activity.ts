import { useState, useEffect } from "react";

export interface ActivityPoint {
  day: string;
  sightings: number;
  incidents: number;
  resolved: number;
}

interface ActivityResponse {
  series: ActivityPoint[];
  unavailable?: boolean;
}

interface UseActivityParams {
  days: number;
  zone: string;
}

interface UseActivityResult {
  series: ActivityPoint[];
  loading: boolean;
}

export function useSightingActivity({ days, zone }: UseActivityParams): UseActivityResult {
  const [series, setSeries] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const doFetch = async () => {
      try {
        const params = new URLSearchParams({ days: String(days), zone });
        const res = await fetch(`/api/chart/activity?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("activity fetch failed");
        const json = (await res.json()) as ActivityResponse;
        setSeries(json.series);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSeries([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    doFetch();

    return () => {
      controller.abort();
    };
  }, [days, zone]);

  return { series, loading };
}
