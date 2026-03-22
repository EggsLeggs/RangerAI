import { useState, useEffect, useRef } from "react";
import type { MapSighting } from "../components/live-map";
import type { AgentPipelineEntry, RecentSightingRow } from "../components/dashboard/types";
import { INITIAL_RECENT_SIGHTINGS, ALERTS_TODAY_KEY } from "../lib/constants";
import {
  formatRelativeTime,
  zoneIdFromCoords,
  threatToMapLevel,
  mapSightingBaseId,
  trimSightingsPreferLive,
  loadPersistedSightings,
  persistSightings,
} from "../lib/sighting-helpers";

export function useAlertStream(
  setAgentPipeline: React.Dispatch<React.SetStateAction<AgentPipelineEntry[]>>
) {
  const [streamLive, setStreamLive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [recentSightings, setRecentSightings] = useState(INITIAL_RECENT_SIGHTINGS);
  const [sightingsPage, setSightingsPage] = useState(0);
  const [mapSightings, setMapSightings] = useState<MapSighting[]>([]);
  const [alertsToday, setAlertsToday] = useState(0);
  const todayAlertIdsRef = useRef<Set<string>>(new Set());

  // restore recent sightings from localStorage on mount - only if sufficiently recent
  useEffect(() => {
    const MAX_PERSISTED_AGE_MS = 24 * 60 * 60_000; // 24 hours
    const now = Date.now();
    const persisted = loadPersistedSightings().filter(
      (s) => s.receivedAt && now - s.receivedAt.getTime() < MAX_PERSISTED_AGE_MS
    );
    if (persisted.length > 0) setRecentSightings(persisted);
  }, []);

  // persist live sightings whenever the list changes
  useEffect(() => {
    persistSightings(recentSightings);
  }, [recentSightings]);

  // restore today's alert count from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALERTS_TODAY_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { date: string; ids: string[] };
      if (stored.date !== new Date().toDateString()) {
        localStorage.removeItem(ALERTS_TODAY_KEY);
        return;
      }
      const ids = new Set(stored.ids);
      todayAlertIdsRef.current = ids;
      setAlertsToday(ids.size);
    } catch { /* ignore */ }
  }, []);

  // SSE connection to /api/alerts
  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const applyAlertPayload = (a: Record<string, unknown>) => {
      const lat = typeof a.lat === "number" ? a.lat : NaN;
      const lng = typeof a.lng === "number" ? a.lng : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const species = typeof a.species === "string" ? a.species : "Unknown";
      const threatLevel = typeof a.threatLevel === "string" ? a.threatLevel : "INFO";
      const rowId =
        typeof a.alertId === "string" && a.alertId.length > 0
          ? a.alertId
          : crypto.randomUUID();

      const now = new Date();
      setStreamLive(true);
      setStreamError(null);
      setSightingsPage(0);
      setRecentSightings((prev) => {
        const real = prev.filter((s) => !s.id.startsWith("init-"));
        if (real.some((s) => s.id === rowId)) return real.length !== prev.length ? real : prev;
        return [
          {
            id: rowId,
            alertId: rowId,
            zone: zoneIdFromCoords(lat, lng),
            species,
            threat: threatLevel,
            time: formatRelativeTime(now),
            receivedAt: now,
          },
          ...real,
        ].slice(0, 50);
      });

      if (!todayAlertIdsRef.current.has(rowId)) {
        todayAlertIdsRef.current.add(rowId);
        setAlertsToday(todayAlertIdsRef.current.size);
        try {
          localStorage.setItem(ALERTS_TODAY_KEY, JSON.stringify({
            date: now.toDateString(),
            ids: [...todayAlertIdsRef.current],
          }));
        } catch { /* ignore */ }
      }

      setMapSightings((prev) => {
        const withoutSameBase = prev.filter((s) => mapSightingBaseId(s) !== rowId);
        const next: MapSighting = {
          id: `live-${rowId}`,
          alertId: rowId,
          lat,
          lng,
          level: threatToMapLevel(threatLevel),
          label: species,
          timestamp: now,
        };
        const merged = [next, ...withoutSameBase].sort(
          (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
        );
        return trimSightingsPreferLive(merged, 500);
      });

      setAgentPipeline((prev) =>
        prev.map((p) =>
          p.name === "Alert Agent" ? { ...p, status: "Dispatching", color: "#4a7c5a" } : p
        )
      );
    };

    const onMessage = (ev: MessageEvent) => {
      let msg: { type?: string; alert?: Record<string, unknown> };
      try {
        msg = JSON.parse(ev.data) as { type?: string; alert?: Record<string, unknown> };
      } catch {
        return;
      }

      if (msg.type === "connected" || msg.type === "heartbeat") {
        attempt = 0;
        setStreamLive(true);
        setStreamError(null);
        return;
      }

      if (msg.type !== "alert" || !msg.alert) return;
      attempt = 0;
      applyAlertPayload(msg.alert);
    };

    const connect = () => {
      if (closed) return;
      es?.close();
      es = new EventSource("/api/alerts");
      es.onmessage = onMessage;
      es.onerror = () => {
        console.warn("[ranger-dashboard] alert EventSource error; will reconnect");
        setStreamLive(false);
        setStreamError("Alert stream disconnected. Reconnecting…");
        es?.close();
        es = null;
        if (closed) return;
        attempt += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [setAgentPipeline]);

  // hydrate recentSightings from Atlas history on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/alerts/history");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { alerts?: Record<string, unknown>[] };
        const today = new Date().toDateString();
        const rows: RecentSightingRow[] = [];
        if (data.alerts?.length) {
          for (const a of data.alerts) {
            if (typeof a.alertId !== "string" || typeof a.species !== "string") continue;
            if (typeof a.lat !== "number" || typeof a.lng !== "number") continue;
            const rawDate = a.dispatchedAt ?? a.receivedAt;
            const receivedAt = rawDate ? new Date(rawDate as string) : null;
            if (!receivedAt || isNaN(receivedAt.getTime()) || receivedAt.toDateString() !== today) continue;
            rows.push({
              id: a.alertId,
              alertId: a.alertId,
              zone: zoneIdFromCoords(a.lat, a.lng),
              species: a.species,
              threat: typeof a.threatLevel === "string" ? a.threatLevel : "INFO",
              time: formatRelativeTime(receivedAt),
              receivedAt,
            });
          }
        }
        if (cancelled) return;
        if (rows.length) {
          let counterChanged = false;
          for (const r of rows) {
            if (!todayAlertIdsRef.current.has(r.id)) {
              todayAlertIdsRef.current.add(r.id);
              counterChanged = true;
            }
          }
          if (counterChanged) {
            setAlertsToday(todayAlertIdsRef.current.size);
            try {
              localStorage.setItem(ALERTS_TODAY_KEY, JSON.stringify({
                date: new Date().toDateString(),
                ids: [...todayAlertIdsRef.current],
              }));
            } catch { /* ignore */ }
          }
          setRecentSightings((prev) => {
            const real = prev.filter((s) => !s.id.startsWith("init-"));
            const existingIds = new Set(real.map((s) => s.id));
            const fresh = rows.filter((r) => !existingIds.has(r.id));
            if (!fresh.length) return real.length !== prev.length ? real : prev;
            return [...fresh, ...real].slice(0, 50);
          });
        }
      } catch { /* ignore - history is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    streamLive,
    streamError,
    recentSightings,
    sightingsPage,
    setSightingsPage,
    alertsToday,
    mapSightings,
    setMapSightings,
  };
}
