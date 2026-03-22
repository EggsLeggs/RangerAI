export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function monitorDbStatsUrl(): string {
  const base = process.env.MONITOR_URL ?? "http://localhost:4000/events";
  const u = new URL(base);
  u.pathname = "/db-stats";
  u.search = "";
  return u.toString();
}

const MONITOR_DB_STATS_TIMEOUT_MS = 5_000;

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MONITOR_DB_STATS_TIMEOUT_MS);
  try {
    const res = await fetch(monitorDbStatsUrl(), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      return Response.json(
        { error: `monitor returned ${res.status}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as Record<string, number>;
    return Response.json(data);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return Response.json({ error: "monitor db-stats request timed out" }, { status: 504 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
