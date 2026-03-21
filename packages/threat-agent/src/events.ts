import { EventEmitter } from "node:events";
import type { AgentEvent } from "@rangerai/shared";

export const AGENT_SCORED_SIGHTINGS = "agent:scored-sightings" as const;

type AgentEventMap = {
  [K in AgentEvent["type"]]: [Extract<AgentEvent, { type: K }>];
};

class ThreatEventEmitter extends EventEmitter<AgentEventMap> {}

export const threatEvents = new ThreatEventEmitter();
