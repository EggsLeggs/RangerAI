import { describe, it, expect, mock } from "bun:test";
import type { Sighting, ClassifiedSighting } from "@rangerwatch/shared";

const baseSighting: Sighting = {
  id: "test-1",
  source: "inaturalist",
  imageUrl: "https://example.com/image.jpg",
  lat: 0,
  lng: 0,
  timestamp: new Date().toISOString(),
};

const baseClassified: ClassifiedSighting = {
  ...baseSighting,
  invasive: false,
  taxonId: "12345",
  needsReview: false,
};

describe("processSighting", () => {
  it("marks low-confidence result as needsReview", async () => {
    mock.module("./classify.js", () => ({
      classifySighting: async () => ({
        ...baseClassified,
        species: "Panthera leo",
        confidence: 0.4,
        needsReview: false,
      }),
    }));
    mock.module("./taxonomy.js", () => ({
      attachTaxon: async (c: ClassifiedSighting) => ({ ...c, taxonId: "12345" }),
    }));

    const { processSighting } = await import("./pipeline.js");
    const result = await processSighting(baseSighting);
    expect(result.needsReview).toBe(true);
  });

  it("marks unknown species as needsReview even with high confidence", async () => {
    mock.module("./classify.js", () => ({
      classifySighting: async () => ({
        ...baseClassified,
        species: "unknown",
        confidence: 0.9,
        needsReview: false,
      }),
    }));
    mock.module("./taxonomy.js", () => ({
      attachTaxon: async (c: ClassifiedSighting) => ({ ...c, taxonId: null }),
    }));

    const { processSighting } = await import("./pipeline.js");
    const result = await processSighting(baseSighting);
    expect(result.needsReview).toBe(true);
  });

  it("passes through species and confidence from classify", async () => {
    mock.module("./classify.js", () => ({
      classifySighting: async () => ({
        ...baseClassified,
        species: "Ursus arctos",
        confidence: 0.85,
        needsReview: false,
      }),
    }));
    mock.module("./taxonomy.js", () => ({
      attachTaxon: async (c: ClassifiedSighting) => ({ ...c, taxonId: "67890" }),
    }));

    const { processSighting } = await import("./pipeline.js");
    const result = await processSighting(baseSighting);
    expect(result.species).toBe("Ursus arctos");
    expect(result.confidence).toBe(0.85);
    expect(result.needsReview).toBe(false);
  });
});
