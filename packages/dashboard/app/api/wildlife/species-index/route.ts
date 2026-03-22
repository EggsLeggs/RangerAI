import { zoneIdFromCoords } from "../../../../lib/sighting-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FlatAlert = Record<string, unknown>;

function getQueue(): { alert: FlatAlert; receivedAt: string }[] {
  const g = globalThis as typeof globalThis & {
    __rangerAlertQueue?: { alert: FlatAlert; receivedAt: string }[];
  };
  return g.__rangerAlertQueue ?? [];
}

export async function GET() {
  let alerts: FlatAlert[] = [];

  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);
    const raw = await col.find({}).sort({ dispatchedAt: -1 }).limit(5000).toArray();
    alerts = raw as FlatAlert[];
  } catch {
    // fall back to queue
  }

  if (alerts.length === 0) {
    alerts = getQueue().map((q) => ({ ...q.alert, receivedAt: q.receivedAt }));
  }

  type SpeciesEntry = {
    name: string;
    totalSightings: number;
    lastSeen: string | null;
    lastZone: string | null;
    confidenceSum: number;
    confidenceCount: number;
    iucnStatus: string | null;
    imageUrl: string | null;
    threatBreakdown: Record<string, number>;
  };

  const map = new Map<string, SpeciesEntry>();

  for (const a of alerts) {
    const species = typeof a["species"] === "string" ? a["species"] : null;
    if (!species) continue;

    if (!map.has(species)) {
      map.set(species, {
        name: species,
        totalSightings: 0,
        lastSeen: null,
        lastZone: null,
        confidenceSum: 0,
        confidenceCount: 0,
        iucnStatus: null,
        imageUrl: null,
        threatBreakdown: { CRITICAL: 0, WARNING: 0, INFO: 0, NEEDS_REVIEW: 0 },
      });
    }

    const entry = map.get(species)!;
    entry.totalSightings++;

    const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
    const ts = raw ? new Date(raw as string) : null;
    if (ts && !isNaN(ts.getTime())) {
      if (!entry.lastSeen || ts.toISOString() > entry.lastSeen) {
        entry.lastSeen = ts.toISOString();
        const lat = typeof a["lat"] === "number" ? a["lat"] : null;
        const lng = typeof a["lng"] === "number" ? a["lng"] : null;
        entry.lastZone = lat !== null && lng !== null ? zoneIdFromCoords(lat, lng) : null;
        if (typeof a["iucnStatus"] === "string") entry.iucnStatus = a["iucnStatus"];
        if (typeof a["imageUrl"] === "string") entry.imageUrl = a["imageUrl"];
      }
    }

    const conf = a["confidence"];
    if (typeof conf === "number") {
      entry.confidenceSum += conf;
      entry.confidenceCount++;
    }

    const tl = typeof a["threatLevel"] === "string" ? a["threatLevel"] : "INFO";
    const key = ["CRITICAL", "WARNING", "INFO", "NEEDS_REVIEW"].includes(tl) ? tl : "INFO";
    entry.threatBreakdown[key] = (entry.threatBreakdown[key] ?? 0) + 1;
  }

  const species = [...map.values()].map((e) => ({
    name: e.name,
    totalSightings: e.totalSightings,
    lastSeen: e.lastSeen,
    lastZone: e.lastZone,
    avgConfidence: e.confidenceCount > 0 ? e.confidenceSum / e.confidenceCount : null,
    iucnStatus: e.iucnStatus,
    threatBreakdown: e.threatBreakdown,
    imageUrl: e.imageUrl,
  }));

  return Response.json({ species });
}
