export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Queued = { alert: Record<string, unknown>; receivedAt: string };

function getQueue(): Queued[] {
  const g = globalThis as typeof globalThis & { __rangerAlertQueue?: Queued[] };
  return g.__rangerAlertQueue ?? [];
}

const UTC_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function parseTabToDays(tab: string): number {
  switch (tab) {
    case "7 Days": return 7;
    case "30 Days": return 30;
    case "90 Days": return 90;
    default: return 7;
  }
}

function computeFrequency(alerts: Record<string, unknown>[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const daySpeciesMap = new Map<string, number>();
  const speciesTotals = new Map<string, number>();

  for (const alert of alerts) {
    const species = typeof alert["species"] === "string" ? (alert["species"] as string) : null;
    if (!species) continue;

    const raw = alert["dispatchedAt"] ?? alert["receivedAt"];
    const d = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : null;
    if (!d || isNaN(d.getTime()) || d.getTime() < since) continue;

    const dayKey = UTC_DAY_FMT.format(d);
    const key = `${dayKey}:${species}`;
    daySpeciesMap.set(key, (daySpeciesMap.get(key) ?? 0) + 1);
    speciesTotals.set(species, (speciesTotals.get(species) ?? 0) + 1);
  }

  const topSpecies = [...speciesTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  const series: Array<Record<string, number | string>> = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const dayKey = UTC_DAY_FMT.format(d);
    const entry: Record<string, number | string> = { day: dayKey };
    for (const s of topSpecies) {
      entry[s] = daySpeciesMap.get(`${dayKey}:${s}`) ?? 0;
    }
    return entry;
  });

  return { series, species: topSpecies };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "7 Days";
  const days = parseTabToDays(tab);

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
      return Response.json(computeFrequency(alerts as unknown as Record<string, unknown>[], days));
    }
  } catch {
    // fall through to queue
  }

  // fall back to in-memory queue
  const queueAlerts = getQueue().map((q) => ({ ...q.alert, receivedAt: q.receivedAt }));
  return Response.json(computeFrequency(queueAlerts, days));
}
