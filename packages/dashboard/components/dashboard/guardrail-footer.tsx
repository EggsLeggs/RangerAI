"use client";

import type { GuardrailMetrics } from "./types";

export function GuardrailFooter({
  active,
  metrics,
  loading,
}: {
  active: boolean;
  metrics: GuardrailMetrics;
  loading: boolean;
}) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-10 items-center justify-between border-t border-ranger-border bg-ranger-footer px-4 md:px-6">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${active ? "bg-ranger-moss animate-pulse" : "bg-ranger-muted"}`} />
        <img src="/civic-logo.png" alt="Civic" className="h-4 w-auto opacity-80" />
        <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
          {active ? "Guardrails Active" : "Guardrails Unavailable"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
          {loading ? "—" : metrics.totalCalls} calls audited
        </span>
        <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
          {loading ? "—" : metrics.injectionsBlocked} injections blocked
        </span>
        <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
          {loading ? "—" : metrics.errors} errors
        </span>
      </div>
      <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
        civic-mcp v1.0
      </span>
    </footer>
  );
}
