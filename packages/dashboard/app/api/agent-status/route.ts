export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONITOR_URL = process.env.MONITOR_URL ?? "http://localhost:4000/events";
const UPSTREAM_CONNECT_TIMEOUT_MS = 5_000;
const MAX_STREAM_DURATION_MS = 4.5 * 60 * 1000; // 4.5 min - close before Vercel's 5 min limit

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const ac = new AbortController();
      const connectTimeout = setTimeout(() => ac.abort(), UPSTREAM_CONNECT_TIMEOUT_MS);

      let upstream: Response;
      try {
        upstream = await fetch(MONITOR_URL, {
          headers: { Accept: "text/event-stream" },
          signal: ac.signal,
          // @ts-expect-error - node fetch supports this
          duplex: "half",
        });
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "unavailable" })}\n\n`)
        );
        controller.close();
        return;
      } finally {
        clearTimeout(connectTimeout);
      }

      if (!upstream.ok || !upstream.body) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "unavailable" })}\n\n`)
        );
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* closed */ }
      }, 25_000);

      const maxLifetime = setTimeout(() => {
        try {
          clearInterval(heartbeat);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "reconnect" })}\n\n`)
          );
          reader.cancel();
          controller.close();
        } catch { /* already closed */ }
      }, MAX_STREAM_DURATION_MS);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        /* upstream closed */
      } finally {
        clearInterval(heartbeat);
        clearTimeout(maxLifetime);
        reader.cancel();
        controller.close();
      }
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
