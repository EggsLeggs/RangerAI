import { ThreatLevel } from "@rangerai/shared";

export function classifyThreat(
  score: number,
  iucnStatus: string | null,
  inRange: boolean,
  invasive = false,
): ThreatLevel {
  if (
    score >= 80 ||
    ((iucnStatus === "CR" || iucnStatus === "EN") && !inRange)
  ) {
    return ThreatLevel.CRITICAL;
  }
  if (score >= 50 || invasive) {
    return ThreatLevel.WARNING;
  }
  return ThreatLevel.INFO;
}
