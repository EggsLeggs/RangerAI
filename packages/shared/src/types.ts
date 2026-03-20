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

export type AlertDispatchMethod = "webhook" | "sms" | "both";

export interface Alert extends ScoredSighting {
  alertId: string;
  formattedMessage: string;
  dispatchedAt: Date;
  dispatchMethod: AlertDispatchMethod;
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

export type AgentEvent = NewSightingsEvent;
