import { describe, it, expect, mock, afterEach } from "bun:test";
import type { BoundingBox, ClassifiedSighting } from "@rangerwatch/shared";

const mockGetRangeBounds = mock(async (_: string): Promise<BoundingBox | null> => null);

mock.module("./clients/iucn.js", () => ({
  getRangeBounds: mockGetRangeBounds,
}));

import { isInRange, validateRange } from "./range.js";

const baseSighting: ClassifiedSighting = {
  id: "test-1",
  source: "inaturalist",
  imageUrl: "https://example.com/img.jpg",
  lat: 0,
  lng: 0,
  observedAt: new Date(),
  species: "Panthera leo",
  confidence: 0.9,
  invasive: false,
  taxonId: null,
  needsReview: false,
};

const bounds: BoundingBox = {
  swLat: -10,
  swLng: -10,
  neLat: 10,
  neLng: 10,
};

describe("isInRange", () => {
  it("returns true when the point is inside the bounding box", () => {
    const sighting = { ...baseSighting, lat: 5, lng: 5 };
    expect(isInRange(sighting, bounds)).toBe(true);
  });

  it("returns false when the point is outside the bounding box", () => {
    const sighting = { ...baseSighting, lat: 50, lng: 50 };
    expect(isInRange(sighting, bounds)).toBe(false);
  });

  it("returns true for a point on the SW corner (inclusive boundary)", () => {
    const sighting = { ...baseSighting, lat: bounds.swLat, lng: bounds.swLng };
    expect(isInRange(sighting, bounds)).toBe(true);
  });

  it("returns true for a point on the NE corner (inclusive boundary)", () => {
    const sighting = { ...baseSighting, lat: bounds.neLat, lng: bounds.neLng };
    expect(isInRange(sighting, bounds)).toBe(true);
  });

  it("returns true for a longitude inside an antimeridian-crossing box", () => {
    const crossingBounds: BoundingBox = { swLat: -10, swLng: 170, neLat: 10, neLng: -170 };
    const sighting = { ...baseSighting, lat: 0, lng: 175 };
    expect(isInRange(sighting, crossingBounds)).toBe(true);
  });

  it("returns true for a longitude on the other side of an antimeridian-crossing box", () => {
    const crossingBounds: BoundingBox = { swLat: -10, swLng: 170, neLat: 10, neLng: -170 };
    const sighting = { ...baseSighting, lat: 0, lng: -175 };
    expect(isInRange(sighting, crossingBounds)).toBe(true);
  });

  it("returns false for a longitude outside an antimeridian-crossing box", () => {
    const crossingBounds: BoundingBox = { swLat: -10, swLng: 170, neLat: 10, neLng: -170 };
    const sighting = { ...baseSighting, lat: 0, lng: 0 };
    expect(isInRange(sighting, crossingBounds)).toBe(false);
  });
});

describe("validateRange", () => {
  afterEach(() => {
    mockGetRangeBounds.mockReset();
  });

  it("returns inRange: true and bounds: null when range data is unavailable", async () => {
    mockGetRangeBounds.mockResolvedValueOnce(null);
    const result = await validateRange(baseSighting);
    expect(result).toEqual({ inRange: true, bounds: null });
  });
});
