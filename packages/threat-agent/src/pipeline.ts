import type { ClassifiedSighting, ScoredSighting } from "@rangerai/shared";
import { lookupSpecies } from "./clients/iucn.js";
import { validateRange } from "./range.js";
import {
  scoreSighting,
  hasSeen,
  markSeen,
  getZoneSightingCount,
  incrementZoneSightings,
  HUMAN_CLUSTER_THRESHOLD,
} from "./scoring.js";
import { classifyThreat } from "./classifier.js";

export async function processSighting(
  classified: ClassifiedSighting,
): Promise<ScoredSighting> {
  const iucnResult = await lookupSpecies(classified.species);
  const iucnStatus = iucnResult?.category ?? "NE";

  const { inRange } = await validateRange(classified);

  const previouslySeen = hasSeen(classified.species, classified.lat, classified.lng);
  markSeen(classified.species, classified.lat, classified.lng);

  const humanClusterNearby = getZoneSightingCount(classified.lat, classified.lng) > HUMAN_CLUSTER_THRESHOLD;
  incrementZoneSightings(classified.lat, classified.lng);

  const anomalyScore = scoreSighting(classified, {
    inRange,
    iucnStatus,
    previouslySeen,
    humanClusterNearby,
  });
  const threatLevel = classifyThreat(anomalyScore, iucnStatus, inRange, classified.invasive);

  console.log(
    `[threat-agent] species=${classified.species} score=${anomalyScore} threatLevel=${threatLevel} inRange=${inRange} iucnStatus=${iucnStatus}`,
  );

  return { ...classified, anomalyScore, threatLevel, iucnStatus, inRange };
}
