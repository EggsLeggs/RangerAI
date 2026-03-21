import type { BoundingBox } from "@rangerai/shared";
import { startPolling, stopPolling, pollOnce } from "./poller.js";

export { ingestEvents, AGENT_NEW_SIGHTINGS } from "./events.js";

const AMBOSELI: BoundingBox = {
  neLat: -2.4,
  neLng: 37.5,
  swLat: -3.0,
  swLng: 36.8,
};

export function startIngestAgent(): void {
  console.log("[ingest-agent] ingest agent started");
  startPolling(AMBOSELI);
}

export function stopIngestAgent(): void {
  stopPolling();
}

export function triggerPoll(): Promise<void> {
  return pollOnce(AMBOSELI);
}
