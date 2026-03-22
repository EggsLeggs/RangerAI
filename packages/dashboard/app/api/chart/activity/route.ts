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

function computeSeries(alerts: Record<string, unknown>[], days: number, zone: string) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const dayMap = new Map<string, { sightings: number; incidents: number; resolved: number }>();

  for (const alert of alerts) {
    const raw = alert["dispatchedAt"] ?? alert["receivedAt"];
    const d = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : null;
    if (!d || isNaN(d.getTime()) || d.getTime() < since) continue;

    if (zone !== "all") {
      const lat = typeof alert["lat"] === "number" ? (alert["lat"] as number) : null;
      const lng = typeof alert["lng"] === "number" ? (alert["lng"] as number) : null;
      if (lat === null || lng === null) continue;
      if (zoneIdFromCoords(lat, lng) !== zone) continue;
    }

    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const cur = dayMap.get(key) ?? { sightings: 0, incidents: 0, resolved: 0 };
    cur.sightings++;
    const tl = alert["threatLevel"];
    if (tl === "WARNING" || tl === "CRITICAL") cur.incidents++;
    else if (tl === "INFO") cur.resolved++;
    dayMap.set(key, cur);
  }

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const data = dayMap.get(key) ?? { sightings: 0, incidents: 0, resolved: 0 };
    return {
      day: key,
      sightings: data.sightings,
      incidents: data.incidents,
      resolved: data.resolved,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") ?? "30", 10));
  const zone = searchParams.get("zone") ?? "all";

  // attempt MongoDB
  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const alerts = await col.find({
      $or: [
        { dispatchedAt: { $gte: since } },
        { receivedAt: { $gte: since } },
      ],
    }).toArray();

    if (alerts.length > 0) {
      return Response.json({ series: computeSeries(alerts as unknown as Record<string, unknown>[], days, zone) });
    }
  } catch {
    // fall through to queue
  }

  // fall back to in-memory queue
  const queueAlerts = getQueue().map((q) => ({ ...q.alert, receivedAt: q.receivedAt }));
  return Response.json({ series: computeSeries(queueAlerts, days, zone) });
}
