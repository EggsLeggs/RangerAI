import { randomUUID } from "node:crypto";
import { env } from "@rangerai/shared/env";
import { buildCivicHeaders } from "@rangerai/shared";
import type { AlertBoth, AlertWebhook } from "@rangerai/shared";
import { alertEvents, ALERT_DISPATCHED } from "./events.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 5000;
const CIVIC_TIMEOUT_MS = 3000;

/** Returns true when the payload must be rejected (blocked by Civic). */
async function inspectAlertPayload(alert: AlertWebhook | AlertBoth): Promise<boolean> {
  const observerNotes = alert.observerNotes ?? "";
  const payload = `species:${alert.species} notes:${observerNotes}`;
  try {
    const response = await fetch(`http://localhost:${env.MCP_PORT}/inspect_input`, {
      method: "POST",
      headers: await buildCivicHeaders(),
      body: JSON.stringify({ payload, toolName: "alert:dispatch" }),
      signal: AbortSignal.timeout(CIVIC_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { blocked?: boolean };
    return result.blocked === true;
  } catch {
    console.warn("[alert-agent] civic-mcp inspect_input unavailable; proceeding without guardrail");
    return false;
  }
}

export async function dispatchWebhook(alert: AlertWebhook | AlertBoth): Promise<boolean> {
  const url = env.WEBHOOK_URL;
  if (!url) {
    console.warn("[alert-agent] WEBHOOK_URL is not configured - skipping dispatch");
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
      console.log(`[alert-agent] webhook attempt ${attempt} - idempotency-key ${idempotencyKey}`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(alert),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      console.log(`[alert-agent] webhook attempt ${attempt} - status ${res.status}`);

      if (res.ok) {
        try {
          alertEvents.emit(ALERT_DISPATCHED, {
            type: ALERT_DISPATCHED,
            payload: { alert, method: "webhook" },
            timestamp: new Date(),
          });
        } catch (emitErr) {
          const msg = emitErr instanceof Error ? emitErr.message : String(emitErr);
          console.error(
            `[alert-agent] ALERT_DISPATCHED listener error (webhook already succeeded): ${msg}`
          );
        }
        return true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[alert-agent] webhook attempt ${attempt} - error: ${message}`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.warn(`[alert-agent] webhook dispatch failed after ${MAX_RETRIES} attempts - alert ${alert.alertId} not delivered`);
  return false;
}
