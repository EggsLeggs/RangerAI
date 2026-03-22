export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUEUE = 500;

type SseSender = (payload: unknown) => void;

function getSseClients(): Set<SseSender> {
  const g = globalThis as typeof globalThis & { __rangerAlertSseClients?: Set<SseSender> };
  if (!g.__rangerAlertSseClients) g.__rangerAlertSseClients = new Set();
  return g.__rangerAlertSseClients;
}

type Queued = { alert: unknown; receivedAt: string };

function getQueue(): Queued[] {
  const g = globalThis as typeof globalThis & { __rangerAlertQueue?: Queued[] };
  if (!g.__rangerAlertQueue) g.__rangerAlertQueue = [];
  return g.__rangerAlertQueue;
}

/** Matches @rangerai/shared ThreatLevel without importing package entry (Next bundle resolves civic-auth). */
const THREAT_LEVELS = new Set(["CRITICAL", "WARNING", "INFO", "NEEDS_REVIEW"]);

function isValidAlertBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return (
    typeof o.alertId === "string" &&
    typeof o.species === "string" &&
    typeof o.lat === "number" &&
    typeof o.lng === "number" &&
    typeof o.threatLevel === "string" &&
    THREAT_LEVELS.has(o.threatLevel)
  );
}

function broadcast(payload: unknown) {
  const clients = getSseClients();
  for (const send of clients) {
    try {
      send(payload);
    } catch {
      /* client disconnected */
    }
  }
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.DASHBOARD_ALERT_API_KEY?.trim();
  if (!secret) {
    return true;
  }
  const auth = req.headers.get("authorization");
  const apiKey = req.headers.get("x-api-key");
  const bearer =
    auth?.startsWith("Bearer ") || auth?.startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  return bearer === secret || apiKey === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isValidAlertBody(body)) {
    return Response.json({ error: "invalid alert payload" }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();
  const queue = getQueue();
  queue.push({ alert: body, receivedAt });
  if (queue.length > MAX_QUEUE) {
    queue.splice(0, queue.length - MAX_QUEUE);
  }

  broadcast({ type: "alert", alert: body });

  (async () => {
    try {
      const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
      const col = await getCollection(COLLECTIONS.ALERTS);
      await col.updateOne(
        { alertId: body.alertId },
        { $set: { ...body, receivedAt } },
        { upsert: true }
      );
    } catch { /* db write must not crash SSE */ }
  })();

  return Response.json({ ok: true, id: body.alertId });
}

const HEARTBEAT_MS = 30_000;
const MAX_STREAM_DURATION_MS = 4.5 * 60 * 1000; // 4.5 min - close before Vercel's 5 min limit

export async function GET() {
  const encoder = new TextEncoder();
  const clients = getSseClients();
  let sendRef: SseSender | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let maxLifetimeId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (heartbeatId !== null) { clearInterval(heartbeatId); heartbeatId = null; }
    if (maxLifetimeId !== null) { clearTimeout(maxLifetimeId); maxLifetimeId = null; }
    if (sendRef) { clients.delete(sendRef); sendRef = null; }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send: SseSender = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      sendRef = send;
      clients.add(send);
      send({ type: "connected", at: new Date().toISOString() });
      heartbeatId = setInterval(() => {
        send({ type: "heartbeat", at: new Date().toISOString() });
      }, HEARTBEAT_MS);

      maxLifetimeId = setTimeout(() => {
        try {
          send({ type: "reconnect" });
          cleanup();
          controller.close();
        } catch { /* already closed */ }
      }, MAX_STREAM_DURATION_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
