export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function monitorDbStatsUrl(): string {
  const base = process.env.MONITOR_URL ?? "http://localhost:4000/events";
  const u = new URL(base);
  u.pathname = "/db-stats";
  u.search = "";
  return u.toString();
}

export async function GET() {
  try {
    const res = await fetch(monitorDbStatsUrl(), { cache: "no-store" });
    if (!res.ok) {
      return Response.json(
        { error: `monitor returned ${res.status}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as Record<string, number>;
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
