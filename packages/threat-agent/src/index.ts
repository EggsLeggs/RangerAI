import type { ScoredSighting } from "@rangerai/shared";
import { threatEvents } from "./events.js";
import { processSighting } from "./pipeline.js";
import { guardedFetch } from "./guardrail.js";

export { threatEvents };
export { processSighting };
export { guardedFetch };

threatEvents.on("agent:classified-sightings", async (event) => {
  const scored: ScoredSighting[] = [];
  for (const s of event.payload.sightings) {
    try {
      scored.push(await processSighting(s));
    } catch (err) {
      console.error(
        `[threat-agent] failed to process sighting id=${s.id} species=${s.species}:`,
        err,
      );
    }
  }
  if (scored.length > 0) {
    threatEvents.emit("agent:scored-sightings", {
      type: "agent:scored-sightings",
      payload: { sightings: scored },
      timestamp: new Date(),
    });
  }
});
