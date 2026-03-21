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
  const locationVerb = sighting.inRange ? "detected at" : "sighted out of range at";
  return (
    `CRITICAL: ${sighting.species} ${locationVerb} ` +
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
  const dispatchMethod = dispatchMethodFor(sighting.threatLevel);
  const base = {
    ...sighting,
    alertId: crypto.randomUUID(),
    dispatchedAt: new Date(),
  };

  if (dispatchMethod === "both") {
    return {
      ...base,
      dispatchMethod: "both",
      formattedMessage: {
        sms: buildSmsMessage(sighting),
        webhook: buildWebhookMessage(sighting),
      },
    };
  }

  return {
    ...base,
    dispatchMethod: "webhook",
    formattedMessage: buildWebhookMessage(sighting),
  };
}
