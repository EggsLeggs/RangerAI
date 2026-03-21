import type { ClassifiedSighting } from "@rangerai/shared";
import { env } from "@rangerai/shared/env";

interface InatTaxon {
  id: number;
  name: string;
  rank: string;
  matched_term?: string;
}

interface InatTaxaResponse {
  results: InatTaxon[];
  total_results: number;
}

const FETCH_TIMEOUT_MS = 5_000;

const taxonCache = new Map<string, string | null>();

export async function lookupTaxon(speciesName: string): Promise<string | null> {
  if (!speciesName || speciesName === "unknown") return null;

  if (taxonCache.has(speciesName)) {
    return taxonCache.get(speciesName)!;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q: speciesName,
      rank: "species",
      per_page: "1",
    });

    const headers: Record<string, string> = {};
    if (env.INATURALIST_API_KEY) {
      headers["Authorization"] = `Bearer ${env.INATURALIST_API_KEY}`;
    }

    const response = await fetch(
      `https://api.inaturalist.org/v1/taxa?${params}`,
      { headers, signal: controller.signal }
    );

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(
        `[vision-agent] iNaturalist taxa lookup returned ${response.status} for "${speciesName}"`
      );
      // only cache confirmed misses; skip caching for transient errors (429, 5xx)
      if (response.status === 404) {
        taxonCache.set(speciesName, null);
      }
      return null;
    }

    const body = (await response.json()) as InatTaxaResponse;
    const result = body.results[0] ? String(body.results[0].id) : null;
    // cache null only for a confirmed empty result from iNaturalist
    taxonCache.set(speciesName, result);
    return result;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.warn(
      isAbort
        ? `[vision-agent] iNaturalist taxa lookup timed out for "${speciesName}"`
        : `[vision-agent] iNaturalist taxa lookup failed for "${speciesName}":`,
      isAbort ? undefined : err
    );
    // do not cache transient network/timeout failures
    return null;
  }
}

export async function attachTaxon(
  classified: ClassifiedSighting
): Promise<ClassifiedSighting> {
  const taxonId = await lookupTaxon(classified.species);
  // a null taxonId means iNaturalist could not confirm the species, so flag for manual review
  // even if the vision model was confident
  const needsReview = classified.needsReview || taxonId === null;
  return { ...classified, taxonId, needsReview };
}
