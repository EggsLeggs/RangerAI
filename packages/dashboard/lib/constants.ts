import type { AgentPipelineEntry, RecentSightingRow } from "./types";

export const SIGHTINGS_KEY = "rangerai:recent-sightings";
export const ALERTS_TODAY_KEY = "rangerai:alerts-today";
export const SIGHTINGS_PAGE_SIZE = 10;

export const INITIAL_AGENT_PIPELINE: AgentPipelineEntry[] = [
  { agentId: "ingest", name: "Ingest Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "vision", name: "Vision Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "threat", name: "Threat Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "alert", name: "Alert Agent", status: "Idle", color: "#4a7c5a" },
];

export const INITIAL_RECENT_SIGHTINGS: RecentSightingRow[] = [
  { id: "init-0", zone: "ZN-01", species: "African Elephant", threat: "INFO", time: "2 mins ago" },
  { id: "init-1", zone: "ZN-03", species: "Lion Pride", threat: "WARNING", time: "8 mins ago" },
  { id: "init-2", zone: "ZN-02", species: "Cape Buffalo", threat: "INFO", time: "15 mins ago" },
  { id: "init-3", zone: "ZN-07", species: "Leopard", threat: "CRITICAL", time: "22 mins ago" },
  { id: "init-4", zone: "ZN-04", species: "Cheetah", threat: "WARNING", time: "31 mins ago" },
  { id: "init-5", zone: "ZN-09", species: "Black Rhino", threat: "CRITICAL", time: "45 mins ago" },
];

export const CHART = {
  grid: "#CBC8C0",
  axis: "#7A7670",
  tooltipBg: "#F2EFE8",
  tooltipBorder: "#CBC8C0",
  tooltipText: "#1C2417",
  bar1: "#4a7c5a",
  bar2: "#B86F0A",
  bar3: "#9A9790",
  line1: "#1C2417",
  line2: "#B86F0A",
  line3: "#4a7c5a",
} as const;

export const sightingData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  sightings: 20 + ((i * 37 + 13) % 80),
  incidents: 5 + ((i * 17 + 7) % 15),
  resolved: -(3 + ((i * 11 + 5) % 12)),
}));

export const zoneHealthData = [
  { name: "Northern Corridor", coverage: 87, color: "#4a7c5a" },
  { name: "Eastern Plains", coverage: 72, color: "#4a7c5a" },
  { name: "River Delta", coverage: 95, color: "#4a7c5a" },
  { name: "Southern Scrub", coverage: 58, color: "#B86F0A" },
];
