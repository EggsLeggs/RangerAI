export function agentStatusColor(status: string): string {
  if (status === "active") return "#5a9fd4";
  if (status === "error") return "#d45a5a";
  return "#4a7c5a";
}

export function agentStatusLabel(agentStatus: string, message: string | null): string {
  if (agentStatus === "error") return "Error";
  if (agentStatus === "idle") return "Idle";
  if (!message) return "Active";
  const m = message.trim();
  const n = m.match(/\d+/)?.[0];
  if (/received/i.test(m) && n) return `${n} new`;
  if (/poll|trigger/i.test(m)) return "Polling";
  if (/paused/i.test(m)) return "Paused";
  if (/classif/i.test(m) && !/:\s/.test(m)) return "Classifying";
  if (/classified/i.test(m)) {
    const s = m.match(/classified[:\s]+([A-Za-z]+)/i)?.[1];
    return s ?? "Classified";
  }
  if (/^scoring/i.test(m)) return "Scoring";
  if (/^scored/i.test(m)) {
    const lvl = m.match(/level=(\w+)/i)?.[1];
    return lvl ?? "Scored";
  }
  if (/dispatching/i.test(m)) {
    const lvl = m.match(/\[(\w+)\]/)?.[1];
    return lvl ? lvl[0] + lvl.slice(1).toLowerCase() : "Dispatching";
  }
  if (/dispatched/i.test(m)) return "Dispatched";
  if (/generating/i.test(m)) return "Generating";
  if (/report ready/i.test(m)) return "Ready";
  return "Active";
}
