import type { Sighting, ClassifiedSighting } from "@rangerai/shared";
import { classifySighting } from "./classify.js";
import { attachTaxon } from "./taxonomy.js";
import { applyThreshold } from "./router.js";
import { inspectOutput } from "./guardrail.js";

export async function processSighting(sighting: Sighting): Promise<ClassifiedSighting> {
  const classified = await classifySighting(sighting);
  console.log(
    `[vision-agent] classified sighting ${sighting.id}: species="${classified.species}" confidence=${classified.confidence}`
  );

  const withTaxon = await attachTaxon(classified);
  console.log(
    `[vision-agent] taxon lookup for sighting ${sighting.id}: taxonId=${withTaxon.taxonId}`
  );

  const result = applyThreshold(withTaxon);
  console.log(
    `[vision-agent] routing sighting ${sighting.id}: needsReview=${result.needsReview}`
  );

  const guardrail = await inspectOutput(result);
  console.log(
    `[vision-agent] guardrail sighting ${sighting.id}: blocked=${guardrail.blocked} reason=${guardrail.reason ?? "none"}`
  );

  if (guardrail.blocked) {
    return { ...result, needsReview: true };
  }

  return result;
}
