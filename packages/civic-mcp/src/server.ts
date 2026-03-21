import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { inspectPayloadForInjection } from "./injection.js";
import type { GuardrailResult } from "@rangerwatch/shared";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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
  if (name !== "inspect_input") {
    return { ...base, error: { code: -32601, message: `unknown tool: ${String(name)}` } };
  }

  const args = (params as { arguments?: unknown }).arguments;
  const { blocked } = handleInspectInputArgs(args);
  return { ...base, result: { blocked } };
}

function handleInspectOutputBody(body: unknown): GuardrailResult {
  const timestamp = new Date();
  let input = "";
  if (body !== null && typeof body === "object" && "payload" in body) {
    const p = (body as { payload?: unknown }).payload;
    input = typeof p === "string" ? p : JSON.stringify(p ?? "");
  }
  const { blocked } = inspectPayloadForInjection(input);
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
      sendJson(res, 500, { error: "internal error" });
    }
  });

  server.listen(port, () => {
    console.log(`[civic-mcp] listening on http://localhost:${port} (inspect_input: POST /tools/call)`);
  });

  return server;
}
