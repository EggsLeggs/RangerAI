import type { ClassifiedSighting } from "@rangerwatch/shared";

export const WEIGHT_OUT_OF_RANGE = 40;
export const WEIGHT_NOCTURNAL = 20;
export const WEIGHT_ENDANGERED_SPECIES = 25;
export const WEIGHT_INVASIVE_FIRST_APPEARANCE = 15;
export const WEIGHT_HUMAN_CLUSTERING = 15;

const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const seenSpeciesCache = new Map<string, number>(); // key -> insertion timestamp

function evictStale(): void {
  const now = Date.now();
  for (const [key, ts] of seenSpeciesCache) {
    if (now - ts > CACHE_TTL_MS) seenSpeciesCache.delete(key);
  }
  if (seenSpeciesCache.size > CACHE_MAX_SIZE) {
    const overflow = seenSpeciesCache.size - CACHE_MAX_SIZE;
    let i = 0;
    for (const key of seenSpeciesCache.keys()) {
      if (i++ >= overflow) break;
      seenSpeciesCache.delete(key);
    }
  }
}

export function zoneKey(species: string, lat: number, lng: number): string {
  return `${species}:${Math.round(lat * 10) / 10}:${Math.round(lng * 10) / 10}`;
}

export function hasSeen(species: string, lat: number, lng: number): boolean {
  const key = zoneKey(species, lat, lng);
  const ts = seenSpeciesCache.get(key);
  if (ts === undefined) return false;
  if (Date.now() - ts > CACHE_TTL_MS) {
    seenSpeciesCache.delete(key);
    return false;
  }
  return true;
}

export function markSeen(species: string, lat: number, lng: number): void {
  seenSpeciesCache.set(zoneKey(species, lat, lng), Date.now());
  evictStale();
}

export function isNocturnal(observedAt: Date, lng: number): boolean {
  try {
    const utcHour = observedAt.getUTCHours();
    const offsetHours = Math.round(lng / 15);
    const localHour = ((utcHour + offsetHours) % 24 + 24) % 24;
    return localHour >= 19 || localHour < 6;
  } catch {
    return false;
  }
}

export function scoreSighting(
  sighting: ClassifiedSighting,
  context: { inRange: boolean; iucnStatus: string | null; previouslySeen: boolean; humanClusterNearby: boolean }
): number {
  let score = 0;
  if (!context.inRange) score += WEIGHT_OUT_OF_RANGE;
  if (isNocturnal(sighting.observedAt, sighting.lng)) score += WEIGHT_NOCTURNAL;
  if (context.iucnStatus === "EN" || context.iucnStatus === "CR") {
    score += WEIGHT_ENDANGERED_SPECIES;
    if (context.humanClusterNearby) score += WEIGHT_HUMAN_CLUSTERING;
  }
  if (sighting.invasive && !context.previouslySeen) score += WEIGHT_INVASIVE_FIRST_APPEARANCE;
  return Math.min(100, Math.max(0, score));
}
