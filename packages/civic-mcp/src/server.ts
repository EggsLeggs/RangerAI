import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { inspectPayloadForInjection } from "./injection.js";
import type { GuardrailResult } from "@rangerwatch/shared";

type AuditToolName = "inspect_input" | "inspect_output";
type AuditEntry = { tool: AuditToolName; blocked: boolean; timestamp: Date };

const sessionAudit: AuditEntry[] = [];

export function audit_log(): {
  calls: number;
  blocks: number;
  entries: AuditEntry[];
} {
  const calls = sessionAudit.length;
  const blocks = sessionAudit.reduce((acc, e) => acc + (e.blocked ? 1 : 0), 0);
  return { calls, blocks, entries: [...sessionAudit] };
}

class BodyTooLargeError extends Error {
  public statusCode: number = 413;
}

function readBody(req: IncomingMessage, maxSizeBytes = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    };

    const onData = (c: unknown) => {
      const buf = c as Buffer;
      total += buf.length;
      if (total > maxSizeBytes) {
        cleanup();
        req.destroy();
        reject(
          new BodyTooLargeError(`request body too large (max ${maxSizeBytes} bytes)`)
        );
        return;
      }
      chunks.push(buf);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    };

    const onError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function handleInspectInputArgs(args: unknown): { blocked: boolean } {
  if (args === null || typeof args !== "object") {
    return inspectPayloadForInjection("");
  }
  if (Array.isArray(args)) {
    return inspectPayloadForInjection(JSON.stringify(args));
  }
  const rec = args as Record<string, unknown>;
  const payload = rec.payload;
  const text =
    typeof payload === "string"
      ? payload
      : payload === undefined
        ? ""
        : JSON.stringify(payload);
  return inspectPayloadForInjection(text);
}

/** JSON-RPC style POST used by alert-agent and threat-agent. */
function handleToolsCall(body: unknown): { jsonrpc: string; id: unknown; result?: unknown; error?: unknown } {
  const id =
    body !== null && typeof body === "object" && "id" in body ? (body as { id: unknown }).id : null;
  const base = { jsonrpc: "2.0" as const, id };

  if (body === null || typeof body !== "object") {
    return { ...base, error: { code: -32600, message: "invalid request body" } };
  }

  const method = (body as { method?: string }).method;
  const params = (body as { params?: unknown }).params;

  if (method !== "tools/call") {
    return { ...base, error: { code: -32601, message: "method not found" } };
  }

  if (params === null || typeof params !== "object") {
    return { ...base, error: { code: -32602, message: "invalid params" } };
  }

  const name = (params as { name?: string }).name;

  if (name === "inspect_input") {
    const args = (params as { arguments?: unknown }).arguments;
    const { blocked } = handleInspectInputArgs(args);
    sessionAudit.push({ tool: "inspect_input", blocked, timestamp: new Date() });
    return { ...base, result: { blocked } };
  }

  if (name === "inspect_output") {
    const args = (params as { arguments?: unknown }).arguments;
    const result = handleInspectOutputBody(args);
    return { ...base, result };
  }

  if (name === "audit_log") {
    return { ...base, result: audit_log() };
  }

  return { ...base, error: { code: -32601, message: `unknown tool: ${String(name)}` } };
}

function handleInspectOutputBody(body: unknown): GuardrailResult {
  const timestamp = new Date();
  let input = "";
  if (body !== null && typeof body === "object" && "payload" in body) {
    const p = (body as { payload?: unknown }).payload;
    input = typeof p === "string" ? p : JSON.stringify(p ?? "");
  }
  const { blocked } = inspectPayloadForInjection(input);
  sessionAudit.push({ tool: "inspect_output", blocked, timestamp });
  return {
    input,
    output: input,
    blocked,
    reason: blocked ? "prompt injection pattern detected in vision output" : undefined,
    toolName: "inspect_output",
    timestamp,
  };
}

export function startCivicMcpServer(port: number): ReturnType<typeof createServer> {
  sessionAudit.length = 0;
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    const url = req.url ?? "";

    try {
      const raw = await readBody(req);
      let parsed: unknown;
      try {
        parsed = raw ? (JSON.parse(raw) as unknown) : {};
      } catch {
        sendJson(res, 400, { error: "invalid JSON" });
        return;
      }

      if (url === "/tools/call" || url.startsWith("/tools/call?")) {
        const out = handleToolsCall(parsed);
        sendJson(res, 200, out);
        return;
      }

      if (url === "/inspect_output" || url.startsWith("/inspect_output?")) {
        const result = handleInspectOutputBody(parsed);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[civic-mcp] request error:", message);
      const status = err instanceof BodyTooLargeError ? 413 : 500;
      sendJson(res, status, { error: status === 413 ? message : "internal error" });
    }
  });

  server.listen(port, () => {
    console.log(
      `[civic-mcp] listening on http://localhost:${port} (tools: inspect_input/audit_log; inspect_output: POST /inspect_output)`
    );
  });

  return server;
}
