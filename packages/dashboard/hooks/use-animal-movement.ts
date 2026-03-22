import { useState, useEffect } from "react";

export interface MovementSighting {
  lat: number;
  lng: number;
  timestamp: string | null;
  zone: string;
  threatLevel: string;
  inRange: boolean;
  alertId: string | null;
  confidence: number | null;
  anomalyScore: number | null;
}

interface MovementResponse {
  sightings: MovementSighting[];
}

interface UseAnimalMovementParams {
  species: string | null;
}

interface UseAnimalMovementResult {
  sightings: MovementSighting[];
  loading: boolean;
  error: boolean;
}

export function useAnimalMovement({ species }: UseAnimalMovementParams): UseAnimalMovementResult {
  const [data, setData] = useState<MovementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!species) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    setData(null);

    const doFetch = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ species: encodeURIComponent(species) });
        const res = await fetch(`/api/wildlife/movement?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("movement fetch failed");
        const json = (await res.json()) as MovementResponse;
        setData(json);
        setError(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setData(null);
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    doFetch();

    return () => controller.abort();
  }, [species]);

  return {
    sightings: data?.sightings ?? [],
    loading,
    error,
  };
}
