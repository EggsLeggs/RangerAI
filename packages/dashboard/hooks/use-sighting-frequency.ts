import { useState, useEffect } from "react";

export interface FrequencyPoint {
  day: string;
  [species: string]: number | string;
}

interface FrequencyResponse {
  series: FrequencyPoint[];
  species: string[];
  unavailable?: boolean;
}

interface UseFrequencyParams {
  tab: string;
}

interface UseFrequencyResult {
  series: FrequencyPoint[];
  species: string[];
  loading: boolean;
  error: boolean;
}

export function useSightingFrequency({ tab }: UseFrequencyParams): UseFrequencyResult {
  const [data, setData] = useState<FrequencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const doFetch = async () => {
      try {
        const params = new URLSearchParams({ tab });
        const res = await fetch(`/api/chart/frequency?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("frequency fetch failed");
        const json = (await res.json()) as FrequencyResponse;
        setData(json);
        setError(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(true);
        // preserve previous series/species on failure
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    doFetch();

    return () => {
      controller.abort();
    };
  }, [tab]);

  return {
    series: data?.series ?? [],
    species: data?.species ?? [],
    loading,
    error,
  };
}
