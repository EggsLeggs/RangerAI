import {
  AbstractHook,
  type CallToolRequestWithContext,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
  type CallToolResult,
  type RequestExtra,
} from "@civic/hook-common";

/**
 * Injection patterns that indicate prompt injection attempts.
 * Used in both request and response inspection paths.
 */
const INJECTION_PATTERNS: readonly string[] = [
  "ignore previous instructions",
  "disregard your system prompt",
  "you are now",
  "act as",
  "forget your instructions",
  "new persona",
  "system:",
  "<|im_start|>",
  "[[inject]]",
  "\n\nhuman:",
  "\n\nassistant:",
];

// Matches email addresses (e.g. ranger.john@wildlife.org)
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Matches phone numbers with + prefix or parenthesised area code.
// Requires explicit + or () to avoid false-positives on ISO date strings
// (e.g. 2026-03-21T05:20:33Z must NOT match).
const PHONE_RE = /(\+\d[\d\s().-]{7,}\d|\(\d{2,4}\)[\d\s-]{5,}\d)/;

const MAX_BYTES = 100 * 1024; // 100 KB

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function checkInjectionAndSize(payload: string): { blocked: boolean; reason?: string } {
  if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
    return { blocked: true, reason: "payload exceeds 100KB size limit" };
  }
  const lower = payload.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return { blocked: true, reason: `injection pattern detected: "${pattern}"` };
    }
  }
  return { blocked: false };
}

function checkPII(payload: string): { blocked: boolean; reason?: string } {
  if (EMAIL_RE.test(payload)) {
    return { blocked: true, reason: "PII detected: email address in output" };
  }
  if (PHONE_RE.test(payload)) {
    return { blocked: true, reason: "PII detected: phone number in output" };
  }
  return { blocked: false };
}

function blockedCallToolResult(reason: string): CallToolResult {
  return {
    content: [{ type: "text", text: reason }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// GuardrailHook
// ---------------------------------------------------------------------------

/**
 * RangerAI guardrail hook built on @civic/hook-common's AbstractHook.
 *
 * Civic provides the MCP hook framework - the middleware contract,
 * request/response lifecycle, and LocalHookClient wiring.
 * RangerAI provides the inspection rules inside the hook methods.
 *
 * processCallToolRequest - input gate (injection + size)
 * processCallToolResult - output gate (injection + size + PII)
 *
 * A `resultType: "respond"` with `isError: true` signals a blocked payload.
 * A `resultType: "continue"` passes the payload downstream unchanged.
 */
export class GuardrailHook extends AbstractHook {
  override get name(): string {
    return "rangerai-guardrail";
  }

  /**
   * Inspect an incoming tool-call payload before it is processed.
   * Checks: injection patterns, size limit.
   */
  override async processCallToolRequest(
    request: CallToolRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    const raw = request.params.arguments?.["payload"];
    if (typeof raw !== "string") {
      // No payload argument - nothing to inspect, pass through.
      return { resultType: "continue", request };
    }

    const check = checkInjectionAndSize(raw);
    if (check.blocked) {
      // Zod 4 discriminated union inference does not widen CallToolRequestHookResult
      // to include the "respond" variant even though the schema declares it.
      // Cast required to work around the inference limitation at compile time;
      // runtime behaviour is correct.
      return {
        resultType: "respond",
        response: blockedCallToolResult(check.reason ?? "blocked"),
      } as unknown as CallToolRequestHookResult;
    }

    return { resultType: "continue", request };
  }

  /**
   * Inspect an outgoing tool-call result before it passes downstream.
   * Checks: injection patterns, size limit, PII (email, phone).
   */
  override async processCallToolResult(
    response: CallToolResult,
    _originalRequest: CallToolRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    // Extract the first text content item as the inspectable payload.
    const first = response.content[0];
    const payload = first !== undefined && first.type === "text" ? first.text : null;

    if (payload === null) {
      // Non-text content - nothing to inspect textually, pass through.
      return { resultType: "continue", response };
    }

    const injectionCheck = checkInjectionAndSize(payload);
    if (injectionCheck.blocked) {
      // Same Zod 4 inference cast as in processCallToolRequest above.
      return {
        resultType: "respond",
        response: blockedCallToolResult(injectionCheck.reason ?? "blocked"),
      } as unknown as CallToolResponseHookResult;
    }

    const piiCheck = checkPII(payload);
    if (piiCheck.blocked) {
      return {
        resultType: "respond",
        response: blockedCallToolResult(piiCheck.reason ?? "blocked"),
      } as unknown as CallToolResponseHookResult;
    }

    return { resultType: "continue", response };
  }
}
