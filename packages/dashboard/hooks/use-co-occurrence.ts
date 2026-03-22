import { useState, useEffect, useRef, useCallback } from "react";

export interface CoOccurrencePair {
  species1: string;
  species2: string;
  count: number;
  zones: string[];
}

export interface CoOccurrenceNode {
  species: string;
  totalSightings: number;
  iucnStatus: string | null;
}

interface CoOccurrenceResponse {
  pairs: CoOccurrencePair[];
  nodes: CoOccurrenceNode[];
}

interface UseCoOccurrenceParams {
  hours?: number;
}

interface UseCoOccurrenceResult {
  pairs: CoOccurrencePair[];
  nodes: CoOccurrenceNode[];
  loading: boolean;
  error: boolean;
}

export function useCoOccurrence({ hours = 24 }: UseCoOccurrenceParams = {}): UseCoOccurrenceResult {
  const [data, setData] = useState<CoOccurrenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async (h: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setLoading(true);
      const params = new URLSearchParams({ hours: String(h) });
      const res = await fetch(`/api/wildlife/co-occurrence?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("co-occurrence fetch failed");
      const json = (await res.json()) as CoOccurrenceResponse;
      setData(json);
      setError(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch(hours);
    return () => controllerRef.current?.abort();
  }, [hours, doFetch]);

  // re-fetch when new alerts arrive via SSE
  useEffect(() => {
    const es = new EventSource("/api/alerts");
    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string };
        if (msg.type === "alert") doFetch(hours);
      } catch { /* ignore parse errors */ }
    };
    es.addEventListener("message", onMessage);
    return () => { es.close(); };
  }, [hours, doFetch]);

  return {
    pairs: data?.pairs ?? [],
    nodes: data?.nodes ?? [],
    loading,
    error,
  };
}
