import type { BoundingBox, ClassifiedSighting } from "@rangerai/shared";
import { getRangeBounds } from "./clients/iucn.js";

/**
 * Returns true if the sighting's coordinates fall within the bounding box.
 * Pure function - no side effects, no API calls.
 */
export function isInRange(sighting: ClassifiedSighting, bounds: BoundingBox): boolean {
  const inLat = sighting.lat >= bounds.swLat && sighting.lat <= bounds.neLat;
  const inLng =
    bounds.swLng <= bounds.neLng
      ? sighting.lng >= bounds.swLng && sighting.lng <= bounds.neLng
      : sighting.lng >= bounds.swLng || sighting.lng <= bounds.neLng;
  return inLat && inLng;
}

/**
 * Fetches range bounds for the sighting's species and checks containment.
 * Returns { inRange: true, bounds: null } when range data is unavailable - errors on the side of not raising false alarms.
 */
export async function validateRange(
  sighting: ClassifiedSighting
): Promise<{ inRange: boolean; bounds: BoundingBox | null }> {
  const bounds = await getRangeBounds(sighting.species);
  if (bounds === null) {
    return { inRange: true, bounds: null };
  }
  return { inRange: isInRange(sighting, bounds), bounds };
}
