import type { BoundingBox, Sighting } from "@rangerai/shared";
import { env } from "@rangerai/shared/env";

const BASE_URL = "https://api.inaturalist.org/v1";
const PER_PAGE = 200;

interface InatPhoto {
  id: number;
  url: string;
  attribution: string;
}

interface InatObservation {
  id: number;
  description: string | null;
  location: string | null;
  time_observed_at: string | null;
  created_at: string;
  photos: InatPhoto[];
}

interface InatResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: InatObservation[];
}

function parseLocation(raw: string): { lat: number; lng: number } | null {
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function mapObservationToSighting(obs: InatObservation): Sighting | null {
  if (obs.photos.length === 0 || !obs.location) return null;
  const coords = parseLocation(obs.location);
  if (!coords) return null;

  const rawDate = obs.time_observed_at ?? obs.created_at;
  const parsedDate = new Date(rawDate);
  if (isNaN(parsedDate.getTime())) return null;

  const sighting: Sighting = {
    id: `inaturalist:${obs.id}`,
    source: "inaturalist",
    imageUrl: obs.photos[0].url,
    lat: coords.lat,
    lng: coords.lng,
    observedAt: parsedDate,
  };

  if (obs.description) {
    sighting.observerNotes = obs.description;
  }

  return sighting;
}

export async function fetchObservations(boundingBox: BoundingBox): Promise<Sighting[]> {
  if (!env.INATURALIST_API_KEY) {
    console.warn(
      "[ingest-agent] INATURALIST_API_KEY not set - proceeding unauthenticated (lower rate limits apply)"
    );
  }

  const headers: Record<string, string> = env.INATURALIST_API_KEY
    ? { Authorization: `Bearer ${env.INATURALIST_API_KEY}` }
    : {};

  const maxResults = env.INATURALIST_MAX_RESULTS;
  const sightings: Sighting[] = [];
  let page = 1;

  while (sightings.length < maxResults) {
    const params = new URLSearchParams({
      quality_grade: "research",
      photos: "true",
      per_page: String(PER_PAGE),
      page: String(page),
      nelat: String(boundingBox.neLat),
      nelng: String(boundingBox.neLng),
      swlat: String(boundingBox.swLat),
      swlng: String(boundingBox.swLng),
    });

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/observations?${params}`, { headers });
    } catch (err) {
      console.error(`[ingest-agent] network error on iNaturalist page ${page}:`, err);
      return sightings;
    }

    if (!response.ok) {
      console.error(
        `[ingest-agent] iNaturalist returned ${response.status} on page ${page} - aborting pagination`
      );
      return sightings;
    }

    const body = (await response.json()) as InatResponse;

    for (const obs of body.results) {
      if (sightings.length >= maxResults) break;
      const sighting = mapObservationToSighting(obs);
      if (sighting !== null) sightings.push(sighting);
    }

    if (body.results.length < PER_PAGE || sightings.length >= maxResults) break;
    page += 1;
  }

  return sightings;
}
