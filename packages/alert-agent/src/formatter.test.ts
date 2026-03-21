import { describe, expect, it } from "bun:test";
import { ThreatLevel } from "@rangerwatch/shared";
import type { ScoredSighting } from "@rangerwatch/shared";
import { formatAlert } from "./formatter";

const baseSighting: ScoredSighting = {
  id: "obs-001",
  source: "inaturalist",
  imageUrl: "https://example.com/img.jpg",
  lat: -1.2345,
  lng: 36.8219,
  observedAt: new Date("2026-03-21T08:00:00.000Z"),
  species: "Panthera leo",
  confidence: 0.92,
  invasive: false,
  taxonId: "42123",
  needsReview: false,
  anomalyScore: 88,
  threatLevel: ThreatLevel.CRITICAL,
  iucnStatus: "VU",
  inRange: false,
};

describe("formatAlert", () => {
  it("CRITICAL sighting sets dispatchMethod to 'both'", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL });
    expect(alert.dispatchMethod).toBe("both");
  });

  it("INFO sighting sets dispatchMethod to 'webhook'", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.INFO, anomalyScore: 10 });
    expect(alert.dispatchMethod).toBe("webhook");
  });

  it("SMS message (CRITICAL formattedMessage) is under 160 characters", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL });
    expect(alert.formattedMessage.length).toBeLessThan(160);
  });
});
