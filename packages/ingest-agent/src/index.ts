import type { BoundingBox } from "@rangerwatch/shared";
import { startPolling, stopPolling } from "./poller.js";

export { ingestEvents } from "./events.js";

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
