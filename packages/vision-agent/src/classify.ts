import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { Sighting, ClassifiedSighting } from "@rangerwatch/shared";
import { env } from "@rangerwatch/shared/env";
import { CLASSIFICATION_SYSTEM_PROMPT } from "./prompt.js";

// ensure env is imported so dotenv runs and OPENAI_API_KEY is present
void env;

const CIVIC_TIMEOUT_MS = 3000;

async function inspectOutput(payload: ClassifiedSighting): Promise<boolean> {
  try {
    const response = await fetch(
      `http://localhost:${env.MCP_PORT}/tools/call`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "inspect_output",
            arguments: { payload: JSON.stringify(payload) },
          },
        }),
        signal: AbortSignal.timeout(CIVIC_TIMEOUT_MS),
      }
    );
    if (!response.ok) return false;
    const result = (await response.json()) as {
      result?: { blocked?: boolean };
    };
    return result.result?.blocked === true;
  } catch {
    // civic-mcp server unavailable — allow through and log
    console.warn(
      "[vision-agent] civic-mcp inspect_output unavailable; proceeding without guardrail"
    );
    return false;
  }
}

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

    const base: ClassifiedSighting = {
      ...sighting,
      species: object.species,
      confidence: object.confidence,
      invasive: object.invasive,
      taxonId: null,
      needsReview: false,
    };

    const blocked = await inspectOutput(base);
    if (blocked) {
      return { ...base, needsReview: true };
    }

    return base;
  } catch {
    const fallback: ClassifiedSighting = {
      ...sighting,
      species: "unknown",
      confidence: 0,
      invasive: false,
      taxonId: null,
      needsReview: false,
    };

    const blocked = await inspectOutput(fallback);
    if (blocked) {
      fallback.needsReview = true;
    }

    return fallback;
  }
}
