import type { BoundingBox, Sighting } from "@rangerai/shared";

const BASE_URL = "https://api.gbif.org/v1";
const PAGE_LIMIT = 200;
const MAX_RESULTS = 1000;

// --- raw GBIF types ---

interface GBIFMedia {
  type: string;
  identifier: string;
}

interface GBIFOccurrence {
  key: number;
  decimalLatitude?: number;
  decimalLongitude?: number;
  eventDate?: string;
  occurrenceRemarks?: string;
  media: GBIFMedia[];
}

interface GBIFResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  count: number;
  results: GBIFOccurrence[];
}

// --- helpers ---

/** GBIF may return year-only, year-month, or slash ranges; reject those so we do not invent a false instant. */
function isExactEventDateString(raw: string): boolean {
  const t = raw.trim();
  if (t.includes("/")) return false;
  if (/^\d{4}$/.test(t)) return false;
  if (/^\d{4}-\d{2}$/.test(t)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return true;
  return false;
}

function isGBIFOccurrence(value: unknown): value is GBIFOccurrence {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.key !== "number" || !Number.isFinite(o.key)) return false;
  if (!Array.isArray(o.media)) return false;
  for (const item of o.media) {
    if (typeof item !== "object" || item === null) return false;
    const m = item as Record<string, unknown>;
    if (m.type !== undefined && typeof m.type !== "string") return false;
    if (m.identifier !== undefined && typeof m.identifier !== "string") return false;
  }
  if (o.decimalLatitude !== undefined && typeof o.decimalLatitude !== "number") return false;
  if (o.decimalLongitude !== undefined && typeof o.decimalLongitude !== "number") return false;
  if (o.eventDate !== undefined && typeof o.eventDate !== "string") return false;
  if (o.occurrenceRemarks !== undefined && typeof o.occurrenceRemarks !== "string") return false;
  return true;
}

function parseEventDate(raw: string | undefined, occurrenceKey?: number): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!isExactEventDateString(trimmed)) {
    console.warn(
      `[ingest-agent] GBIF eventDate rejected (non-exact or unsupported format) key=${occurrenceKey ?? "unknown"}:`,
      raw
    );
    return null;
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    console.warn(
      `[ingest-agent] invalid GBIF eventDate key=${occurrenceKey ?? "unknown"}:`,
      raw
    );
    return null;
  }
  return parsed;
}

function mapOccurrenceToSighting(occ: GBIFOccurrence): Sighting | null {
  const imageMedia = occ.media.find((m) => m.type === "StillImage" && m.identifier);
  if (
    occ.decimalLatitude === undefined ||
    occ.decimalLongitude === undefined ||
    !imageMedia
  ) {
    return null;
  }
  const observedAt = parseEventDate(occ.eventDate, occ.key);
  if (!observedAt) {
    return null;
  }

  const sighting: Sighting = {
    id: `gbif:${occ.key}`,
    source: "gbif",
    imageUrl: imageMedia.identifier,
    lat: occ.decimalLatitude,
    lng: occ.decimalLongitude,
    observedAt,
  };

  if (occ.occurrenceRemarks) {
    sighting.observerNotes = occ.occurrenceRemarks;
  }

  return sighting;
}

// --- exported client ---

export async function fetchOccurrences(boundingBox: BoundingBox): Promise<Sighting[]> {
  const token = process.env.GBIF_TOKEN?.trim();
  if (!token) {
    console.warn(
      "[ingest-agent] GBIF_TOKEN not set - proceeding unauthenticated (lower rate limits apply)"
    );
  }

  // GBIF uses HTTP Basic auth; GBIF_TOKEN must be "username:password"
  if (token && !token.includes(":")) {
    console.warn("[ingest-agent] GBIF_TOKEN should be in \"username:password\" format for Basic auth");
  }
  const headers: Record<string, string> =
    token && token.includes(":")
      ? { Authorization: `Basic ${Buffer.from(token).toString("base64")}` }
      : {};

  const sightings: Sighting[] = [];
  let offset = 0;

  while (sightings.length < MAX_RESULTS) {
    const params = new URLSearchParams({
      basisOfRecord: "HUMAN_OBSERVATION",
      mediaType: "StillImage",
      limit: String(PAGE_LIMIT),
      offset: String(offset),
      decimalLatitude: `${boundingBox.swLat},${boundingBox.neLat}`,
      decimalLongitude: `${boundingBox.swLng},${boundingBox.neLng}`,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${BASE_URL}/occurrence/search?${params}`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(
          `[ingest-agent] GBIF returned ${response.status} at offset ${offset} - aborting pagination\n${errBody}`
        );
        return sightings.slice(0, MAX_RESULTS);
      }

      const parsedBody: unknown = await response.json();
      if (
        typeof parsedBody !== "object" ||
        parsedBody === null ||
        !Array.isArray((parsedBody as GBIFResponse).results) ||
        typeof (parsedBody as GBIFResponse).endOfRecords !== "boolean"
      ) {
        console.error(
          `[ingest-agent] invalid GBIF response shape at offset ${offset} - aborting pagination`
        );
        return sightings.slice(0, MAX_RESULTS);
      }
      const body = parsedBody as GBIFResponse;

      for (const occ of body.results) {
        if (sightings.length >= MAX_RESULTS) break;
        if (!isGBIFOccurrence(occ)) continue;
        const sighting = mapOccurrenceToSighting(occ);
        if (sighting !== null) sightings.push(sighting);
      }

      if (body.endOfRecords) break;
      if (sightings.length >= MAX_RESULTS) break;
      offset += PAGE_LIMIT;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.error(`[ingest-agent] GBIF request timed out at offset ${offset}`);
      } else {
        console.error(`[ingest-agent] network error on GBIF offset ${offset}:`, err);
      }
      return sightings.slice(0, MAX_RESULTS);
    } finally {
      clearTimeout(timeout);
    }
  }

  return sightings.slice(0, MAX_RESULTS);
}
