export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Queued = { alert: Record<string, unknown>; receivedAt: string };

function getQueue(): Queued[] {
  const g = globalThis as typeof globalThis & { __rangerAlertQueue?: Queued[] };
  return g.__rangerAlertQueue ?? [];
}

function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return "ZN-" + String(n).padStart(2, "0");
}

function computeStats(alerts: Record<string, unknown>[]) {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();

  const zoneSet = new Set<string>();
  const speciesSet = new Set<string>();
  let alertsToday = 0;

  for (const alert of alerts) {
    const raw = alert["dispatchedAt"] ?? alert["receivedAt"];
    const d = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : null;
    if (!d || isNaN(d.getTime()) || d.getTime() < startMs) continue;

    alertsToday++;

    const lat = typeof alert["lat"] === "number" ? (alert["lat"] as number) : null;
    const lng = typeof alert["lng"] === "number" ? (alert["lng"] as number) : null;
    if (lat !== null && lng !== null) zoneSet.add(zoneIdFromCoords(lat, lng));

    const species = typeof alert["species"] === "string" ? (alert["species"] as string) : null;
    if (species) speciesSet.add(species);
  }

  return { activeZones: zoneSet.size, speciesTracked: speciesSet.size, alertsToday };
}

export async function GET() {
  // attempt MongoDB
  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const alerts = await col.find({
      $or: [
        { dispatchedAt: { $gte: startOfToday } },
        { receivedAt: { $gte: startOfToday } },
      ],
    }).toArray();

    if (alerts.length > 0) {
      return Response.json(computeStats(alerts as unknown as Record<string, unknown>[]));
    }
  } catch {
    // fall through to queue
  }

  // fall back to in-memory queue
  const queueAlerts = getQueue().map((q) => ({ ...q.alert, receivedAt: q.receivedAt }));
  return Response.json(computeStats(queueAlerts));
}
