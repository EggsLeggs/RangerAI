# civic-mcp

Local MCP server exposing Civic guardrail tools to the RangerWatch agent pipeline.

Agents call this server via the MCP protocol (HTTP + JSON-RPC 2.0) before every
external API call and before every downstream handoff.  The server sits between
agents, not beside them, so guardrails are auditable and independently replaceable.

---

## How the hook framework is used

Guardrail logic is implemented as a **Civic `AbstractHook` subclass** — the
`GuardrailHook` in `src/hook.ts`.  The hook framework is provided by
`@civic/hook-common`; RangerWatch supplies the inspection rules inside it.

### @civic/hook-common exports used

| Export | Where used | Purpose |
|---|---|---|
| `AbstractHook` | `src/hook.ts` | Base class for `GuardrailHook` |
| `LocalHookClient` | `src/inspect.ts` | In-process hook runner; wraps `GuardrailHook` |
| `CallToolRequestWithContext` | `src/hook.ts`, `src/inspect.ts` | Type for the MCP `tools/call` request object |
| `CallToolResult` | `src/hook.ts`, `src/inspect.ts` | Type for the MCP tool result object |
| `CallToolRequestHookResult` | `src/hook.ts` | Return type of `processCallToolRequest` |
| `CallToolResponseHookResult` | `src/hook.ts` | Return type of `processCallToolResult` |
| `RequestExtra` | `src/hook.ts`, `src/inspect.ts` | Per-call metadata (requestId, sessionId, authInfo) |

### Lifecycle

```text
Agent                    civic-mcp server             GuardrailHook
  │                            │                            │
  │── POST /inspect_input ────►│                            │
  │                            │── processCallToolRequest ─►│
  │                            │                            │  size check
  │                            │                            │  injection patterns
  │                            │◄── { resultType } ─────────│
  │◄── GuardrailResult ────────│                            │
  │                            │                            │
  │── POST /inspect_output ───►│                            │
  │                            │── processCallToolResult ──►│
  │                            │                            │  injection patterns
  │                            │                            │  PII (email, phone)
  │                            │◄── { resultType } ─────────│
  │◄── GuardrailResult ────────│                            │
```

`processCallToolRequest` is the **input gate** — called before an agent passes
data to an external API.  Checks injection patterns and payload size only.

`processCallToolResult` is the **output gate** — called before a result passes
downstream to the next agent.  Checks injection patterns, payload size, and PII
(email addresses, phone numbers).

Hook results use the `@civic/hook-common` discriminated union:

- `{ resultType: "continue", request/response }` — payload is clean, pass through.
- `{ resultType: "respond", response: { isError: true, content: [...reason] } }` —
  payload is blocked; `runInspection` maps this to `GuardrailResult.blocked = true`.

### Endpoints

| Endpoint | Hook method | Inspection |
|---|---|---|
| `POST /inspect_input` | `processCallToolRequest` | injection + size |
| `POST /inspect_output` | `processCallToolResult` | injection + size + PII |
| `POST /tools/call` | derived from `params.name` | same routing as above |
| `GET /audit_log` | — | returns session audit from `src/audit.ts` |

---

## OAuth 2 scope design

This section documents the **intended** access-control model for the Civic
challenge brief.  Scopes are not yet enforced (see TODO below) but the design
is production-ready to implement.

### Scope definitions

| Scope | Holder | Permitted endpoints |
|---|---|---|
| `civic:inspect_input` | ingest-agent, threat-agent | `POST /inspect_input` |
| `civic:inspect_output` | vision-agent | `POST /inspect_output` |
| `civic:inspect_all` | alert-agent | `POST /inspect_input`, `POST /inspect_output` |
| `civic:audit_read` | dashboard, ops tooling | `GET /audit_log` |

### Rationale

- The **ingest agent** only submits raw observation payloads before polling — it
  never reads model outputs, so it gets `inspect_input` only.
- The **vision agent** submits GPT-4o outputs for PII and injection screening
  before passing classifications downstream — `inspect_output` only.
- The **threat agent** checks IUCN API inputs for injection before each external
  call — `inspect_input` only.
- The **alert agent** screens both incoming scored sightings and outgoing alert
  bodies — `inspect_all`.
- The **dashboard** reads audit counters for the guardrail strip UI —
  `audit_read` only, no write access.

This scope model means a compromised ingest-agent token cannot read audit logs
or clear the output inspection path.

---

## TODO — full OAuth 2 enforcement with @civic/auth-mcp

`@civic/auth-mcp` is Civic's Express middleware for OAuth 2 / OIDC token
verification on MCP servers.  Adding it to civic-mcp would enforce the scope
model above at the HTTP layer.

Steps to implement post-hackathon:

1. **Switch transport to Express** — `Bun.serve()` does not support Express
   middleware.  Replace with `express()` + `@civic/auth-mcp`'s `auth()` middleware.

2. **Register a Civic Auth client** — obtain a `clientId` at
   [auth.civic.com](https://auth.civic.com) and configure it in `.env` as
   `CIVIC_CLIENT_ID`.

3. **Apply middleware**:
   ```typescript
   import { auth } from "@civic/auth-mcp";
   import express from "express";

   const app = express();
   app.use(await auth({ clientId: process.env.CIVIC_CLIENT_ID }));
   // existing route handlers unchanged
   ```

4. **Verify scopes per route** — in each route handler, check
   `req.auth.scopes.includes("civic:inspect_input")` etc. before calling
   `runInspection`.

5. **Issue tokens to agents** — each agent process receives a scoped JWT from
   Civic Auth at startup and includes it as `Authorization: Bearer <token>` on
   every request to civic-mcp.

Until this is wired, the server is protected only by network isolation
(localhost-only binding) and the audit log captures all calls for post-hoc
review.
