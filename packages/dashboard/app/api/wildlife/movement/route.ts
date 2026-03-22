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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const species = searchParams.get("species");
  if (!species) {
    return Response.json({ error: "species param required" }, { status: 400 });
  }

  const decoded = decodeURIComponent(species);
  let alerts: FlatAlert[] = [];

  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);
    const raw = await col
      .find({ species: decoded })
      .sort({ dispatchedAt: 1 })
      .limit(500)
      .toArray();
    alerts = raw as FlatAlert[];
  } catch {
    // fall back to queue
  }

  if (alerts.length === 0) {
    alerts = getQueue()
      .map((q): FlatAlert => ({ ...q.alert, receivedAt: q.receivedAt }))
      .filter((a) => {
        return typeof a["species"] === "string" && a["species"] === decoded;
      })
      .sort((a, b) => {
        const rawA = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
        const rawB = b["dispatchedAt"] ?? b["receivedAt"] ?? b["timestamp"];
        const tA = rawA ? new Date(rawA as string).getTime() : 0;
        const tB = rawB ? new Date(rawB as string).getTime() : 0;
        return tA - tB;
      });
  }

  const sightings = alerts
    .filter((a) => typeof a["lat"] === "number" && typeof a["lng"] === "number")
    .map((a) => {
      const lat = a["lat"] as number;
      const lng = a["lng"] as number;
      const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
      const ts = raw ? new Date(raw as string).toISOString() : null;
      return {
        lat,
        lng,
        timestamp: ts,
        zone: zoneIdFromCoords(lat, lng),
        threatLevel: typeof a["threatLevel"] === "string" ? a["threatLevel"] : "INFO",
        inRange: typeof a["inRange"] === "boolean" ? a["inRange"] : true,
        alertId: typeof a["alertId"] === "string" ? a["alertId"] : null,
        confidence: typeof a["confidence"] === "number" ? a["confidence"] : null,
        anomalyScore: typeof a["anomalyScore"] === "number" ? a["anomalyScore"] : null,
      };
    });

  return Response.json({ sightings });
}
