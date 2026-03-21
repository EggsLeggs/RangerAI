import type { ClassifiedSighting } from "@rangerai/shared";

export const CONFIDENCE_THRESHOLD = 0.6;

export function applyThreshold(classified: ClassifiedSighting): ClassifiedSighting {
  const isUnknown = !classified.species || classified.species === "unknown";
  const belowThreshold = classified.confidence < CONFIDENCE_THRESHOLD;
  // OR with incoming value - never clear a pre-existing true (e.g. Civic block or null taxon)
  const needsReview = classified.needsReview || isUnknown || belowThreshold;
  return { ...classified, needsReview };
}
