export type Breakpoint = "mobile" | "tablet" | "desktop";

export interface RecentSightingRow {
  id: string;
  alertId?: string;
  zone: string;
  species: string;
  threat: string;
  time: string;
  receivedAt?: Date;
}

export type StoredSighting = Omit<RecentSightingRow, "receivedAt"> & {
  receivedAt: string;
};

export interface AgentPipelineEntry {
  agentId: string;
  name: string;
  status: string;
  color: string;
}

export interface GuardrailMetrics {
  totalCalls: number;
  injectionsBlocked: number;
  errors: number;
}
