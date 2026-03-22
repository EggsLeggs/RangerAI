export type {
  Breakpoint,
  RecentSightingRow,
  StoredSighting,
  AgentPipelineEntry,
  GuardrailMetrics,
} from "../../lib/types";

export type DashboardView = "dashboard" | "live-map" | "agent-logs" | "reports";

export interface NavItem {
  name: string;
  icon: React.ReactNode;
  active?: boolean;
  onSelect?: () => void;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
