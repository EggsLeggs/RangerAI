import { describe, it, expect } from "bun:test";
import type { ClassifiedSighting } from "@rangerai/shared";
import {
  scoreSighting,
  isNocturnal,
  WEIGHT_NOCTURNAL,
  WEIGHT_OUT_OF_RANGE,
  WEIGHT_ENDANGERED_SPECIES,
  WEIGHT_INVASIVE_FIRST_APPEARANCE,
  WEIGHT_HUMAN_CLUSTERING,
} from "./scoring.js";

const baseSighting: ClassifiedSighting = {
  id: "test-1",
  source: "inaturalist",
  imageUrl: "https://example.com/img.jpg",
  lat: 0,
  lng: 0,
  observedAt: new Date("2024-01-01T12:00:00Z"), // noon UTC, lng 0 = noon local
  species: "Panthera leo",
  confidence: 0.9,
  invasive: false,
  taxonId: null,
  needsReview: false,
};

describe("scoreSighting", () => {
  it("out-of-range CR species scores >= 65", () => {
    const score = scoreSighting(baseSighting, {
      inRange: false,
      iucnStatus: "CR",
      previouslySeen: false,
      humanClusterNearby: false,
    });
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBe(WEIGHT_OUT_OF_RANGE + WEIGHT_ENDANGERED_SPECIES); // 40 + 25 = 65
  });

  it("in-range LC non-invasive sighting scores 0", () => {
    const score = scoreSighting(baseSighting, {
      inRange: true,
      iucnStatus: "LC",
      previouslySeen: false,
      humanClusterNearby: false,
    });
    expect(score).toBe(0);
  });

  it("nocturnal sighting at lng 0 scores WEIGHT_NOCTURNAL", () => {
    const nocturnal = { ...baseSighting, observedAt: new Date("2024-01-01T23:00:00Z") };
    const score = scoreSighting(nocturnal, {
      inRange: true,
      iucnStatus: "LC",
      previouslySeen: false,
      humanClusterNearby: false,
    });
    expect(score).toBe(WEIGHT_NOCTURNAL);
  });

  it("invasive first appearance adds WEIGHT_INVASIVE_FIRST_APPEARANCE", () => {
    const invasive = { ...baseSighting, invasive: true };
    const score = scoreSighting(invasive, {
      inRange: true,
      iucnStatus: "LC",
      previouslySeen: false,
      humanClusterNearby: false,
    });
    expect(score).toBe(WEIGHT_INVASIVE_FIRST_APPEARANCE);
  });

  it("invasive does not add weight when previouslySeen is true", () => {
    const invasive = { ...baseSighting, invasive: true };
    const score = scoreSighting(invasive, {
      inRange: true,
      iucnStatus: "LC",
      previouslySeen: true,
      humanClusterNearby: false,
    });
    expect(score).toBe(0);
  });

  it("human clustering adds WEIGHT_HUMAN_CLUSTERING for CR species", () => {
    const score = scoreSighting(baseSighting, {
      inRange: true,
      iucnStatus: "CR",
      previouslySeen: false,
      humanClusterNearby: true,
    });
    expect(score).toBe(WEIGHT_ENDANGERED_SPECIES + WEIGHT_HUMAN_CLUSTERING);
  });

  it("human clustering does not add weight for LC species", () => {
    const score = scoreSighting(baseSighting, {
      inRange: true,
      iucnStatus: "LC",
      previouslySeen: false,
      humanClusterNearby: true,
    });
    expect(score).toBe(0);
  });

  it("score clamps at 100 when all signals active (sum exceeds 100)", () => {
    // out-of-range (40) + nocturnal (20) + endangered (25) + human-clustering (15) + invasive first (15) = 115 -> clamped to 100
    const worst = {
      ...baseSighting,
      invasive: true,
      observedAt: new Date("2024-01-01T23:00:00Z"),
    };
    const score = scoreSighting(worst, {
      inRange: false,
      iucnStatus: "CR",
      previouslySeen: false,
      humanClusterNearby: true,
    });
    expect(score).toBe(100);
  });

  it("invasive first appearance works correctly for negative lat/lng coordinates", () => {
    const invasive = { ...baseSighting, invasive: true, lat: -0.1, lng: -0.1 };
    expect(
      scoreSighting(invasive, {
        inRange: true,
        iucnStatus: "LC",
        previouslySeen: false,
        humanClusterNearby: false,
      })
    ).toBe(WEIGHT_INVASIVE_FIRST_APPEARANCE);
    expect(
      scoreSighting(invasive, {
        inRange: true,
        iucnStatus: "LC",
        previouslySeen: true,
        humanClusterNearby: false,
      })
    ).toBe(0);
  });
});

describe("isNocturnal", () => {
  it("returns true for 23:00 UTC at lng 0 (23:00 local)", () => {
    expect(isNocturnal(new Date("2024-01-01T23:00:00Z"), 0)).toBe(true);
  });

  it("returns true for 02:00 UTC at lng 0 (02:00 local)", () => {
    expect(isNocturnal(new Date("2024-01-01T02:00:00Z"), 0)).toBe(true);
  });

  it("returns false for 12:00 UTC at lng 0 (noon local)", () => {
    expect(isNocturnal(new Date("2024-01-01T12:00:00Z"), 0)).toBe(false);
  });

  it("returns false on boundary of 06:00 local", () => {
    // 06:00 UTC at lng 0 = 06:00 local - not nocturnal (< 6 is false at exactly 6)
    expect(isNocturnal(new Date("2024-01-01T06:00:00Z"), 0)).toBe(false);
  });

  it("accounts for timezone offset via longitude", () => {
    // 20:00 UTC at lng -75 (UTC-5) = 15:00 local - daytime
    expect(isNocturnal(new Date("2024-01-01T20:00:00Z"), -75)).toBe(false);
    // 20:00 UTC at lng 75 (UTC+5) = 01:00 local - nocturnal
    expect(isNocturnal(new Date("2024-01-01T20:00:00Z"), 75)).toBe(true);
  });
});
