import type { MapSighting } from "../components/live-map";
import type { RecentSightingRow, StoredSighting } from "../components/dashboard/types";
import { SIGHTINGS_KEY } from "./constants";

export function formatRelativeTime(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

export function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return `ZN-${String(n).padStart(2, "0")}`;
}

export function threatToMapLevel(t: string): MapSighting["level"] {
  if (t === "CRITICAL" || t === "WARNING" || t === "INFO") return t;
  return "INFO";
}

export function mapSightingBaseId(s: Pick<MapSighting, "id" | "lat" | "lng">): string {
  const id = s.id;
  if (id?.startsWith("live-")) return id.slice(5);
  if (id) return id;
  return `${s.lat},${s.lng}`;
}

export function trimSightingsPreferLive(sortedDesc: MapSighting[], cap: number): MapSighting[] {
  if (sortedDesc.length <= cap) return sortedDesc;
  const out = [...sortedDesc];
  while (out.length > cap) {
    let dropIdx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (!out[i]?.id?.startsWith("live-")) {
        dropIdx = i;
        break;
      }
    }
    if (dropIdx === -1) out.pop();
    else out.splice(dropIdx, 1);
  }
  return out;
}

export function mergeHistoryAndLiveSightings(
  fetched: MapSighting[],
  prev: MapSighting[]
): MapSighting[] {
  const liveEntries = prev.filter((s) => s.id?.startsWith("live-") || !s.id);
  const byBase = new Map<string, MapSighting>();

  const consider = (s: MapSighting) => {
    const base = mapSightingBaseId(s);
    const cur = byBase.get(base);
    const sLive = Boolean(s.id?.startsWith("live-"));
    const curLive = Boolean(cur?.id?.startsWith("live-"));
    if (!cur) {
      byBase.set(base, s);
      return;
    }
    if (sLive && !curLive) {
      byBase.set(base, s);
      return;
    }
    if (sLive === curLive) {
      const ta = s.timestamp?.getTime() ?? 0;
      const tb = cur.timestamp?.getTime() ?? 0;
      if (ta >= tb) byBase.set(base, s);
    }
  };

  for (const s of fetched) consider(s);
  for (const s of liveEntries) consider(s);

  const merged = [...byBase.values()].sort(
    (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
  );
  return trimSightingsPreferLive(merged, 500);
}

export function loadPersistedSightings(): RecentSightingRow[] {
  try {
    const raw = localStorage.getItem(SIGHTINGS_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as StoredSighting[];
    return stored.map((s) => {
      const receivedAt = new Date(s.receivedAt);
      return { ...s, receivedAt, time: formatRelativeTime(receivedAt) };
    });
  } catch {
    return [];
  }
}

export function persistSightings(sightings: RecentSightingRow[]): void {
  try {
    const live = sightings.filter((s) => s.receivedAt);
    if (!live.length) return;
    const payload: StoredSighting[] = live
      .slice(0, 50)
      .map((s) => ({ ...s, receivedAt: s.receivedAt!.toISOString() }));
    localStorage.setItem(SIGHTINGS_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

// TODO: getPointsForFrequency and buildFrequencySeries are mock/demo implementations.
// Replace with real historical frequency data from the API when available.

export function getPointsForFrequency(tab: string): number {
  switch (tab) {
    case "7 Days":
      return 7 * 24;
    case "30 Days":
      return 30 * 24;
    case "90 Days":
      return 90 * 24;
    default:
      return 7 * 24;
  }
}

export function buildFrequencySeries(totalHours: number) {
  return Array.from({ length: totalHours }, (_, i) => ({
    hour: i,
    elephant: Math.sin(i / 6) * 20 + 30,
    lion: Math.cos(i / 8) * 15 + 25,
    rhino: Math.sin(i / 10 + 2) * 12 + 18,
  }));
}
