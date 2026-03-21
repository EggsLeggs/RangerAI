/** Geographic bounds (north-east and south-west corners), degrees WGS84. */
export interface BoundingBox {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
}

export type SightingSource = "inaturalist" | "gbif";

export interface Sighting {
  id: string;
  source: SightingSource;
  imageUrl: string;
  lat: number;
  lng: number;
  observedAt: Date;
  observerNotes?: string;
}

export interface ClassifiedSighting extends Sighting {
  species: string;
  confidence: number;
  invasive: boolean;
  taxonId: string | null;
  needsReview: boolean;
}

export enum ThreatLevel {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  INFO = "INFO",
  NEEDS_REVIEW = "NEEDS_REVIEW",
}

export interface ScoredSighting extends ClassifiedSighting {
  anomalyScore: number;
  threatLevel: ThreatLevel;
  iucnStatus: string;
  inRange: boolean;
}

/** Shared fields on every dispatched alert. */
export type AlertBase = ScoredSighting & {
  alertId: string;
  dispatchedAt: Date;
};

export interface AlertSms extends AlertBase {
  dispatchMethod: "sms";
  formattedMessage: string;
}

export interface AlertWebhook extends AlertBase {
  dispatchMethod: "webhook";
  formattedMessage: string;
}

export interface AlertBoth extends AlertBase {
  dispatchMethod: "both";
  formattedMessage: { sms: string; webhook: string };
}

export type Alert = AlertSms | AlertWebhook | AlertBoth;

export type AlertDispatchMethod = Alert["dispatchMethod"];

export function isAlertSms(alert: Alert): alert is AlertSms {
  return alert.dispatchMethod === "sms";
}

export function isAlertWebhook(alert: Alert): alert is AlertWebhook {
  return alert.dispatchMethod === "webhook";
}

export function isAlertBoth(alert: Alert): alert is AlertBoth {
  return alert.dispatchMethod === "both";
}

export interface GuardrailResult {
  input: string;
  output: string;
  blocked: boolean;
  reason?: string;
  toolName?: string;
  timestamp: Date;
}

export interface NewSightingsPayload {
  sightings: Sighting[];
}

export interface NewSightingsEvent {
  type: "agent:new-sightings";
  payload: NewSightingsPayload;
  timestamp: Date;
}

export interface ClassifiedSightingsPayload {
  sightings: ClassifiedSighting[];
}

export interface ClassifiedSightingsEvent {
  type: "agent:classified-sightings";
  payload: ClassifiedSightingsPayload;
  timestamp: Date;
}

export interface ScoredSightingsPayload {
  sightings: ScoredSighting[];
}

export interface ScoredSightingsEvent {
  type: "agent:scored-sightings";
  payload: ScoredSightingsPayload;
  timestamp: Date;
}

export interface AlertDispatchedPayload {
  alert: Alert;
  method: "webhook" | "sms" | "email";
}

export interface AlertDispatchedEvent {
  type: "alert:dispatched";
  payload: AlertDispatchedPayload;
  timestamp: Date;
}

export type AgentEvent =
  | NewSightingsEvent
  | ClassifiedSightingsEvent
  | ScoredSightingsEvent
  | AlertDispatchedEvent;
