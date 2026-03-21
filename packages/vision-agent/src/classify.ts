import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { Sighting, ClassifiedSighting } from "@rangerai/shared";
import { CLASSIFICATION_SYSTEM_PROMPT } from "./prompt.js";

const classificationSchema = z.object({
  species: z.string(),
  confidence: z.number().min(0).max(1),
  invasive: z.boolean(),
  reasoning: z.string(),
});

export async function classifySighting(
  sighting: Sighting
): Promise<ClassifiedSighting> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: classificationSchema,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "image", image: new URL(sighting.imageUrl) }],
        },
      ],
    });

    return {
      ...sighting,
      species: object.species,
      confidence: object.confidence,
      invasive: object.invasive,
      taxonId: null,
      needsReview: false,
    };
  } catch {
    return {
      ...sighting,
      species: "unknown",
      confidence: 0,
      invasive: false,
      taxonId: null,
      needsReview: false,
    };
  }
}
