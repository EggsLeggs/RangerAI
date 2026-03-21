import { describe, expect, it } from "bun:test";
import { ThreatLevel } from "@rangerwatch/shared";
import type { ScoredSighting } from "@rangerwatch/shared";
import { isAlertBoth, isAlertWebhook } from "@rangerwatch/shared";
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

  it("CRITICAL formattedMessage contains SMS template for sms field", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL });
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const msg = alert.formattedMessage;
    expect(typeof msg).toBe("object");
    expect(msg.sms).toContain("CRITICAL:");
    expect(msg.sms).toContain("Immediate review required.");
  });

  it("CRITICAL formattedMessage contains webhook template for webhook field", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL });
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const msg = alert.formattedMessage;
    expect(msg.webhook).toContain("RANGERWATCH ALERT");
    expect(msg.webhook).toContain("Species:");
  });

  it("INFO formattedMessage is a webhook template string", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.INFO, anomalyScore: 10 });
    if (!isAlertWebhook(alert)) throw new Error("expected AlertWebhook");
    expect(typeof alert.formattedMessage).toBe("string");
    expect(alert.formattedMessage).toContain("RANGERWATCH ALERT");
    expect(alert.formattedMessage).toContain("Species:");
  });

  it("SMS message (CRITICAL sms field) is under 160 characters", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL });
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const sms = alert.formattedMessage.sms;
    expect(sms.length).toBeLessThan(160);
  });

  it("SMS message is under 160 characters with long species and status strings", () => {
    const longSighting: ScoredSighting = {
      ...baseSighting,
      threatLevel: ThreatLevel.CRITICAL,
      species: "Balaenoptera musculus subspecies brevicauda",
      iucnStatus: "Endangered (EN)",
    };
    const alert = formatAlert(longSighting);
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const sms = alert.formattedMessage.sms;
    expect(sms.length).toBeLessThan(160);
  });

  it("CRITICAL out-of-range sighting uses 'sighted out of range at' phrasing", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL, inRange: false });
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const sms = alert.formattedMessage.sms;
    expect(sms).toContain("sighted out of range at");
  });

  it("CRITICAL in-range sighting uses neutral 'detected at' phrasing", () => {
    const alert = formatAlert({ ...baseSighting, threatLevel: ThreatLevel.CRITICAL, inRange: true });
    if (!isAlertBoth(alert)) throw new Error("expected AlertBoth");
    const sms = alert.formattedMessage.sms;
    expect(sms).toContain("detected at");
    expect(sms).not.toContain("out of range");
  });
});
