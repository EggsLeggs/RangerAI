import type { GuardrailResult } from "@rangerwatch/shared";
import { buildCivicHeaders } from "@rangerwatch/shared";

const CIVIC_TIMEOUT_MS = 3000;
const GUARDED_FETCH_TIMEOUT_MS = 10_000;

function getMcpPort(): number {
  const raw = process.env.MCP_PORT?.trim();
  if (!raw) return 3001;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : 3001;
}

export async function inspectInput(
  payload: string,
  toolName: string
): Promise<GuardrailResult> {
  try {
    const response = await fetch(`http://localhost:${getMcpPort()}/inspect_input`, {
      method: "POST",
      headers: await buildCivicHeaders(),
      body: JSON.stringify({ payload, toolName }),
      signal: AbortSignal.timeout(CIVIC_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        input: payload,
        output: payload,
        blocked: false,
        reason: `civic-mcp returned ${response.status}`,
        toolName,
        timestamp: new Date(),
      };
    }
    const result = (await response.json()) as GuardrailResult;
    // timestamp arrives as a string from JSON - convert to Date for type safety
    result.timestamp = new Date((result.timestamp as unknown) as string);
    if (result.blocked) {
      console.warn(
        `[threat-agent] civic inspect_input blocked toolName=${toolName} reason=${result.reason ?? "unspecified"}`
      );
    }
    return result;
  } catch (err) {
    console.warn(
      `[threat-agent] civic-mcp check failed (toolName=${toolName}):`,
      err instanceof Error ? err.message : err
    );
    return {
      input: payload,
      output: payload,
      blocked: false,
      reason: "civic-mcp unavailable",
      toolName,
      timestamp: new Date(),
    };
  }
}

/** Serialize a request body to a string for guardrail inspection. */
function serializeBody(body: BodyInit | null | undefined): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value, key) => {
      const v = value instanceof File ? `[File: ${value.name}]` : String(value);
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    });
    return parts.join("&");
  }
  if (body instanceof ArrayBuffer) return `[binary: ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[binary: ${body.byteLength} bytes]`;
  if (body instanceof Blob) return `[Blob: ${body.size} bytes type=${body.type || "unknown"}]`;
  return "[non-serializable body]";
}

export async function guardedFetch(
  url: string,
  toolName: string,
  options?: RequestInit
): Promise<Response | null> {
  // Inspect the full outbound request context, not just the URL, so the
  // guardrail can detect injection patterns in method, headers, or body.
  const bodyText = serializeBody(options?.body);

  const requestPayload = JSON.stringify({
    url,
    method: options?.method ?? "GET",
    headers: Object.fromEntries(new Headers(options?.headers ?? {}).entries()),
    ...(bodyText !== undefined ? { body: bodyText } : {}),
  });

  const guardrail = await inspectInput(requestPayload, toolName);
  if (guardrail.blocked) {
    // Strip query string before logging to avoid leaking sensitive params.
    const sanitizedUrl = (() => {
      try { const u = new URL(url); return u.origin + u.pathname; } catch { return url.split("?")[0].split("#")[0]; }
    })();
    console.warn(
      `[threat-agent] guardedFetch blocked url=${sanitizedUrl} toolName=${toolName} reason=${guardrail.reason ?? "unspecified"}`
    );
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GUARDED_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(
      isAbort
        ? `[threat-agent] guardedFetch timed out (toolName=${toolName})`
        : `[threat-agent] guardedFetch network error (toolName=${toolName}):`,
      isAbort ? undefined : err instanceof Error ? err.message : err
    );
    return null;
  }
}
