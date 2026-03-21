import { createRemoteJWKSet, jwtVerify } from "jose";
import type { GuardrailResult } from "@rangerai/shared";
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

// ---------------------------------------------------------------------------
// Civic Auth - JWT verification via hosted JWKS
// ---------------------------------------------------------------------------

const CIVIC_JWKS_URL = "https://auth.civic.com/oauth/jwks";
const CIVIC_ISSUER = "https://auth.civic.com/oauth/";

// Lazily created - only initialised when CIVIC_CLIENT_ID is present.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(CIVIC_JWKS_URL));
  }
  return jwks;
}

async function verifyBearerToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  try {
    await jwtVerify(token, getJwks(), { issuer: CIVIC_ISSUER });
    return true;
  } catch {
    return false;
  }
}

function authEnabled(): boolean {
  return Boolean(process.env.CIVIC_CLIENT_ID?.trim());
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function startCivicMCP(port: number): void {
  const authActive = authEnabled();

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // OAuth 2.0 Protected Resource Metadata (RFC 9728)
      if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
        const metadata = {
          resource: `http://localhost:${port}`,
          authorization_servers: [CIVIC_ISSUER],
          scopes_supported: ["openid"],
          bearer_methods_supported: ["header"],
        };
        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Bearer token validation - enforced when CIVIC_CLIENT_ID is configured.
      if (authActive) {
        const valid = await verifyBearerToken(req.headers.get("Authorization"));
        if (!valid) return unauthorizedResponse();
      }

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

  console.log(
    `[civic-mcp] server listening on port ${port}${authActive ? " (Civic Auth enabled)" : " (no auth - set CIVIC_CLIENT_ID to enable)"}`
  );
}
