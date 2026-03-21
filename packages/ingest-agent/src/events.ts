import { EventEmitter } from "node:events";
import type { AgentEvent } from "@rangerwatch/shared";

export const AGENT_NEW_SIGHTINGS = "agent:new-sightings" as const;

type AgentEventMap = {
  [K in AgentEvent["type"]]: [Extract<AgentEvent, { type: K }>];
};

class IngestEventEmitter extends EventEmitter<AgentEventMap> {}

export const ingestEvents = new IngestEventEmitter();
