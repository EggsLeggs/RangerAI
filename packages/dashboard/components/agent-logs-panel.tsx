"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStatusStream } from "./agent-status-stream";

type AgentId = "ingest" | "vision" | "threat" | "alert";
type AgentStatus = "idle" | "active" | "error";
type LogTone = "muted" | "active" | "idle" | "error";

function normalizeAgentStatus(value: unknown): AgentStatus {
  if (value === "idle" || value === "active" || value === "error") return value;
  return "idle";
}

interface LogEntry {
  text: string;
  tone: LogTone;
}

interface AgentLogState {
  status: AgentStatus;
  lastEvent: string | null;
  logs: LogEntry[];
  count: number;
}

const MAX_LOG_LINES = 20;

const AGENTS: {
  id: AgentId;
  label: string;
  nameClass: string;
}[] = [
  { id: "ingest", label: "Ingest", nameClass: "text-ranger-moss" },
  { id: "vision", label: "Vision", nameClass: "text-ranger-sky" },
  { id: "threat", label: "Threat", nameClass: "text-ranger-apricot" },
  { id: "alert", label: "Alert", nameClass: "text-ranger-spice" },
];

function emptyAgentState(): AgentLogState {
  return {
    status: "idle",
    lastEvent: null,
    logs: [],
    count: 0,
  };
}

function toneForStatus(status: string): LogTone {
  if (status === "active") return "active";
  if (status === "error") return "error";
  if (status === "idle") return "idle";
  return "muted";
}

function logToneClass(tone: LogTone): string {
  switch (tone) {
    case "active":
      return "text-ranger-sky-deep";
    case "idle":
      return "text-ranger-moss";
    case "error":
      return "text-coral-alert";
    default:
      return "text-ranger-muted";
  }
}

function badgeClass(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "border border-ranger-sky-soft/40 bg-ranger-sky-soft/12 text-ranger-sky-deep";
    case "error":
      return "border border-coral-alert/40 bg-coral-alert/10 text-coral-alert";
    default:
      return "border border-ranger-border bg-ranger-border/40 text-ranger-muted";
  }
}

export function AgentLogsPanel() {
  const { streamState, paused, subscribe } = useAgentStatusStream();
  const [agents, setAgents] = useState<Record<AgentId, AgentLogState>>(() => ({
    ingest: emptyAgentState(),
    vision: emptyAgentState(),
    threat: emptyAgentState(),
    alert: emptyAgentState(),
  }));
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const logBoxRefs = useRef<Record<AgentId, HTMLDivElement | null>>({
    ingest: null,
    vision: null,
    threat: null,
    alert: null,
  });

  useEffect(() => {
    const scrollBottom = (id: AgentId) => {
      const el = logBoxRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    };

    return subscribe((msg) => {
      if (msg.type === "report") return;

      if (msg.type === "init" && msg.state && typeof msg.state === "object") {
        const st = msg.state as Record<
          string,
          { status: string; lastEvent: string | null; logs: string[]; count: number }
        >;
        setAgents((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(next) as AgentId[]) {
            const a = st[id];
            if (!a) continue;
            next[id] = {
              status: normalizeAgentStatus(a.status),
              lastEvent: a.lastEvent ?? null,
              count: typeof a.count === "number" ? a.count : 0,
              logs: (a.logs ?? []).map((line) => ({
                text: line,
                tone: "muted" as const,
              })),
            };
          }
          return next;
        });
        requestAnimationFrame(() => {
          for (const { id } of AGENTS) scrollBottom(id);
        });
        return;
      }

      if (typeof msg.agent === "string" && typeof msg.status === "string") {
        const agentId = msg.agent as AgentId;
        if (!AGENTS.some((a) => a.id === agentId)) return;
        const agentStatus = normalizeAgentStatus(msg.status);
        const message = typeof msg.message === "string" ? msg.message : "";
        const count = typeof msg.count === "number" ? msg.count : undefined;
        const timestamp =
          typeof msg.timestamp === "string" ? msg.timestamp : new Date().toISOString();
        const line = `[${timestamp}] ${message}`;
        const tone = toneForStatus(agentStatus);

        setAgents((prev) => {
          const cur = prev[agentId];
          const logs = [...cur.logs, { text: line, tone }];
          const trimmed = logs.length > MAX_LOG_LINES ? logs.slice(-MAX_LOG_LINES) : logs;
          return {
            ...prev,
            [agentId]: {
              ...cur,
              status: agentStatus,
              lastEvent: timestamp,
              count: count !== undefined ? count : cur.count + 1,
              logs: trimmed,
            },
          };
        });
        requestAnimationFrame(() => scrollBottom(agentId));
      }
    });
  }, [subscribe]);

  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/monitor-db-stats");
        const data = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (!res.ok) {
          const err = typeof data.error === "string" ? data.error : "request failed";
          setDbError(err);
          setDbStats(null);
        } else {
          setDbError(null);
          const counts: Record<string, number> = {};
          for (const [k, v] of Object.entries(data)) {
            if (typeof v === "number") counts[k] = v;
          }
          setDbStats(counts);
        }
      } catch (e) {
        if (!cancelled) {
          setDbError(e instanceof Error ? e.message : String(e));
          setDbStats(null);
        }
      } finally {
        if (!cancelled) t = setTimeout(() => void poll(), 10_000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (t !== null) clearTimeout(t);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ranger-border bg-ranger-card px-4 py-3">
        <div>
          <p className="font-display text-sm font-medium text-ranger-text">
            Pipeline monitor
          </p>
          <p className="text-xs text-ranger-muted">
            Same event stream as{" "}
            <code className="rounded bg-ranger-border/50 px-1 font-mono text-[11px]">
              scripts/run.ts
            </code>{" "}
            (port 4000). Start the runner to see live logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused ? (
            <span className="rounded-full border border-coral-alert/50 bg-coral-alert/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-coral-alert">
              Paused
            </span>
          ) : null}
          <span
            className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
              streamState === "live"
                ? "border-ranger-moss/40 bg-ranger-moss/10 text-ranger-moss"
                : streamState === "connecting"
                  ? "border-ranger-border bg-ranger-border/30 text-ranger-muted"
                  : "border-ranger-apricot/50 bg-ranger-apricot/10 text-ranger-apricot"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                streamState === "live"
                  ? "animate-pulse bg-ranger-moss"
                  : streamState === "connecting"
                    ? "bg-ranger-muted"
                    : "bg-ranger-apricot"
              }`}
            />
            {streamState === "live"
              ? "Live"
              : streamState === "connecting"
                ? "Connecting"
                : "Offline"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {AGENTS.map(({ id, label, nameClass }) => {
          const a = agents[id];
          return (
            <div
              key={id}
              className="flex flex-col rounded-xl border border-ranger-border bg-ranger-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-ranger-border pb-3">
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] ${nameClass}`}
                >
                  {label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(a.status)}`}
                >
                  {a.status}
                </span>
              </div>
              <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-ranger-muted">
                <span>
                  Events:{" "}
                  <span className="font-medium text-ranger-text">{a.count}</span>
                </span>
                <span>
                  Last:{" "}
                  <span className="font-mono font-medium text-ranger-text">
                    {a.lastEvent
                      ? new Date(a.lastEvent).toLocaleTimeString()
                      : "\u2014"}
                  </span>
                </span>
              </div>
              <div
                ref={(el) => {
                  logBoxRefs.current[id] = el;
                }}
                className="ranger-scrollbar min-h-[200px] flex-1 overflow-y-auto rounded-lg border border-ranger-border bg-ranger-bg px-3 py-2 font-mono text-[11px] leading-relaxed"
              >
                {a.logs.length === 0 ? (
                  <p className="text-ranger-muted">Waiting for log lines…</p>
                ) : (
                  a.logs.map((entry, i) => (
                    <div
                      key={`${id}-${i}-${entry.text.slice(0, 24)}`}
                      className={`break-all ${logToneClass(entry.tone)}`}
                    >
                      {entry.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-ranger-border bg-ranger-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ranger-border pb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ranger-amethyst">
            MongoDB
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ranger-muted">
            RangerAI collections
          </span>
        </div>
        {dbError ? (
          <p className="text-sm text-ranger-apricot">{dbError}</p>
        ) : dbStats && Object.keys(dbStats).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(dbStats).map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-xs"
              >
                <span className="text-ranger-muted">{name}</span>
                <span className="font-mono font-semibold text-ranger-text">{count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ranger-muted">Loading collection counts…</p>
        )}
      </div>
    </div>
  );
}
