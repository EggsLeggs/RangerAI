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

const MIN_HOURS = 1;
const MAX_HOURS = 720; // 30 days

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let hours = parseInt(searchParams.get("hours") ?? "24", 10);
  if (!Number.isFinite(hours) || hours <= 0) hours = 24;
  hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, hours));
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  let alerts: FlatAlert[] = [];

  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);
    const raw = await col
      .find({ dispatchedAt: { $gte: new Date(cutoff) } })
      .sort({ dispatchedAt: 1 })
      .limit(2000)
      .toArray();
    alerts = raw as FlatAlert[];
  } catch {
    // fall back to queue
  }

  if (alerts.length === 0) {
    alerts = getQueue()
      .map((q): FlatAlert => ({ ...q.alert, receivedAt: q.receivedAt }))
      .filter((a) => {
        const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
        if (!raw) return false;
        const t = new Date(raw as string).getTime();
        return !isNaN(t) && t >= cutoff;
      });
  }

  // bucket into zone + 1h bucket bins
  type Bin = { species: Set<string>; zone: string };
  const bins = new Map<string, Bin>();

  for (const a of alerts) {
    const lat = typeof a["lat"] === "number" ? a["lat"] : null;
    const lng = typeof a["lng"] === "number" ? a["lng"] : null;
    const species = typeof a["species"] === "string" ? a["species"] : null;
    const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
    if (lat === null || lng === null || species === null || raw == null) continue;
    const t = new Date(raw as string).getTime();
    if (isNaN(t)) continue;
    const hourBucket = Math.floor(t / (60 * 60 * 1000));
    const zone = zoneIdFromCoords(lat, lng);
    const key = `${zone}:${hourBucket}`;
    if (!bins.has(key)) bins.set(key, { species: new Set(), zone });
    bins.get(key)!.species.add(species);
  }

  // count co-occurrences
  const pairMap = new Map<string, { count: number; zones: Set<string> }>();
  for (const bin of bins.values()) {
    const sp = [...bin.species];
    for (let i = 0; i < sp.length; i++) {
      for (let j = i + 1; j < sp.length; j++) {
        const a = sp[i]! < sp[j]! ? sp[i]! : sp[j]!;
        const b = sp[i]! < sp[j]! ? sp[j]! : sp[i]!;
        const key = `${a}|||${b}`;
        if (!pairMap.has(key)) pairMap.set(key, { count: 0, zones: new Set() });
        const entry = pairMap.get(key)!;
        entry.count++;
        entry.zones.add(bin.zone);
      }
    }
  }

  const pairs = [...pairMap.entries()].map(([key, v]) => {
    const [species1, species2] = key.split("|||");
    return { species1: species1!, species2: species2!, count: v.count, zones: [...v.zones] };
  });

  // node summary per species
  const nodeMap = new Map<string, { totalSightings: number; iucnStatus: string | null }>();
  for (const a of alerts) {
    const species = typeof a["species"] === "string" ? a["species"] : null;
    if (!species) continue;
    if (!nodeMap.has(species)) nodeMap.set(species, { totalSightings: 0, iucnStatus: null });
    const n = nodeMap.get(species)!;
    n.totalSightings++;
    if (typeof a["iucnStatus"] === "string") n.iucnStatus = a["iucnStatus"];
  }

  const nodes = [...nodeMap.entries()].map(([species, v]) => ({
    species,
    totalSightings: v.totalSightings,
    iucnStatus: v.iucnStatus,
  }));

  return Response.json({ pairs, nodes });
}
