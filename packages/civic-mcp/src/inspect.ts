import { LocalHookClient, type CallToolRequestWithContext, type CallToolResult, type RequestExtra } from "@civic/hook-common";
import type { GuardrailResult } from "@rangerwatch/shared";
import { GuardrailHook } from "./hook.js";

let hookClient: LocalHookClient | null = null;

/**
 * Initialise the @civic/hook-common LocalHookClient backed by GuardrailHook.
 * Called once at server startup from index.ts.
 */
export async function initSdk(): Promise<void> {
  const hook = new GuardrailHook();
  hookClient = new LocalHookClient(hook);
  console.log(
    `[civic-mcp] @civic/hook-common LocalHookClient ready (hook: ${hook.name})`,
  );
}

// ---------------------------------------------------------------------------
// Public inspection entry point
// ---------------------------------------------------------------------------

/**
 * Run a guardrail inspection via the @civic/hook-common hook pipeline.
 *
 * @param payload  - The string to inspect.
 * @param toolName - Downstream tool name (e.g. "iucn:lookupSpecies").
 *                   Falls back to the endpoint name when not supplied by caller.
 * @param endpoint - Which HTTP endpoint was called, determining the hook
 *                   method used:
 *                     "inspect_input"  → processCallToolRequest  (input gate)
 *                     "inspect_output" → processCallToolResult   (output gate)
 */
export async function runInspection(
  payload: string,
  toolName: string | undefined,
  endpoint: "inspect_input" | "inspect_output",
): Promise<GuardrailResult> {
  const base: Omit<GuardrailResult, "blocked" | "reason"> = {
    input: payload,
    output: payload,
    toolName,
    timestamp: new Date(),
  };

  try {
    if (!hookClient) {
      throw new Error("hookClient not initialised — was initSdk() called?");
    }

    // Build a minimal MCP CallToolRequest so the hook can operate on it.
    const mcpRequest: CallToolRequestWithContext = {
      method: "tools/call",
      params: {
        name: toolName ?? endpoint,
        arguments: { payload },
      },
    };

    // requestId is required by RequestExtra; we generate a fresh one per call.
    const requestExtra: RequestExtra = { requestId: crypto.randomUUID() };

    if (endpoint === "inspect_input") {
      // ----------------------------------------------------------------
      // Input gate — processCallToolRequest
      // ----------------------------------------------------------------
      const result = await hookClient.processCallToolRequest(mcpRequest, requestExtra);

      // Zod 4 inference narrows resultType to "continue"|"continueAsync" only;
      // widen to string so the "respond" branch is reachable at runtime.
      const inputResultType = result.resultType as string;
      if (inputResultType === "respond") {
        const resp = (result as { response?: { content: unknown[]; isError?: boolean } }).response;
        const first = resp?.content[0] as { type?: string; text?: string } | undefined;
        const reason = first?.type === "text" && typeof first.text === "string" ? first.text : "blocked";
        return { ...base, blocked: true, reason };
      }

      return { ...base, blocked: false };
    } else {
      // ----------------------------------------------------------------
      // Output gate — processCallToolResult
      // ----------------------------------------------------------------
      const mcpResponse: CallToolResult = {
        content: [{ type: "text", text: payload }],
      };

      const result = await hookClient.processCallToolResult(
        mcpResponse,
        mcpRequest,
        requestExtra,
      );

      const outputResultType = result.resultType as string;
      if (outputResultType === "respond") {
        const resp = (result as { response?: { content: unknown[]; isError?: boolean } }).response;
        const first = resp?.content[0] as { type?: string; text?: string } | undefined;
        const reason = first?.type === "text" && typeof first.text === "string" ? first.text : "blocked";
        return { ...base, blocked: true, reason };
      }

      return { ...base, blocked: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[civic-mcp] inspection error — failing closed:", msg);
    return { ...base, blocked: true, reason: `guardrail-error: ${msg}` };
  }
}
