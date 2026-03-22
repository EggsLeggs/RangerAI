import { useState, useEffect } from "react";
import { useAgentStatusStream } from "../components/agent-status-stream";
import { agentStatusColor, agentStatusLabel } from "../lib/agent-helpers";
import { INITIAL_AGENT_PIPELINE } from "../lib/constants";
import type { AgentPipelineEntry } from "../components/dashboard/types";

export function useAgentPipeline() {
  const [agentPipeline, setAgentPipeline] = useState(INITIAL_AGENT_PIPELINE);
  const { paused, subscribe: subscribeAgentStatus } = useAgentStatusStream();

  useEffect(() => {
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const applyAgentUpdate = (agentId: string, agentStatus: string, message: string | null) => {
      const existing = debounceTimers.get(agentId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.delete(agentId);
        setAgentPipeline((prev) =>
          prev.map((p) =>
            p.agentId === agentId
              ? { ...p, status: agentStatusLabel(agentStatus, message), color: agentStatusColor(agentStatus) }
              : p
          )
        );
      }, 400);
      debounceTimers.set(agentId, timer);
    };

    const unsub = subscribeAgentStatus((msg) => {
      if (msg.type === "init" && msg.state && typeof msg.state === "object") {
        for (const t of debounceTimers.values()) clearTimeout(t);
        debounceTimers.clear();
        const s = msg.state as Record<string, { status: string; logs: string[] }>;
        setAgentPipeline((prev) =>
          prev.map((p) => {
            const a = s[p.agentId];
            if (!a) return p;
            const lastLog = a.logs.at(-1) ?? null;
            const lastMsg = lastLog ? lastLog.replace(/^\[[^\]]+\]\s*/, "") : null;
            return { ...p, status: agentStatusLabel(a.status, lastMsg), color: agentStatusColor(a.status) };
          })
        );
        return;
      }

      if (typeof msg.agent === "string" && typeof msg.status === "string") {
        const agentId = msg.agent;
        const agentStatus = msg.status;
        const message = typeof msg.message === "string" ? msg.message : null;
        applyAgentUpdate(agentId, agentStatus, message);
      }
    });

    return () => {
      unsub();
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
    };
  }, [subscribeAgentStatus]);

  return { agentPipeline, setAgentPipeline, paused } as const;
}

export type { AgentPipelineEntry };
