import { startCivicMcpServer } from "@rangerai/civic-mcp";
import {
  startIngestAgent,
  triggerPoll,
  ingestEvents,
  AGENT_NEW_SIGHTINGS,
} from "@rangerai/ingest-agent";
import { processSighting as visionProcess } from "@rangerai/vision-agent";
import { processSighting as threatProcess } from "@rangerai/threat-agent";
import { dispatchAlert, generateReport } from "@rangerai/alert-agent";
import type { ClassifiedSighting, ScoredSighting } from "@rangerai/shared";
import { basename } from "node:path";

// ── monitoring state ───────────────────────────────────────────────────────

type AgentStatus = "idle" | "active" | "error";

interface AgentState {
  status: AgentStatus;
  lastEvent: string | null;
  logs: string[];
  count: number;
}

type AgentId = "ingest" | "vision" | "threat" | "alert";

const state: Record<AgentId, AgentState> = {
  ingest: { status: "idle", lastEvent: null, logs: [], count: 0 },
  vision: { status: "idle", lastEvent: null, logs: [], count: 0 },
  threat: { status: "idle", lastEvent: null, logs: [], count: 0 },
  alert: { status: "idle", lastEvent: null, logs: [], count: 0 },
};

let lastScoredSighting: ScoredSighting | null = null;
let paused = false;

const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

function broadcast(data: unknown): void {
  const payload = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const ctrl of clients) {
    try {
      ctrl.enqueue(payload);
    } catch {
      clients.delete(ctrl);
    }
  }
}

function log(agent: AgentId, message: string, status?: AgentStatus): void {
  const s = state[agent];
  const ts = new Date().toISOString();
  s.lastEvent = ts;
  s.count++;
  if (status !== undefined) s.status = status;
  s.logs = [...s.logs.slice(-19), `[${ts}] ${message}`];
  broadcast({ agent, message, status: s.status, count: s.count, timestamp: ts });
}

// ── keep the process alive on unhandled rejections ────────────────────────

process.on("unhandledRejection", (reason) => {
  console.error("[run] unhandled rejection:", reason);
});

// ── boot sequence ──────────────────────────────────────────────────────────

console.log("[boot] starting civic-mcp server...");
await startCivicMcpServer();
console.log("[boot] civic-mcp ready");

console.log("[boot] wiring agent pipeline...");

// ── pipeline wiring ────────────────────────────────────────────────────────

ingestEvents.on(AGENT_NEW_SIGHTINGS, async (event) => {
  try {
    const sightings = event.payload.sightings;
    log("ingest", `received ${sightings.length} sighting(s)`, "active");

    for (const sighting of sightings) {
      if (paused) {
        log("ingest", "paused — skipping remaining sightings", "idle");
        break;
      }
      // vision
      let classified: ClassifiedSighting;
      try {
        log("vision", `classifying id=${sighting.id}`, "active");
        classified = await visionProcess(sighting);
        log(
          "vision",
          `classified: ${classified.species} confidence=${classified.confidence.toFixed(2)}`,
          "idle",
        );
      } catch (err) {
        log("vision", `error id=${sighting.id}: ${String(err)}`, "error");
        continue;
      }

      // threat
      let scored: ScoredSighting;
      try {
        log("threat", `scoring ${classified.species}`, "active");
        scored = await threatProcess(classified);
        log(
          "threat",
          `scored: ${scored.species} level=${scored.threatLevel} score=${scored.anomalyScore}`,
          "idle",
        );
      } catch (err) {
        log("threat", `error ${classified.species}: ${String(err)}`, "error");
        continue;
      }

      // alert
      lastScoredSighting = scored;
      try {
        log("alert", `dispatching ${scored.species} [${scored.threatLevel}]`, "active");
        await dispatchAlert(scored);
        log("alert", `dispatched: ${scored.species}`, "idle");
      } catch (err) {
        log("alert", `error ${scored.species}: ${String(err)}`, "error");
      }
    }

    state.ingest.status = "idle";
  } catch (err) {
    log("ingest", `pipeline error: ${String(err)}`, "error");
  }
});

console.log("[boot] starting ingest agent (Amboseli)...");
startIngestAgent();
console.log("[boot] ingest agent polling");
console.log("[boot] monitoring UI → http://localhost:4000");

// keepalive so SSE connections survive Bun's idle timeout
const KEEPALIVE = encoder.encode(": keepalive\n\n");
setInterval(() => {
  for (const ctrl of clients) {
    try {
      ctrl.enqueue(KEEPALIVE);
    } catch {
      clients.delete(ctrl);
    }
  }
}, 15_000);

// ── monitoring UI ──────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>RangerAI — dev monitor</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #1a3a2a;
  color: #c8dcc8;
  font-family: "Courier New", Courier, monospace;
  font-size: 13px;
  min-height: 100vh;
  padding: 16px;
}
h1 {
  font-size: 14px;
  letter-spacing: 2px;
  color: #7aab8a;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.panel {
  background: #0d1f16;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #2a5a3a;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a5a3a;
}
.agent-name { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
.agent-ingest .agent-name { color: #4caf72; }
.agent-vision .agent-name { color: #5a9fd4; }
.agent-threat .agent-name { color: #e0a030; }
.agent-alert .agent-name { color: #d45a5a; }
.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.badge-idle { background: #2a5a3a; color: #7aab8a; }
.badge-active { background: #1a4a8a; color: #5a9fd4; }
.badge-error { background: #5a1a1a; color: #d45a5a; }
.meta {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #4a7a5a;
  margin-bottom: 8px;
}
.meta span b { color: #c8dcc8; }
.log-box {
  background: #0a1510;
  border-radius: 4px;
  padding: 8px;
  height: 200px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.6;
}
.log-line { color: #4a7a5a; word-break: break-all; }
.log-active { color: #5a9fd4; }
.log-idle { color: #7aab8a; }
.log-error { color: #d45a5a; }
</style>
</head>
<body>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
  <h1 style="margin:0">RangerAI &middot; dev monitor</h1>
  <div style="display:flex;gap:8px;">
    <button id="btn-test">trigger poll now</button>
    <button id="btn-pause">pause</button>
    <button id="btn-report">generate report</button>
    <button id="btn-export">export logs</button>
  </div>
</div>
<style>
button {
  background: #2a5a3a;
  color: #7aab8a;
  border: 1px solid #4a8a5a;
  border-radius: 4px;
  padding: 6px 14px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  text-transform: uppercase;
}
button:hover { background: #3a7a4a; color: #c8dcc8; }
button:disabled { opacity: 0.4; cursor: default; }
</style>
<div class="grid">
  <div class="panel agent-ingest">
    <div class="panel-header">
      <span class="agent-name">ingest</span>
      <span class="badge badge-idle" id="badge-ingest">idle</span>
    </div>
    <div class="meta">
      <span>events: <b id="count-ingest">0</b></span>
      <span>last: <b id="last-ingest">&mdash;</b></span>
    </div>
    <div class="log-box" id="log-ingest"></div>
  </div>
  <div class="panel agent-vision">
    <div class="panel-header">
      <span class="agent-name">vision</span>
      <span class="badge badge-idle" id="badge-vision">idle</span>
    </div>
    <div class="meta">
      <span>events: <b id="count-vision">0</b></span>
      <span>last: <b id="last-vision">&mdash;</b></span>
    </div>
    <div class="log-box" id="log-vision"></div>
  </div>
  <div class="panel agent-threat">
    <div class="panel-header">
      <span class="agent-name">threat</span>
      <span class="badge badge-idle" id="badge-threat">idle</span>
    </div>
    <div class="meta">
      <span>events: <b id="count-threat">0</b></span>
      <span>last: <b id="last-threat">&mdash;</b></span>
    </div>
    <div class="log-box" id="log-threat"></div>
  </div>
  <div class="panel agent-alert">
    <div class="panel-header">
      <span class="agent-name">alert</span>
      <span class="badge badge-idle" id="badge-alert">idle</span>
    </div>
    <div class="meta">
      <span>events: <b id="count-alert">0</b></span>
      <span>last: <b id="last-alert">&mdash;</b></span>
    </div>
    <div class="log-box" id="log-alert"></div>
  </div>
</div>
<script>
const es = new EventSource("/events");
es.addEventListener("message", (e) => {
  const d = JSON.parse(e.data);
  if (d.type === "init") {
    for (const a of ["ingest", "vision", "threat", "alert"]) {
      const s = d.state[a];
      document.getElementById("count-" + a).textContent = s.count;
      document.getElementById("last-" + a).textContent =
        s.lastEvent ? new Date(s.lastEvent).toLocaleTimeString() : "\u2014";
      setBadge(a, s.status);
      const box = document.getElementById("log-" + a);
      box.innerHTML = s.logs.map((l) => line(l, "")).join("");
    }
    return;
  }
  if (d.type === "paused") {
    const btn = document.getElementById("btn-pause");
    btn.textContent = d.paused ? "resume" : "pause";
    btn.style.background = d.paused ? "#5a1a1a" : "";
    btn.style.color = d.paused ? "#d45a5a" : "";
    btn.style.borderColor = d.paused ? "#8a2a2a" : "";
    return;
  }
  if (d.type === "report") {
    const name = d.filePath.split("/").pop();
    const link = document.createElement("a");
    link.href = "/reports/" + name;
    link.target = "_blank";
    link.textContent = "open report: " + name;
    link.style.cssText = "display:block;margin-top:8px;color:#7aab8a;font-size:11px;";
    document.querySelector(".grid").before(link);
    return;
  }
  const { agent, message, status, count, timestamp } = d;
  document.getElementById("count-" + agent).textContent = count;
  document.getElementById("last-" + agent).textContent =
    new Date(timestamp).toLocaleTimeString();
  setBadge(agent, status);
  const box = document.getElementById("log-" + agent);
  box.insertAdjacentHTML(
    "beforeend",
    line("[" + new Date(timestamp).toISOString() + "] " + message, status),
  );
  while (box.children.length > 20) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
});
function line(text, status) {
  return '<div class="log-line log-' + (status || "") + '">' + esc(text) + "</div>";
}
function setBadge(agent, status) {
  const b = document.getElementById("badge-" + agent);
  b.textContent = status;
  b.className = "badge badge-" + status;
}
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
document.getElementById("btn-test").addEventListener("click", triggerTest);
document.getElementById("btn-pause").addEventListener("click", togglePause);
document.getElementById("btn-report").addEventListener("click", triggerReport);
document.getElementById("btn-export").addEventListener("click", exportLogs);
es.onopen = () => {
  document.querySelector("h1").textContent = "RangerAI \u00b7 dev monitor";
};
es.onerror = () => {
  document.querySelector("h1").textContent =
    "RangerAI \u00b7 dev monitor \u2014 disconnected";
};
function exportLogs() {
  const lines = [];
  for (const a of ["ingest", "vision", "threat", "alert"]) {
    lines.push("=== " + a.toUpperCase() + " ===");
    const box = document.getElementById("log-" + a);
    for (const el of box.children) lines.push(el.textContent);
    lines.push("");
  }
  const blob = new Blob([lines.join("\\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rangerai-logs-" + new Date().toISOString().replace(/[:.]/g, "-") + ".txt";
  a.click();
  URL.revokeObjectURL(url);
}
async function togglePause() {
  await fetch("/pause", { method: "POST" });
}
async function triggerReport() {
  const btn = document.getElementById("btn-report");
  btn.disabled = true;
  btn.textContent = "generating\u2026";
  try {
    const res = await fetch("/report", { method: "POST" });
    const data = await res.json();
    if (!res.ok) btn.textContent = data.error ?? "error";
    else btn.textContent = "generating\u2026 (check alert panel)";
  } catch {
    btn.textContent = "error";
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "generate report";
    }, 3000);
  }
}
async function triggerTest() {
  const btn = document.getElementById("btn-test");
  btn.disabled = true;
  btn.textContent = "injecting\u2026";
  try {
    await fetch("/test", { method: "POST" });
  } finally {
    btn.disabled = false;
    btn.textContent = "trigger poll now";
  }
}
</script>
</body>
</html>`;

Bun.serve({
  port: 4000,
  idleTimeout: 255,
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (pathname === "/events") {
      let myCtrl: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
          myCtrl = ctrl;
          clients.add(ctrl);
          ctrl.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "init", state })}\n\n`,
            ),
          );
        },
        cancel() {
          clients.delete(myCtrl);
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (pathname === "/pause" && req.method === "POST") {
      paused = !paused;
      broadcast({ type: "paused", paused });
      return new Response(JSON.stringify({ paused }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/test" && req.method === "POST") {
      log("ingest", "manual poll triggered", "active");
      triggerPoll()
        .then(() => {
          if (state.ingest.status === "active") {
            log("ingest", "poll complete — no new sightings (all deduped)", "idle");
          }
        })
        .catch((err) => {
          log("ingest", `poll error: ${String(err)}`, "error");
        });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/report" && req.method === "POST") {
      if (!lastScoredSighting) {
        return new Response(JSON.stringify({ error: "no sighting processed yet — trigger a poll first" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      log("alert", `generating report for ${lastScoredSighting.species}`, "active");
      generateReport([lastScoredSighting])
        .then((filePath) => {
          log("alert", `report ready: ${filePath}`, "idle");
          broadcast({ type: "report", filePath });
        })
        .catch((err) => {
          log("alert", `report error: ${String(err)}`, "error");
        });
      return new Response(JSON.stringify({ ok: true, species: lastScoredSighting.species }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname.startsWith("/reports/")) {
      const filename = basename(pathname.slice("/reports/".length));
      const filePath = `${import.meta.dir}/../reports/${filename}`;
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return new Response("not found", { status: 404 });
      }
      return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});
