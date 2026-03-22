import { useState, useEffect, useRef, useMemo } from "react";
import type { MapSighting, MapBounds } from "../components/live-map";
import {
  threatToMapLevel,
  mergeHistoryAndLiveSightings,
} from "../lib/sighting-helpers";

const TIME_RANGE_MS: Record<string, number> = {
  "1h": 1 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "all": Infinity,
};

export function useMapSightings(
  mapSightings: MapSighting[],
  setMapSightings: React.Dispatch<React.SetStateAction<MapSighting[]>>
) {
  const [mapHistoryLoaded, setMapHistoryLoaded] = useState(false);
  const [mapHistoryError, setMapHistoryError] = useState<string | null>(null);
  const [mapFitKey, setMapFitKey] = useState(0);
  const [mapSeverityFilter, setMapSeverityFilter] = useState<Set<string>>(
    new Set(["CRITICAL", "WARNING", "INFO"])
  );
  const [mapTimeRange, setMapTimeRange] = useState<"1h" | "6h" | "24h" | "7d" | "all">("all");
  const [mapBoundsActive, setMapBoundsActive] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const mapFilterMountedRef = useRef(false);
  const mapHistoryRequestIdRef = useRef(0);

  const filteredMapSightings = useMemo(() => {
    const now = Date.now();
    const cutoff = mapTimeRange === "all" ? 0 : now - TIME_RANGE_MS[mapTimeRange];

    return mapSightings.filter((s) => {
      if (!mapSeverityFilter.has(s.level)) return false;
      const ts = s.timestamp ? s.timestamp.getTime() : now;
      if (ts < cutoff) return false;
      if (mapBoundsActive && mapBounds) {
        if (
          s.lat < mapBounds.south ||
          s.lat > mapBounds.north ||
          s.lng < mapBounds.west ||
          s.lng > mapBounds.east
        ) return false;
      }
      return true;
    });
  }, [mapSightings, mapSeverityFilter, mapTimeRange, mapBoundsActive, mapBounds]);

  // re-fit map when filters change (skip initial mount)
  useEffect(() => {
    if (!mapFilterMountedRef.current) { mapFilterMountedRef.current = true; return; }
    setMapFitKey((k) => k + 1);
  }, [mapSeverityFilter, mapTimeRange]);

  // hydrate map sightings from history when time range filter changes
  useEffect(() => {
    const currentId = ++mapHistoryRequestIdRef.current;
    let cancelled = false;
    setMapHistoryLoaded(false);
    setMapHistoryError(null);

    (async () => {
      try {
        const params = new URLSearchParams();
        if (mapTimeRange !== "all") {
          params.set("from", new Date(Date.now() - TIME_RANGE_MS[mapTimeRange]).toISOString());
        }
        const res = await fetch(`/api/alerts/history?${params.toString()}`);
        if (cancelled || currentId !== mapHistoryRequestIdRef.current) return;

        if (!res.ok) {
          if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
            setMapHistoryError(`Failed to load sightings (${res.status})`);
          }
          return;
        }

        let data: { alerts?: Record<string, unknown>[] };
        try {
          data = (await res.json()) as { alerts?: Record<string, unknown>[] };
        } catch (e) {
          if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
            setMapHistoryError(e instanceof Error ? e.message : "Invalid response");
          }
          return;
        }

        if (cancelled || currentId !== mapHistoryRequestIdRef.current) return;

        const fetched: MapSighting[] = [];
        for (const a of data.alerts ?? []) {
          if (typeof a.alertId !== "string") continue;
          if (typeof a.lat !== "number" || typeof a.lng !== "number") continue;
          const rawDate = a.dispatchedAt ?? a.receivedAt;
          const ts = rawDate ? new Date(rawDate as string) : null;
          const validTs =
            ts && !Number.isNaN(ts.getTime()) ? ts : undefined;
          fetched.push({
            id: a.alertId,
            lat: a.lat,
            lng: a.lng,
            level: threatToMapLevel(typeof a.threatLevel === "string" ? a.threatLevel : "INFO"),
            label: typeof a.species === "string" ? a.species : undefined,
            timestamp: validTs,
          });
        }

        setMapSightings((prev) => mergeHistoryAndLiveSightings(fetched, prev));

        if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
          setMapHistoryError(null);
          setMapHistoryLoaded(true);
          setMapFitKey((k) => k + 1);
        }
      } catch (e) {
        if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
          setMapHistoryError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      mapHistoryRequestIdRef.current += 1;
    };
  }, [mapTimeRange, setMapSightings]);

  return {
    mapHistoryLoaded,
    mapHistoryError,
    mapFitKey,
    setMapFitKey,
    mapSeverityFilter,
    setMapSeverityFilter,
    mapTimeRange,
    setMapTimeRange,
    mapBoundsActive,
    setMapBoundsActive,
    mapBounds,
    setMapBounds,
    filteredMapSightings,
  };
}
