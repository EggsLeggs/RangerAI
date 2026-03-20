import type { Sighting, ClassifiedSighting } from "@rangerwatch/shared";
import { classifySighting } from "./classify.js";
import { attachTaxon } from "./taxonomy.js";
import { applyThreshold } from "./router.js";

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

  return result;
}
