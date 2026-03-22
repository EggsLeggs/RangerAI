export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUEUE = 500;

// ── zone helpers ────────────────────────────────────────────────────────────

function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return "ZN-" + String(n).padStart(2, "0");
}

function getZoneNameCache(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __rangerZoneNameCache?: Map<string, string> };
  if (!g.__rangerZoneNameCache) g.__rangerZoneNameCache = new Map();
  return g.__rangerZoneNameCache;
}

interface NominatimAddress {
  national_park?: string;
  nature_reserve?: string;
  protected_area?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RangerAI/1.0 wildlife-monitoring" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { address?: NominatimAddress };
    const a = data.address;
    if (!a) return null;
    const place =
      a.national_park ?? a.nature_reserve ?? a.protected_area ??
      a.village ?? a.town ?? a.city ?? a.county ?? a.state;
    if (place && a.country) return `${place}, ${a.country}`;
    if (a.country) return a.country;
    return null;
  } catch {
    return null;
  }
}

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
      const lat = body["lat"] as number;
      const lng = body["lng"] as number;
      const zoneId = zoneIdFromCoords(lat, lng);

      const cache = getZoneNameCache();
      if (!cache.has(zoneId)) {
        const name = await reverseGeocode(lat, lng);
        if (name) cache.set(zoneId, name);
      }
      const zoneName = cache.get(zoneId);

      const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
      const col = await getCollection(COLLECTIONS.ALERTS);
      const dispatchedAtRaw = (body as Record<string, unknown>).dispatchedAt;
      const dispatchedAt =
        dispatchedAtRaw instanceof Date
          ? dispatchedAtRaw
          : typeof dispatchedAtRaw === "string"
            ? new Date(dispatchedAtRaw)
            : new Date();
      const doc: Record<string, unknown> = {
        ...body,
        dispatchedAt,
        receivedAt: new Date(receivedAt),
        zoneId,
      };
      if (zoneName) doc["zoneName"] = zoneName;
      await col.updateOne(
        { alertId: body.alertId },
        { $set: doc },
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
