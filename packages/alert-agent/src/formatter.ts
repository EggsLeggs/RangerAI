import { Alert, AlertDispatchMethod, ScoredSighting, ThreatLevel } from "@rangerwatch/shared";

function formatCoord(n: number): string {
  return n.toFixed(4);
}

function actionFor(threatLevel: ThreatLevel): string {
  switch (threatLevel) {
    case ThreatLevel.CRITICAL:
      return "Dispatch ranger unit immediately";
    case ThreatLevel.WARNING:
      return "Schedule inspection within 24 hours";
    case ThreatLevel.INFO:
      return "Log for population records";
    case ThreatLevel.NEEDS_REVIEW:
      return "Flag for manual species verification";
  }
}

function dispatchMethodFor(threatLevel: ThreatLevel): AlertDispatchMethod {
  return threatLevel === ThreatLevel.CRITICAL ? "both" : "webhook";
}

function buildSmsMessage(sighting: ScoredSighting): string {
  return (
    `CRITICAL: ${sighting.species} sighted out of range at ` +
    `${formatCoord(sighting.lat)},${formatCoord(sighting.lng)}. ` +
    `IUCN: ${sighting.iucnStatus} score:${sighting.anomalyScore}. ` +
    `Immediate review required.`
  );
}

function buildWebhookMessage(sighting: ScoredSighting): string {
  return (
    `RANGERWATCH ALERT [${sighting.threatLevel}]\n` +
    `Species: ${sighting.species} (${sighting.iucnStatus})\n` +
    `Location: ${formatCoord(sighting.lat)}, ${formatCoord(sighting.lng)}\n` +
    `Observed: ${sighting.observedAt.toISOString()}\n` +
    `Anomaly score: ${sighting.anomalyScore}/100\n` +
    `In range: ${sighting.inRange}\n` +
    `Confidence: ${sighting.confidence}\n` +
    `Invasive: ${sighting.invasive}\n` +
    `Recommended action: ${actionFor(sighting.threatLevel)}`
  );
}

export function formatAlert(sighting: ScoredSighting): Alert {
  const formattedMessage =
    sighting.threatLevel === ThreatLevel.CRITICAL
      ? buildSmsMessage(sighting)
      : buildWebhookMessage(sighting);

  return {
    ...sighting,
    alertId: crypto.randomUUID(),
    formattedMessage,
    dispatchedAt: new Date(),
    dispatchMethod: dispatchMethodFor(sighting.threatLevel),
  };
}
