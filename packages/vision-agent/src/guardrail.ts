import type { ClassifiedSighting, GuardrailResult } from "@rangerai/shared";
import { buildCivicHeaders } from "@rangerai/shared";
import { readMcpPort } from "@rangerai/shared/mcp-port";
import { z } from "zod";

const CIVIC_TIMEOUT_MS = 3000;
const TOOL_NAME = "inspect_output";
const mcpPort = readMcpPort();

const GuardrailResultSchema = z.object({
  input: z.string(),
  output: z.string(),
  blocked: z.boolean(),
  reason: z.string().optional(),
  toolName: z.string().optional(),
  timestamp: z.coerce.date(),
});

function truncateBody(text: string, max = 500): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function inspectOutput(
  classified: ClassifiedSighting
): Promise<GuardrailResult> {
  const payload = JSON.stringify(classified);
  const timestamp = new Date();

  try {
    const response = await fetch(
      `http://localhost:${mcpPort}/${TOOL_NAME}`,
      {
        method: "POST",
        headers: await buildCivicHeaders(),
        body: JSON.stringify({ payload }),
        signal: AbortSignal.timeout(CIVIC_TIMEOUT_MS),
      }
    );

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${truncateBody(bodyText)}`
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText) as unknown;
    } catch {
      throw new Error(`invalid JSON body: ${truncateBody(bodyText, 200)}`);
    }

    const parsed = GuardrailResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `guardrail response shape invalid: ${parsed.error.message}`
      );
    }

    const result = parsed.data;

    if (result.blocked) {
      console.warn(
        `[vision-agent] civic guardrail blocked sighting ${classified.id}: ${result.reason ?? "no reason given"}`
      );
    }

    return result;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(
      `[vision-agent] civic-mcp unavailable for sighting ${classified.id} (${detail}); proceeding without guardrail`
    );
    // Intentional fail-open: civic-mcp unavailability must not block the
    // vision pipeline. blocked: false lets the classification pass downstream;
    // the reason field records the failure for audit purposes.
    return {
      input: payload,
      output: "",
      blocked: false,
      reason: `civic-mcp unavailable: ${truncateBody(detail, 400)}`,
      toolName: TOOL_NAME,
      timestamp,
    };
  }
}
