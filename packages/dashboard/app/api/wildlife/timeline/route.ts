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
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const fromParsed = fromStr ? new Date(fromStr) : null;
  const toParsed = toStr ? new Date(toStr) : null;
  const fromDate = fromParsed && !isNaN(fromParsed.getTime()) ? fromParsed : null;
  const toDate = toParsed && !isNaN(toParsed.getTime()) ? toParsed : null;

  if ((fromStr && !fromDate) || (toStr && !toDate)) {
    return Response.json({ error: "Invalid date parameter" }, { status: 400 });
  }

  let alerts: FlatAlert[] = [];

  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);
    const filter: Record<string, unknown> = {};
    if (fromDate || toDate) {
      const df: Record<string, Date> = {};
      if (fromDate) df.$gte = fromDate;
      if (toDate) df.$lte = toDate;
      filter.dispatchedAt = df;
    }
    const raw = await col.find(filter).sort({ dispatchedAt: 1 }).limit(5000).toArray();
    alerts = raw as FlatAlert[];
  } catch (err) {
    console.error("Failed to query timeline DB, falling back to queue:", err);
  }

  if (alerts.length === 0) {
    alerts = getQueue()
      .map((q): FlatAlert => ({ ...q.alert, receivedAt: q.receivedAt }))
      .filter((a) => {
        const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
        if (!raw) return false;
        const t = new Date(raw as string).getTime();
        if (isNaN(t)) return false;
        if (fromDate && t < fromDate.getTime()) return false;
        if (toDate && t > toDate.getTime()) return false;
        return true;
      })
      .sort((a, b) => {
        const rawA = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
        const rawB = b["dispatchedAt"] ?? b["receivedAt"] ?? b["timestamp"];
        return new Date(rawA as string).getTime() - new Date(rawB as string).getTime();
      });
  }

  const sightings = alerts.map((a) => {
    const raw = a["dispatchedAt"] ?? a["receivedAt"] ?? a["timestamp"];
    return {
      timestamp: raw ? new Date(raw as string).toISOString() : null,
      threatLevel: typeof a["threatLevel"] === "string" ? a["threatLevel"] : "INFO",
      species: typeof a["species"] === "string" ? a["species"] : null,
      alertId: typeof a["alertId"] === "string" ? a["alertId"] : null,
    };
  });

  return Response.json({ sightings });
}
