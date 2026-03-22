"use client";

import type { AgentPipelineEntry } from "./types";

export function AgentPipelineBar({
  agents,
  paused,
  streamLive,
  streamError,
}: {
  agents: AgentPipelineEntry[];
  paused: boolean;
  streamLive: boolean;
  streamError: string | null;
}) {
  return (
    <div className="border-b border-ranger-border bg-ranger-card/50 px-4 py-3 md:px-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="group relative flex items-center gap-2 rounded-full border border-ranger-border bg-ranger-bg px-3 py-1.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: agent.color, transition: "background-color 400ms ease" }}
              />
              <span className="text-xs text-ranger-muted">{agent.name}</span>
              <span className="text-xs font-medium text-ranger-text">{agent.status}</span>
              <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-ranger-border bg-ranger-card px-2 py-1 text-xs text-ranger-text shadow-md group-hover:visible">
                {agent.name} — {agent.status}
              </span>
            </div>
          ))}
          {paused && (
            <div className="flex items-center gap-2 rounded-full border border-[#c04a4a] bg-[#7a2020] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#f08080]" />
              <span className="text-xs font-medium text-[#ffd0d0] uppercase tracking-widest">Paused</span>
            </div>
          )}
        </div>
        <div className="group relative flex shrink-0 items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              streamLive ? "animate-pulse-live bg-ranger-moss" : "bg-ranger-muted"
            }`}
          />
          <span
            className={`font-mono text-xs uppercase tracking-widest ${
              streamLive ? "text-ranger-moss" : "text-ranger-muted"
            }`}
          >
            LIVE
          </span>
          {streamError ? (
            <span className="max-w-[min(200px,40vw)] truncate text-[10px] text-ranger-apricot">
              {streamError}
            </span>
          ) : null}
          <span className="pointer-events-none invisible absolute bottom-full right-0 z-50 mb-2 max-w-[260px] whitespace-nowrap rounded border border-ranger-border bg-ranger-card px-2 py-1 text-xs text-ranger-text shadow-md group-hover:visible">
            {streamError ? streamError : streamLive ? "Connected to /api/alerts stream" : "Waiting for alert stream"}
          </span>
        </div>
      </div>
    </div>
  );
}
