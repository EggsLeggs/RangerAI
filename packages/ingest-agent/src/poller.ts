import cron, { type ScheduledTask } from "node-cron";
import type { BoundingBox } from "@rangerwatch/shared";
import { fetchObservations } from "./clients/inaturalist.js";
import { fetchOccurrences } from "./clients/gbif.js";
import { defaultQueue } from "./queue.js";
import { ingestEvents, AGENT_NEW_SIGHTINGS } from "./events.js";

const DEFAULT_INTERVAL = "*/5 * * * *";

let task: ScheduledTask | null = null;
let isRunning = false;

export function startPolling(boundingBox: BoundingBox): void {
  if (task !== null) {
    return;
  }

  const interval = process.env.POLL_INTERVAL ?? DEFAULT_INTERVAL;

  task = cron.schedule(interval, async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      const tickAt = new Date();
      console.log(`[ingest-agent] tick ${tickAt.toISOString()}`);

      const [inatResult, gbifResult] = await Promise.allSettled([
        fetchObservations(boundingBox),
        fetchOccurrences(boundingBox),
      ]);

      const inatSightings =
        inatResult.status === "fulfilled"
          ? inatResult.value
          : (console.error("[ingest-agent] iNaturalist fetch failed:", inatResult.reason), []);

      const gbifSightings =
        gbifResult.status === "fulfilled"
          ? gbifResult.value
          : (console.error("[ingest-agent] GBIF fetch failed:", gbifResult.reason), []);

      const all = [...inatSightings, ...gbifSightings];
      const newSightings = all.filter((s) => defaultQueue.enqueue(s));

      console.log(
        `[ingest-agent] fetched=${all.length} new=${newSightings.length} queueSize=${defaultQueue.size}`
      );

      if (newSightings.length > 0) {
        ingestEvents.emit(AGENT_NEW_SIGHTINGS, {
          type: AGENT_NEW_SIGHTINGS,
          payload: { sightings: newSightings },
          timestamp: tickAt,
        });
      }
    } catch (err) {
      console.error("[ingest-agent] poll tick failed:", err);
    } finally {
      isRunning = false;
    }
  });
}

export function stopPolling(): void {
  task?.stop();
  task = null;
}
