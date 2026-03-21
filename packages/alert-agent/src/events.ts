import { EventEmitter } from "node:events";
import type { AgentEvent } from "@rangerai/shared";

export const ALERT_DISPATCHED = "alert:dispatched" as const;

type AlertAgentEventMap = {
  [K in AgentEvent["type"]]: [Extract<AgentEvent, { type: K }>];
};

class AlertEventEmitter extends EventEmitter<AlertAgentEventMap> {}

export const alertEvents = new AlertEventEmitter();
