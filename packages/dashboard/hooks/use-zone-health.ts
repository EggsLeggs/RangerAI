import { useState, useEffect, useRef } from "react";

export interface ZoneData {
  id: string;
  name: string;
  coverage: number;
  atRisk: boolean;
  color: string;
}

interface ZonesResponse {
  zones: ZoneData[];
  totalAnimals: number;
  unavailable?: boolean;
}

interface UseZoneHealthResult {
  zones: ZoneData[];
  totalAnimals: number;
  loading: boolean;
}

export function useZoneHealth({ alertCount }: { alertCount?: number } = {}): UseZoneHealthResult {
  const [data, setData] = useState<ZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    const doFetch = async () => {
      try {
        const res = await fetch("/api/zones", { signal: controller.signal });
        if (!res.ok) throw new Error("zones fetch failed");
        const json = (await res.json()) as ZonesResponse;
        setData(json);
        hasLoaded.current = true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setData({ zones: [], totalAnimals: 0 });
      } finally {
        setLoading(false);
      }
    };

    if (!hasLoaded.current) setLoading(true);
    doFetch();

    return () => {
      controller.abort();
    };
  }, [alertCount]);

  return {
    zones: data?.zones ?? [],
    totalAnimals: data?.totalAnimals ?? 0,
    loading,
  };
}
