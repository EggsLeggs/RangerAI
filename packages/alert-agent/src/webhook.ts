import { randomUUID } from "node:crypto";
import { env } from "@rangerwatch/shared/env";
import type { Alert } from "@rangerwatch/shared";
import { alertEvents, ALERT_DISPATCHED } from "./events.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 5000;
const CIVIC_TIMEOUT_MS = 3000;

function getMcpPort(): number {
  const raw = process.env.MCP_PORT?.trim();
  if (!raw) return 3001;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : 3001;
}

/** Returns true when the payload must be rejected (blocked by Civic). */
async function inspectAlertPayload(alert: Alert): Promise<boolean> {
  const observerNotes = alert.observerNotes ?? "";
  const payload = `species:${alert.species} notes:${observerNotes}`;
  try {
    const response = await fetch(`http://localhost:${getMcpPort()}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "inspect_input",
          arguments: { payload },
        },
      }),
      signal: AbortSignal.timeout(CIVIC_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { result?: { blocked?: boolean } };
    return result.result?.blocked === true;
  } catch {
    console.warn("[alert-agent] civic-mcp inspect_input unavailable; proceeding without guardrail");
    return false;
  }
}

export async function dispatchWebhook(alert: Alert): Promise<boolean> {
  const url = env.WEBHOOK_URL;
  if (!url) {
    console.warn("[alert-agent] WEBHOOK_URL is not configured — skipping dispatch");
    return false;
  }

  const blocked = await inspectAlertPayload(alert);
  if (blocked) {
    console.warn(`[alert-agent] civic inspect_input blocked dispatch for alert ${alert.alertId}`);
    return false;
  }

  const idempotencyKey = randomUUID();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[alert-agent] webhook attempt ${attempt} — idempotency-key ${idempotencyKey}`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(alert),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      console.log(`[alert-agent] webhook attempt ${attempt} — status ${res.status}`);

      if (res.ok) {
        alertEvents.emit(ALERT_DISPATCHED, {
          type: ALERT_DISPATCHED,
          payload: { alert, method: "webhook" },
          timestamp: new Date(),
        });
        return true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[alert-agent] webhook attempt ${attempt} — error: ${message}`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.warn(`[alert-agent] webhook dispatch failed after ${MAX_RETRIES} attempts — alert ${alert.alertId} not delivered`);
  return false;
}
