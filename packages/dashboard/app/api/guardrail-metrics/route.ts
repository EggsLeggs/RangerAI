export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditPayload = {
  total?: number;
  blocked?: number;
  entries?: { blocked?: boolean; reason?: string }[];
};

const FETCH_TIMEOUT_MS = 5_000;

function auditLogUrl(): string {
  const monitorUrl = process.env.MONITOR_URL;
  if (monitorUrl) {
    const u = new URL(monitorUrl);
    u.pathname = "/audit_log";
    u.search = "";
    return u.toString();
  }
  const port = process.env.MCP_PORT?.trim() || "3001";
  return `http://127.0.0.1:${port}/audit_log`;
}

export async function GET() {
  try {
    const res = await fetch(auditLogUrl(), {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return Response.json(
        { totalCalls: 0, injectionsBlocked: 0, errors: 0, unavailable: true },
        { status: 200 },
      );
    }
    const data = (await res.json()) as AuditPayload;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const errors = entries.filter(
      (e) => typeof e.reason === "string" && e.reason.startsWith("guardrail-error:"),
    ).length;
    const injectionsBlocked = entries.filter(
      (e) =>
        e.blocked === true &&
        !(typeof e.reason === "string" && e.reason.startsWith("guardrail-error:")),
    ).length;
    const totalCalls = typeof data.total === "number" ? data.total : entries.length;

    return Response.json({
      totalCalls,
      injectionsBlocked,
      errors,
      unavailable: false,
    });
  } catch {
    return Response.json(
      { totalCalls: 0, injectionsBlocked: 0, errors: 0, unavailable: true },
      { status: 200 },
    );
  }
}
