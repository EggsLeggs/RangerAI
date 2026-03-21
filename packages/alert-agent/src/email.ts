import { Resend } from "resend";
import { type Alert, ThreatLevel, isAlertBoth, isAlertSms } from "@rangerai/shared";
import { env } from "@rangerai/shared/env";
import { buildCivicHeaders } from "@rangerai/shared";
import { ALERT_DISPATCHED, alertEvents } from "./events.js";

const CIVIC_TIMEOUT_MS = 3000;

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns true when the payload must be rejected (blocked by Civic). */
async function inspectEmailPayload(alert: Alert): Promise<boolean> {
  const observerNotes = alert.observerNotes ?? "";
  const payload = `species:${alert.species} notes:${observerNotes}`;
  try {
    const response = await fetch(`http://localhost:${env.MCP_PORT}/inspect_input`, {
      method: "POST",
      headers: await buildCivicHeaders(),
      body: JSON.stringify({ payload, toolName: "alert:email" }),
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

function buildHtml(alert: Alert): string {
  const action =
    alert.threatLevel === ThreatLevel.CRITICAL
      ? "Dispatch ranger unit immediately"
      : "Review required";

  const species = escHtml(alert.species);
  const iucnStatus = escHtml(alert.iucnStatus);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CRITICAL ALERT — RangerAI</title>
</head>
<body style="margin:0;padding:0;background:#0d1f16;font-family:Arial,sans-serif;color:#e8f0eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;">
    <tr>
      <td style="background:#1a3a2a;border-radius:8px;padding:32px;">

        <!-- header -->
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#7aab8a;text-transform:uppercase;">RangerAI · Wildlife Monitoring</p>
        <h1 style="margin:0 0 24px;font-size:24px;color:#e8f0eb;">
          <span style="background:#c85a3a;color:#fff;border-radius:4px;padding:2px 10px;font-size:13px;vertical-align:middle;margin-right:10px;">CRITICAL</span>
          ${species}
        </h1>

        <!-- IUCN status -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:12px;background:#0d1f16;border-radius:6px;border-left:3px solid #c85a3a;">
              <p style="margin:0 0 4px;font-size:11px;color:#7aab8a;text-transform:uppercase;letter-spacing:1px;">IUCN Status</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#e8f0eb;">${iucnStatus}</p>
            </td>
          </tr>
        </table>

        <!-- details grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:separate;border-spacing:0 8px;">
          <tr>
            <td width="50%" style="padding:10px 12px;background:#0d1f16;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:10px;color:#7aab8a;text-transform:uppercase;letter-spacing:1px;">Location</p>
              <p style="margin:0;font-size:14px;color:#e8f0eb;">${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}</p>
            </td>
            <td width="8px"></td>
            <td width="50%" style="padding:10px 12px;background:#0d1f16;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:10px;color:#7aab8a;text-transform:uppercase;letter-spacing:1px;">In Range</p>
              <p style="margin:0;font-size:14px;color:${alert.inRange ? "#7aab8a" : "#c85a3a"};">${alert.inRange ? "Yes" : "No — out of range"}</p>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding:10px 12px;background:#0d1f16;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:10px;color:#7aab8a;text-transform:uppercase;letter-spacing:1px;">Anomaly Score</p>
              <p style="margin:0;font-size:14px;color:#e8f0eb;">${alert.anomalyScore}<span style="color:#7aab8a;font-size:12px;">/100</span></p>
            </td>
            <td width="8px"></td>
            <td width="50%" style="padding:10px 12px;background:#0d1f16;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:10px;color:#7aab8a;text-transform:uppercase;letter-spacing:1px;">Invasive Species</p>
              <p style="margin:0;font-size:14px;color:${alert.invasive ? "#c85a3a" : "#e8f0eb"};">${alert.invasive ? "Yes" : "No"}</p>
            </td>
          </tr>
        </table>

        <!-- recommended action -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="padding:14px 16px;background:#c85a3a;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:1px;opacity:0.8;">Recommended Action</p>
              <p style="margin:0;font-size:15px;font-weight:bold;color:#fff;">${action}</p>
            </td>
          </tr>
        </table>

        <!-- footer -->
        <p style="margin:0;font-size:11px;color:#4a7a5a;border-top:1px solid #2a5a3a;padding-top:16px;">
          Sent by RangerAI &middot; ${alert.dispatchedAt.toISOString()}
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function plainTextFallback(alert: Alert): string {
  if (isAlertBoth(alert)) return alert.formattedMessage.webhook;
  if (isAlertSms(alert)) return alert.formattedMessage;
  return alert.formattedMessage;
}

export async function dispatchEmail(alert: Alert): Promise<boolean> {
  if (alert.threatLevel !== ThreatLevel.CRITICAL) return true;

  if (!env.RESEND_ENABLED) {
    console.log("[alert-agent] email disabled RESEND_ENABLED=false");
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const to = process.env.ALERT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.log("[alert-agent] Resend not configured — email stubbed");
    return true;
  }

  const blocked = await inspectEmailPayload(alert);
  if (blocked) {
    console.warn(`[alert-agent] civic inspect_input blocked email dispatch for alert ${alert.alertId}`);
    return false;
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `CRITICAL ALERT: ${alert.species} — RangerAI`,
      html: buildHtml(alert),
      text: plainTextFallback(alert),
    });

    if (error) {
      console.error("[alert-agent] Resend error:", error);
      return false;
    }

    console.log(`[alert-agent] email dispatched via Resend to ${to}`);
    alertEvents.emit(ALERT_DISPATCHED, {
      type: "alert:dispatched",
      payload: { alert, method: "email" },
      timestamp: new Date(),
    });

    return true;
  } catch (err) {
    console.error("[alert-agent] Resend fetch failed:", err);
    return false;
  }
}
