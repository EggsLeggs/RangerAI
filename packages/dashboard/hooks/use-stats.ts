import { useState, useEffect, useRef } from "react";

interface StatsResponse {
  activeZones: number;
  speciesTracked: number;
  alertsToday: number;
  unavailable?: boolean;
}

interface UseStatsResult {
  activeZones: number;
  speciesTracked: number;
  alertsToday: number;
  loading: boolean;
  error: boolean;
}

export function useStats({ alertCount }: { alertCount?: number } = {}): UseStatsResult {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    const doFetch = async () => {
      try {
        const res = await fetch("/api/stats", { signal: controller.signal });
        if (!res.ok) throw new Error("stats fetch failed");
        const json = (await res.json()) as StatsResponse;
        setData(json);
        setError(false);
        hasLoaded.current = true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(true);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (!hasLoaded.current) setLoading(true);
    doFetch();

    const interval = setInterval(doFetch, 60_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [alertCount]);

  return {
    activeZones: data?.activeZones ?? 0,
    speciesTracked: data?.speciesTracked ?? 0,
    alertsToday: data?.alertsToday ?? 0,
    loading,
    error,
  };
}
