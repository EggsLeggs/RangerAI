import type { GuardrailResult } from "@rangerwatch/shared";
import { logEntry, getAuditLog } from "./audit.js";
import { runInspection } from "./inspect.js";

interface InspectRequestBody {
  payload: string;
  toolName?: string;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: { name: string; arguments: { payload: string } };
}

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

async function handleInspect(
  req: Request,
  endpoint: "inspect_input" | "inspect_output",
): Promise<Response> {
  const body = await parseBody<InspectRequestBody>(req);
  if (!body || typeof body.payload !== "string") {
    return new Response(JSON.stringify({ error: "invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result: GuardrailResult = await runInspection(
    body.payload,
    body.toolName ?? endpoint,
    endpoint,
  );
  logEntry(result);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleToolsCall(req: Request): Promise<Response> {
  const rpc = await parseBody<JsonRpcRequest>(req);
  if (!rpc || typeof rpc.params?.arguments?.payload !== "string") {
    return new Response(JSON.stringify({ error: "invalid JSON-RPC request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = rpc.params.arguments.payload;
  const toolName = rpc.params.name;
  // Derive the endpoint from the JSON-RPC tool name; default to inspect_input.
  const endpoint: "inspect_input" | "inspect_output" =
    toolName === "inspect_output" ? "inspect_output" : "inspect_input";

  const result: GuardrailResult = await runInspection(payload, toolName, endpoint);
  logEntry(result);

  if (result.blocked) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        error: { code: -32000, message: result.reason ?? "blocked", data: result },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export function startCivicMCP(port: number): void {
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname === "/inspect_input") {
        return handleInspect(req, "inspect_input" as const);
      }
      if (req.method === "POST" && url.pathname === "/inspect_output") {
        return handleInspect(req, "inspect_output" as const);
      }
      if (req.method === "POST" && url.pathname === "/tools/call") {
        return handleToolsCall(req);
      }
      if (req.method === "GET" && url.pathname === "/audit_log") {
        return new Response(JSON.stringify(getAuditLog()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  console.log(`[civic-mcp] server listening on port ${port}`);
}
