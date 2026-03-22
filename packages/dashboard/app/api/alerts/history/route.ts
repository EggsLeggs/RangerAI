export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Queued = { alert: Record<string, unknown>; receivedAt: string };

function getQueue(): Queued[] {
  const g = globalThis as typeof globalThis & { __rangerAlertQueue?: Queued[] };
  return g.__rangerAlertQueue ?? [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const levels = searchParams.get("levels");
  const levelSet = levels ? new Set(levels.split(",")) : null;

  function parseValidDateParam(value: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const validFromDate = parseValidDateParam(from);
  const validToDate = parseValidDateParam(to);

  // attempt MongoDB
  let dbAlerts: Record<string, unknown>[] = [];
  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection(COLLECTIONS.ALERTS);
    const filter: Record<string, unknown> = {};
    const dateFilter: Record<string, Date> = {};
    if (validFromDate) dateFilter.$gte = validFromDate;
    if (validToDate) dateFilter.$lte = validToDate;
    if (Object.keys(dateFilter).length) filter.dispatchedAt = dateFilter;
    if (levelSet) filter.threatLevel = { $in: [...levelSet] };
    dbAlerts = await col.find(filter).sort({ dispatchedAt: -1 }).limit(500).toArray();
  } catch (err) {
    console.error("DB unavailable fetching alerts history", err);
  }

  // if db has data, return it
  if (dbAlerts.length > 0) {
    return Response.json({ alerts: dbAlerts, total: dbAlerts.length, source: "db" });
  }

  // fall back to in-memory queue
  type FlatAlert = Record<string, unknown>;
  let queueAlerts: FlatAlert[] = getQueue()
    .map((q): FlatAlert => ({ ...q.alert, receivedAt: q.receivedAt }))
    .filter((a) => {
      if (typeof a["alertId"] !== "string") return false;
      if (typeof a["lat"] !== "number" || typeof a["lng"] !== "number") return false;
      const ts = (a["dispatchedAt"] ?? a["receivedAt"]) as string | undefined;
      const d = ts ? new Date(ts) : null;
      if (validFromDate && d && d < validFromDate) return false;
      if (validToDate && d && d > validToDate) return false;
      if (levelSet && typeof a["threatLevel"] === "string" && !levelSet.has(a["threatLevel"] as string)) return false;
      return true;
    })
    .reverse(); // queue is oldest-first; reverse for newest-first
  queueAlerts = queueAlerts.slice(0, 500);

  return Response.json({ alerts: queueAlerts, total: queueAlerts.length, source: "queue" });
}
