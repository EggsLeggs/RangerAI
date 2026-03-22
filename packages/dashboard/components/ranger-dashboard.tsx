"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import { Icons } from "./icons";
import { AgentLogsPanel } from "./agent-logs-panel";
import { useAgentStatusStream } from "./agent-status-stream";
import type { MapSighting, MapBounds } from "./live-map";

const LiveMap = dynamic(
  () => import("./live-map").then((m) => m.LiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(70vh,560px)] w-full animate-pulse rounded-xl border border-ranger-border bg-ranger-border/30" />
    ),
  }
);
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ============ TYPES ============
type Breakpoint = "mobile" | "tablet" | "desktop";

interface NavItem {
  name: string;
  icon: React.ReactNode;
  active?: boolean;
  onSelect?: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ============ HOOKS ============
function useWindowSize() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint | null>(null);

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint("mobile");
      } else if (width < 1080) {
        setBreakpoint("tablet");
      } else {
        setBreakpoint("desktop");
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoint;
}

function useCountUp(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0);
  const currentRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startValue = currentRef.current;
    startTimeRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const next = Math.floor(startValue + easedProgress * (target - startValue));
      currentRef.current = next;
      setCount(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = target;
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

function useStaggeredMount(itemCount: number, baseDelay: number = 100) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    Array(itemCount).fill(false)
  );

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    for (let i = 0; i < itemCount; i++) {
      timeouts.push(
        setTimeout(() => {
          setVisibleItems((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, baseDelay * (i + 1))
      );
    }

    return () => timeouts.forEach(clearTimeout);
  }, [itemCount, baseDelay]);

  return visibleItems;
}

// ============ DATA ============
type DashboardView = "dashboard" | "live-map" | "agent-logs";

const INITIAL_AGENT_PIPELINE = [
  { agentId: "ingest", name: "Ingest Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "vision", name: "Vision Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "threat", name: "Threat Agent", status: "Idle", color: "#4a7c5a" },
  { agentId: "alert",  name: "Alert Agent",  status: "Idle", color: "#4a7c5a" },
];

function agentStatusColor(status: string): string {
  if (status === "active") return "#5a9fd4";
  if (status === "error")  return "#d45a5a";
  return "#4a7c5a";
}

function agentStatusLabel(agentStatus: string, message: string | null): string {
  if (agentStatus === "error") return "Error";
  if (agentStatus === "idle")  return "Idle";
  if (!message) return "Active";
  const m = message.trim();
  const n = m.match(/\d+/)?.[0];
  if (/received/i.test(m) && n)       return `${n} new`;
  if (/poll|trigger/i.test(m))        return "Polling";
  if (/paused/i.test(m))              return "Paused";
  if (/classif/i.test(m) && !/:\s/.test(m)) return "Classifying";
  if (/classified/i.test(m)) {
    const s = m.match(/classified[:\s]+([A-Za-z]+)/i)?.[1];
    return s ?? "Classified";
  }
  if (/^scoring/i.test(m))            return "Scoring";
  if (/^scored/i.test(m)) {
    const lvl = m.match(/level=(\w+)/i)?.[1];
    return lvl ?? "Scored";
  }
  if (/dispatching/i.test(m)) {
    const lvl = m.match(/\[(\w+)\]/)?.[1];
    return lvl ? lvl[0] + lvl.slice(1).toLowerCase() : "Dispatching";
  }
  if (/dispatched/i.test(m))          return "Dispatched";
  if (/generating/i.test(m))          return "Generating";
  if (/report ready/i.test(m))        return "Ready";
  return "Active";
}

// deterministic demo data - avoids hydration mismatches
const sightingData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  sightings: 20 + ((i * 37 + 13) % 80),
  incidents: 5 + ((i * 17 + 7) % 15),
  resolved: -(3 + ((i * 11 + 5) % 12)),
}));

const zoneHealthData = [
  { name: "Northern Corridor", coverage: 87, color: "#4a7c5a" },
  { name: "Eastern Plains", coverage: 72, color: "#4a7c5a" },
  { name: "River Delta", coverage: 95, color: "#4a7c5a" },
  { name: "Southern Scrub", coverage: 58, color: "#B86F0A" },
];

interface RecentSightingRow {
  id: string;
  zone: string;
  species: string;
  threat: string;
  time: string;
  receivedAt?: Date;
}

const INITIAL_RECENT_SIGHTINGS: RecentSightingRow[] = [
  { id: "init-0", zone: "ZN-01", species: "African Elephant", threat: "INFO", time: "2 mins ago" },
  { id: "init-1", zone: "ZN-03", species: "Lion Pride", threat: "WARNING", time: "8 mins ago" },
  { id: "init-2", zone: "ZN-02", species: "Cape Buffalo", threat: "INFO", time: "15 mins ago" },
  { id: "init-3", zone: "ZN-07", species: "Leopard", threat: "CRITICAL", time: "22 mins ago" },
  { id: "init-4", zone: "ZN-04", species: "Cheetah", threat: "WARNING", time: "31 mins ago" },
  { id: "init-5", zone: "ZN-09", species: "Black Rhino", threat: "CRITICAL", time: "45 mins ago" },
];


function getPointsForFrequency(tab: string): number {
  switch (tab) {
    case "7 Days":
      return 7 * 24;
    case "30 Days":
      return 30 * 24;
    case "90 Days":
      return 90 * 24;
    default:
      return 7 * 24;
  }
}

function buildFrequencySeries(totalHours: number) {
  return Array.from({ length: totalHours }, (_, i) => ({
    hour: i,
    elephant: Math.sin(i / 6) * 20 + 30,
    lion: Math.cos(i / 8) * 15 + 25,
    rhino: Math.sin(i / 10 + 2) * 12 + 18,
  }));
}

const SIGHTINGS_KEY = "rangerai:recent-sightings";

type StoredSighting = Omit<RecentSightingRow, "receivedAt"> & { receivedAt: string };

function loadPersistedSightings(): RecentSightingRow[] {
  try {
    const raw = localStorage.getItem(SIGHTINGS_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as StoredSighting[];
    return stored.map((s) => {
      const receivedAt = new Date(s.receivedAt);
      return { ...s, receivedAt, time: formatRelativeTime(receivedAt) };
    });
  } catch {
    return [];
  }
}

function persistSightings(sightings: RecentSightingRow[]): void {
  try {
    const live = sightings.filter((s) => s.receivedAt);
    if (!live.length) return;
    const payload: StoredSighting[] = live
      .slice(0, 50)
      .map((s) => ({ ...s, receivedAt: s.receivedAt!.toISOString() }));
    localStorage.setItem(SIGHTINGS_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return `ZN-${String(n).padStart(2, "0")}`;
}

function threatToMapLevel(t: string): MapSighting["level"] {
  if (t === "CRITICAL" || t === "WARNING" || t === "INFO") return t;
  return "INFO";
}

function formatRelativeTime(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

// chart theme - colours matched to dark forest palette
const CHART = {
  grid: "#CBC8C0",
  axis: "#7A7670",
  tooltipBg: "#F2EFE8",
  tooltipBorder: "#CBC8C0",
  tooltipText: "#1C2417",
  bar1: "#4a7c5a",   // sightings - sage green
  bar2: "#B86F0A",   // incidents - amber
  bar3: "#9A9790",   // resolved - muted
  line1: "#1C2417",  // elephant - dark
  line2: "#B86F0A",  // lion - amber
  line3: "#4a7c5a",  // rhino - sage
} as const;

// ============ COMPONENTS ============
function StatCard({
  title,
  value,
  subtitle,
  trend,
  visible,
  delay,
}: {
  title: string;
  value: number;
  subtitle: string;
  trend: "up" | "down";
  visible: boolean;
  delay: number;
}) {
  const count = useCountUp(visible ? value : 0, 1500);

  return (
    <div
      className="rounded-xl border border-ranger-border bg-ranger-card p-5 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="text-sm text-ranger-muted">{title}</div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl font-semibold text-ranger-text">{count}</span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            trend === "up"
              ? "bg-ranger-moss/20 text-ranger-moss"
              : "bg-ranger-apricot/20 text-ranger-apricot"
          }`}
        >
          {trend === "up" ? <Icons.ArrowUp /> : <Icons.ArrowDown />}
        </span>
      </div>
      <div className="mt-1 text-sm text-ranger-muted">{subtitle}</div>
    </div>
  );
}

function ZoneProgressBar({
  name,
  coverage,
  color,
  visible,
  delay,
}: {
  name: string;
  coverage: number;
  color: string;
  visible: boolean;
  delay: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setWidth(coverage), delay);
      return () => clearTimeout(timer);
    }
  }, [visible, coverage, delay]);

  return (
    <div className="py-2">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-ranger-text">{name}</span>
        <span className="text-ranger-muted">{coverage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-ranger-border">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ThreatBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-ranger-spice text-ranger-text",
    WARNING: "bg-ranger-apricot text-ranger-text",
    INFO: "bg-ranger-moss text-ranger-text",
    NEEDS_REVIEW: "bg-ranger-border text-ranger-text",
  };

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[level]}`}>
      {level}
    </span>
  );
}

function Sidebar({
  isOpen,
  onClose,
  breakpoint,
  navSections,
}: {
  isOpen: boolean;
  onClose: () => void;
  breakpoint: Breakpoint;
  navSections: NavSection[];
}) {
  const sidebarContent = (
    <div className="flex h-full flex-col bg-ranger-card">
      {/* Logo */}
      <div className="flex h-[72px] items-center gap-3 border-b border-ranger-border px-4">
        <span className="text-lg font-semibold text-ranger-text">RangerAI</span>
        {breakpoint === "mobile" && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto text-ranger-muted hover:text-ranger-text"
          >
            <Icons.Close />
          </button>
        )}
      </div>

      {/* Zone Selector */}
      <div className="border-b border-ranger-border p-4">
        <button className="flex w-full items-center justify-between rounded-lg bg-ranger-border/50 p-3 text-left">
          <div>
            <div className="text-sm font-medium text-ranger-text">Serengeti Reserve</div>
            <div className="text-xs text-ranger-muted">12 zones monitored</div>
          </div>
          <span className="text-ranger-text"><Icons.ChevronDown /></span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="mb-2 px-3 text-xs font-medium uppercase tracking-widest text-ranger-muted">
              {section.title}
            </div>
            {section.items.map((item) => (
              <button
                key={`${section.title}-${item.name}`}
                type="button"
                onClick={() => {
                  item.onSelect?.();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  item.active
                    ? "border border-ranger-moss/30 bg-ranger-border/50 text-ranger-text"
                    : "text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text"
                }`}
              >
                {item.icon}
                {item.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-ranger-border p-3">
        <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text">
          <div className="flex items-center gap-3">
            <Icons.Bell />
            Notifications
          </div>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ranger-apricot px-1.5 text-xs font-medium text-ranger-text">
            8
          </span>
        </button>
        {/* User Profile */}
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-ranger-border/30 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ranger-moss text-sm font-medium text-ranger-text">
            AD
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-ranger-text">Amara Diallo</div>
            <div className="text-xs text-ranger-muted">Head Ranger</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (breakpoint === "mobile" || breakpoint === "tablet") {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        )}
        <div
          className={`fixed left-0 top-0 z-50 h-full w-[280px] transform transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-[calc(100%-40px)] w-[220px]">
      {sidebarContent}
    </div>
  );
}

function mapSightingBaseId(s: Pick<MapSighting, "id" | "lat" | "lng">): string {
  const id = s.id;
  if (id?.startsWith("live-")) return id.slice(5);
  if (id) return id;
  return `${s.lat},${s.lng}`;
}

function trimSightingsPreferLive(sortedDesc: MapSighting[], cap: number): MapSighting[] {
  if (sortedDesc.length <= cap) return sortedDesc;
  const out = [...sortedDesc];
  while (out.length > cap) {
    let dropIdx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (!out[i]?.id?.startsWith("live-")) {
        dropIdx = i;
        break;
      }
    }
    if (dropIdx === -1) out.pop();
    else out.splice(dropIdx, 1);
  }
  return out;
}

function mergeHistoryAndLiveSightings(
  fetched: MapSighting[],
  prev: MapSighting[]
): MapSighting[] {
  const liveEntries = prev.filter((s) => s.id?.startsWith("live-") || !s.id);
  const byBase = new Map<string, MapSighting>();

  const consider = (s: MapSighting) => {
    const base = mapSightingBaseId(s);
    const cur = byBase.get(base);
    const sLive = Boolean(s.id?.startsWith("live-"));
    const curLive = Boolean(cur?.id?.startsWith("live-"));
    if (!cur) {
      byBase.set(base, s);
      return;
    }
    if (sLive && !curLive) {
      byBase.set(base, s);
      return;
    }
    if (sLive === curLive) {
      const ta = s.timestamp?.getTime() ?? 0;
      const tb = cur.timestamp?.getTime() ?? 0;
      if (ta >= tb) byBase.set(base, s);
    }
  };

  for (const s of fetched) consider(s);
  for (const s of liveEntries) consider(s);

  const merged = [...byBase.values()].sort(
    (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
  );
  return trimSightingsPreferLive(merged, 500);
}

// ============ MAIN COMPONENT ============
export default function RangerDashboard() {
  const breakpoint = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [frequencyTab, setFrequencyTab] = useState("7 Days");
  const [activeView, setActiveView] = useState<DashboardView>("dashboard");
  const [agentPipeline, setAgentPipeline] = useState(INITIAL_AGENT_PIPELINE);
  const [recentSightings, setRecentSightings] = useState(INITIAL_RECENT_SIGHTINGS);
  const [sightingsPage, setSightingsPage] = useState(0);
  const SIGHTINGS_PAGE_SIZE = 10;
  const [mapSightings, setMapSightings] = useState<MapSighting[]>([]);
  const [mapHistoryLoaded, setMapHistoryLoaded] = useState(false);
  const [mapHistoryError, setMapHistoryError] = useState<string | null>(null);
  const [mapFitKey, setMapFitKey] = useState(0);
  const [mapSeverityFilter, setMapSeverityFilter] = useState<Set<string>>(
    new Set(["CRITICAL", "WARNING", "INFO"])
  );
  const [mapTimeRange, setMapTimeRange] = useState<"1h" | "6h" | "24h" | "7d" | "all">("all");
  const [mapBoundsActive, setMapBoundsActive] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const mapFilterMountedRef = useRef(false);
  const mapHistoryRequestIdRef = useRef(0);
  const [streamLive, setStreamLive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [guardrailMetrics, setGuardrailMetrics] = useState({
    totalCalls: 0,
    injectionsBlocked: 0,
    errors: 0,
  });
  const [guardrailActive, setGuardrailActive] = useState(true);
  const [guardrailMetricsLoading, setGuardrailMetricsLoading] = useState(true);
  const { paused, subscribe: subscribeAgentStatus } = useAgentStatusStream();
  const cardsVisible = useStaggeredMount(3, 150);
  const zonesVisible = useStaggeredMount(4, 100);
  const zoneAnimalCount = useCountUp(847, 1500);

  const pointsToShow = getPointsForFrequency(frequencyTab);
  const frequencyChartData = useMemo(
    () => buildFrequencySeries(pointsToShow),
    [pointsToShow]
  );
  const frequencyXInterval = Math.max(0, Math.min(47, Math.floor(pointsToShow / 12) - 1));

  const [alertsToday, setAlertsToday] = useState(0);
  const todayAlertIdsRef = useRef<Set<string>>(new Set());

  const filteredMapSightings = useMemo(() => {
    const now = Date.now();
    const rangeMs: Record<string, number> = {
      "1h":  1 * 60 * 60_000,
      "6h":  6 * 60 * 60_000,
      "24h": 24 * 60 * 60_000,
      "7d":  7 * 24 * 60 * 60_000,
      "all": Infinity,
    };
    const cutoff = mapTimeRange === "all" ? 0 : now - rangeMs[mapTimeRange];

    return mapSightings.filter((s) => {
      if (!mapSeverityFilter.has(s.level)) return false;
      const ts = s.timestamp ? s.timestamp.getTime() : now;
      if (ts < cutoff) return false;
      if (mapBoundsActive && mapBounds) {
        if (
          s.lat < mapBounds.south ||
          s.lat > mapBounds.north ||
          s.lng < mapBounds.west ||
          s.lng > mapBounds.east
        ) return false;
      }
      return true;
    });
  }, [mapSightings, mapSeverityFilter, mapTimeRange, mapBoundsActive, mapBounds]);

  // re-fit map when filters change (skip initial mount)
  useEffect(() => {
    if (!mapFilterMountedRef.current) { mapFilterMountedRef.current = true; return; }
    setMapFitKey((k) => k + 1);
  }, [mapSeverityFilter, mapTimeRange]);

  // re-fit map when navigating to the live-map view
  useEffect(() => {
    if (activeView === "live-map") {
      setMapFitKey((k) => k + 1);
    }
  }, [activeView]);

  // restore recent sightings from localStorage on mount
  useEffect(() => {
    const persisted = loadPersistedSightings();
    if (persisted.length > 0) setRecentSightings(persisted);
  }, []);

  // persist live sightings whenever the list changes
  useEffect(() => {
    persistSightings(recentSightings);
  }, [recentSightings]);

  // restore today's alert count from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rangerai:alerts-today");
      if (!raw) return;
      const stored = JSON.parse(raw) as { date: string; ids: string[] };
      if (stored.date !== new Date().toDateString()) {
        localStorage.removeItem("rangerai:alerts-today");
        return;
      }
      const ids = new Set(stored.ids);
      todayAlertIdsRef.current = ids;
      setAlertsToday(ids.size);
    } catch { /* ignore */ }
  }, []);

  const navSections = useMemo((): NavSection[] => {
    return [
      {
        title: "MONITORING",
        items: [
          {
            name: "Dashboard",
            icon: <Icons.Dashboard />,
            active: activeView === "dashboard",
            onSelect: () => setActiveView("dashboard"),
          },
          {
            name: "Live Map",
            icon: <Icons.Map />,
            active: activeView === "live-map",
            onSelect: () => setActiveView("live-map"),
          },
          { name: "Alert Feed", icon: <Icons.Alert />, active: false },
          { name: "Zone Manager", icon: <Icons.Zone />, active: false },
        ],
      },
      {
        title: "WILDLIFE",
        items: [
          { name: "Animal Tracker", icon: <Icons.Animal />, active: false },
          { name: "Species Index", icon: <Icons.Species />, active: false },
          { name: "Sighting Log", icon: <Icons.Sighting />, active: false },
        ],
      },
      {
        title: "OPERATIONS",
        items: [
          { name: "Ranger Dispatch", icon: <Icons.Dispatch />, active: false },
          { name: "Reports", icon: <Icons.Report />, active: false },
          {
            name: "Agent Logs",
            icon: <Icons.Logs />,
            active: activeView === "agent-logs",
            onSelect: () => setActiveView("agent-logs"),
          },
        ],
      },
    ];
  }, [activeView]);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const applyAlertPayload = (a: Record<string, unknown>) => {
      const lat = typeof a.lat === "number" ? a.lat : NaN;
      const lng = typeof a.lng === "number" ? a.lng : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const species = typeof a.species === "string" ? a.species : "Unknown";
      const threatLevel = typeof a.threatLevel === "string" ? a.threatLevel : "INFO";
      const rowId =
        typeof a.alertId === "string" && a.alertId.length > 0
          ? a.alertId
          : crypto.randomUUID();

      const now = new Date();
      setStreamLive(true);
      setStreamError(null);
      setSightingsPage(0);
      setRecentSightings((prev) => {
        if (prev.some((s) => s.id === rowId)) return prev;
        return [
          {
            id: rowId,
            zone: zoneIdFromCoords(lat, lng),
            species,
            threat: threatLevel,
            time: formatRelativeTime(now),
            receivedAt: now,
          },
          ...prev,
        ].slice(0, 50);
      });

      if (!todayAlertIdsRef.current.has(rowId)) {
        todayAlertIdsRef.current.add(rowId);
        setAlertsToday(todayAlertIdsRef.current.size);
        try {
          localStorage.setItem("rangerai:alerts-today", JSON.stringify({
            date: now.toDateString(),
            ids: [...todayAlertIdsRef.current],
          }));
        } catch { /* ignore */ }
      }

      setMapSightings((prev) => {
        const withoutSameBase = prev.filter((s) => mapSightingBaseId(s) !== rowId);
        const next: MapSighting = {
          id: `live-${rowId}`,
          lat,
          lng,
          level: threatToMapLevel(threatLevel),
          label: species,
          timestamp: now,
        };
        const merged = [next, ...withoutSameBase].sort(
          (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
        );
        return trimSightingsPreferLive(merged, 500);
      });

      setAgentPipeline((prev) =>
        prev.map((p) =>
          p.name === "Alert Agent" ? { ...p, status: "Dispatching", color: "#4a7c5a" } : p
        )
      );
    };

    const onMessage = (ev: MessageEvent) => {
      let msg: { type?: string; alert?: Record<string, unknown> };
      try {
        msg = JSON.parse(ev.data) as { type?: string; alert?: Record<string, unknown> };
      } catch {
        return;
      }

      if (msg.type === "connected" || msg.type === "heartbeat") {
        attempt = 0;
        setStreamLive(true);
        setStreamError(null);
        return;
      }

      if (msg.type !== "alert" || !msg.alert) return;
      attempt = 0;
      applyAlertPayload(msg.alert);
    };

    const connect = () => {
      if (closed) return;
      es?.close();
      es = new EventSource("/api/alerts");
      es.onmessage = onMessage;
      es.onerror = () => {
        console.warn("[ranger-dashboard] alert EventSource error; will reconnect");
        setStreamLive(false);
        setStreamError("Alert stream disconnected. Reconnecting…");
        es?.close();
        es = null;
        if (closed) return;
        attempt += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    // SSE GET /api/alerts is unauthenticated by design (read-only stream);
    // auth (x-api-key) is enforced only on the POST side in webhook.ts
    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  // hydrate recentSightings from Atlas history on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/alerts/history");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { alerts?: Record<string, unknown>[] };
        const today = new Date().toDateString();
        const rows: RecentSightingRow[] = [];
        if (data.alerts?.length) {
          for (const a of data.alerts) {
            if (typeof a.alertId !== "string" || typeof a.species !== "string") continue;
            if (typeof a.lat !== "number" || typeof a.lng !== "number") continue;
            const rawDate = a.dispatchedAt ?? a.receivedAt;
            const receivedAt = rawDate ? new Date(rawDate as string) : null;
            if (!receivedAt || isNaN(receivedAt.getTime()) || receivedAt.toDateString() !== today) continue;
            rows.push({
              id: a.alertId,
              zone: zoneIdFromCoords(a.lat, a.lng),
              species: a.species,
              threat: typeof a.threatLevel === "string" ? a.threatLevel : "INFO",
              time: formatRelativeTime(receivedAt),
              receivedAt,
            });
          }
        }
        if (cancelled) return;
        if (rows.length) {
          setRecentSightings((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const fresh = rows.filter((r) => !existingIds.has(r.id));
            if (!fresh.length) return prev;
            return [...fresh, ...prev].slice(0, 50);
          });
        }
      } catch { /* ignore — history is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // hydrate map sightings from history when time range filter changes
  useEffect(() => {
    const currentId = ++mapHistoryRequestIdRef.current;
    let cancelled = false;
    setMapHistoryLoaded(false);
    setMapHistoryError(null);

    (async () => {
      try {
        const params = new URLSearchParams();
        if (mapTimeRange !== "all") {
          const rangeMs: Record<string, number> = {
            "1h":  1 * 60 * 60_000,
            "6h":  6 * 60 * 60_000,
            "24h": 24 * 60 * 60_000,
            "7d":  7 * 24 * 60 * 60_000,
          };
          params.set("from", new Date(Date.now() - rangeMs[mapTimeRange]).toISOString());
        }
        const res = await fetch(`/api/alerts/history?${params.toString()}`);
        if (cancelled || currentId !== mapHistoryRequestIdRef.current) return;

        if (!res.ok) {
          if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
            setMapHistoryError(`Failed to load sightings (${res.status})`);
          }
          return;
        }

        let data: { alerts?: Record<string, unknown>[] };
        try {
          data = (await res.json()) as { alerts?: Record<string, unknown>[] };
        } catch (e) {
          if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
            setMapHistoryError(e instanceof Error ? e.message : "Invalid response");
          }
          return;
        }

        if (cancelled || currentId !== mapHistoryRequestIdRef.current) return;

        const fetched: MapSighting[] = [];
        for (const a of data.alerts ?? []) {
          if (typeof a.alertId !== "string") continue;
          if (typeof a.lat !== "number" || typeof a.lng !== "number") continue;
          const rawDate = a.dispatchedAt ?? a.receivedAt;
          const ts = rawDate ? new Date(rawDate as string) : null;
          const validTs =
            ts && !Number.isNaN(ts.getTime()) ? ts : undefined;
          fetched.push({
            id: a.alertId,
            lat: a.lat,
            lng: a.lng,
            level: threatToMapLevel(typeof a.threatLevel === "string" ? a.threatLevel : "INFO"),
            label: typeof a.species === "string" ? a.species : undefined,
            timestamp: validTs,
          });
        }

        setMapSightings((prev) => mergeHistoryAndLiveSightings(fetched, prev));

        if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
          setMapHistoryError(null);
          setMapHistoryLoaded(true);
          setMapFitKey((k) => k + 1);
        }
      } catch (e) {
        if (!cancelled && currentId === mapHistoryRequestIdRef.current) {
          setMapHistoryError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      mapHistoryRequestIdRef.current += 1;
    };
  }, [mapTimeRange]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/guardrail-metrics");
        const data = (await res.json()) as {
          totalCalls?: number;
          injectionsBlocked?: number;
          errors?: number;
          unavailable?: boolean;
        };
        if (cancelled) return;
        setGuardrailActive(!data.unavailable);
        if (!data.unavailable) {
          setGuardrailMetrics({
            totalCalls: data.totalCalls ?? 0,
            injectionsBlocked: data.injectionsBlocked ?? 0,
            errors: data.errors ?? 0,
          });
        }
      } catch {
        /* keep previous values */
      } finally {
        if (!cancelled) {
          setGuardrailMetricsLoading(false);
          timeoutId = setTimeout(() => { void poll(); }, 10_000);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

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

  if (breakpoint === null) {
    return (
      <div className="flex h-screen flex-col bg-ranger-bg">
        <div className="h-[72px] animate-pulse border-b border-ranger-border bg-ranger-card/60" />
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="h-40 animate-pulse rounded-xl bg-ranger-border/40" />
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <div className="animate-pulse rounded-xl bg-ranger-border/30" />
            <div className="animate-pulse rounded-xl bg-ranger-border/30" />
          </div>
        </div>
      </div>
    );
  }

  const isMobile = breakpoint === "mobile";
  const isDesktop = breakpoint === "desktop";
  const pageTitle =
    activeView === "live-map"
      ? "Live Map"
      : activeView === "agent-logs"
        ? "Agent logs"
        : "Dashboard";

  return (
    <div className="flex h-screen flex-col bg-ranger-bg font-sans">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        breakpoint={breakpoint}
        navSections={navSections}
      />

      {/* Main Content */}
      <div className={`flex flex-1 flex-col overflow-hidden ${isDesktop ? "ml-[220px]" : ""}`}>
        {/* Scrollable Content */}
        <div className="ranger-scrollbar flex-1 overflow-y-auto pb-10">
          {/* Header */}
          <header className="sticky top-0 z-30 h-[72px] border-b border-ranger-border bg-ranger-bg px-4 md:px-6">
            <div className="flex h-full items-center justify-between">
              <div className="flex items-center gap-4">
                {!isDesktop && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open navigation"
                    className="text-ranger-muted hover:text-ranger-text"
                  >
                    <Icons.Menu />
                  </button>
                )}
                <h1 className="text-xl font-semibold text-ranger-text md:text-2xl">
                  {pageTitle}
                </h1>
              </div>

              {/* Search & Menu */}
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-lg border border-ranger-border bg-ranger-card px-3 py-2 sm:flex">
                  <Icons.Search />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-32 bg-transparent text-sm text-ranger-text placeholder-ranger-muted outline-none lg:w-48"
                  />
                </div>
                <button aria-label="More options" className="rounded-lg p-2 text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text">
                  <Icons.MoreVertical />
                </button>
              </div>
            </div>
          </header>

          {/* Agent Pipeline Status */}
          <div className="border-b border-ranger-border bg-ranger-card/50 px-4 py-3 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {agentPipeline.map((agent) => (
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

          {/* Main Content Area */}
          <main className="p-4 md:p-6">
            {activeView === "agent-logs" ? (
              <AgentLogsPanel />
            ) : activeView === "live-map" ? (
              <div>
                {/* Filter toolbar */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {/* Severity toggles */}
                  <div className="flex items-center gap-1">
                    {(["CRITICAL", "WARNING", "INFO"] as const).map((lvl) => {
                      const active = mapSeverityFilter.has(lvl);
                      const colors = { CRITICAL: "#c85a3a", WARNING: "#d4820a", INFO: "#4a7c5a" };
                      return (
                        <button
                          key={lvl}
                          onClick={() =>
                            setMapSeverityFilter((prev) => {
                              const next = new Set(prev);
                              if (next.has(lvl)) { next.delete(lvl); } else { next.add(lvl); }
                              return next;
                            })
                          }
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-transparent text-ranger-text"
                              : "border-ranger-border text-ranger-muted opacity-50"
                          }`}
                          style={active ? { backgroundColor: `${colors[lvl]}33`, borderColor: colors[lvl] } : {}}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: colors[lvl], opacity: active ? 1 : 0.4 }}
                          />
                          {lvl}
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-4 w-px bg-ranger-border" />

                  {/* Time range presets */}
                  <div className="flex items-center gap-1">
                    {(["1h", "6h", "24h", "7d", "all"] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setMapTimeRange(range)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          mapTimeRange === range
                            ? "bg-ranger-border text-ranger-text"
                            : "text-ranger-muted hover:text-ranger-text"
                        }`}
                      >
                        {range === "all" ? "All time" : range}
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-px bg-ranger-border" />

                  {/* Area filter toggle */}
                  <button
                    onClick={() => setMapBoundsActive((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      mapBoundsActive
                        ? "border-ranger-moss/60 bg-ranger-moss/10 text-ranger-moss"
                        : "border-ranger-border text-ranger-muted hover:text-ranger-text"
                    }`}
                    title="Only show sightings within the current map viewport"
                  >
                    <Icons.Map />
                    Within view
                  </button>

                  {/* Count */}
                  <span className="ml-auto text-xs text-ranger-muted">
                    {filteredMapSightings.length} sighting{filteredMapSightings.length === 1 ? "" : "s"}
                  </span>
                </div>

                {mapHistoryError ? (
                  <div className="flex h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-2 rounded-xl border border-ranger-border bg-ranger-card px-6 text-center">
                    <span className="text-sm font-medium text-ranger-apricot">Could not load map history</span>
                    <span className="text-xs text-ranger-muted">{mapHistoryError}</span>
                  </div>
                ) : !mapHistoryLoaded ? (
                  <div className="flex h-[min(70vh,560px)] w-full items-center justify-center rounded-xl border border-ranger-border bg-ranger-card">
                    <span className="text-sm text-ranger-muted">Loading sightings…</span>
                  </div>
                ) : mapSightings.length === 0 ? (
                  <div className="flex h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-2 rounded-xl border border-ranger-border bg-ranger-card">
                    <span className="text-sm font-medium text-ranger-text">No sightings found</span>
                    <span className="text-xs text-ranger-muted">No alert data yet — run the seed script or trigger the pipeline.</span>
                  </div>
                ) : (
                  <div className="relative">
                    <LiveMap
                      sightings={filteredMapSightings}
                      onBoundsChange={setMapBounds}
                      fitKey={mapFitKey}
                    />
                    {filteredMapSightings.length === 0 && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="pointer-events-auto rounded-xl border border-ranger-border bg-ranger-card/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm">
                          <p className="text-sm font-medium text-ranger-text">No sightings in this area</p>
                          <p className="mt-1 text-xs text-ranger-muted">
                            {mapBoundsActive
                              ? "No pins fall within the current map view."
                              : "No sightings match the current filters."}
                          </p>
                          <div className="mt-3 flex justify-center gap-2">
                            {mapBoundsActive && (
                              <button
                                onClick={() => setMapBoundsActive(false)}
                                className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-text hover:bg-ranger-border/40"
                              >
                                Clear area filter
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setMapSeverityFilter(new Set(["CRITICAL", "WARNING", "INFO"]));
                                setMapTimeRange("all");
                                setMapBoundsActive(false);
                              }}
                              className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-text hover:bg-ranger-border/40"
                            >
                              Reset all filters
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
            {/* Stat Cards */}
            <div className={`mb-6 grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
              {/* TODO: replace with live count from /api/stats once endpoint exists */}
              <StatCard
                title="Active Zones"
                value={3}
                subtitle="of 12 zones online"
                trend="up"
                visible={cardsVisible[0]}
                delay={0}
              />
              {/* TODO: replace with live count from /api/stats once endpoint exists */}
              <StatCard
                title="Species Tracked"
                value={847}
                subtitle="across all species"
                trend="up"
                visible={cardsVisible[1]}
                delay={100}
              />
              <StatCard
                title="Alerts Today"
                value={alertsToday}
                subtitle="from live alert stream"
                trend="down"
                visible={cardsVisible[2]}
                delay={200}
              />
            </div>

            {/* Charts Row */}
            <div className={`mb-6 grid gap-6 ${isDesktop ? "grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
              {/* Sighting Activity Chart */}
              <div className="rounded-xl border border-ranger-border bg-ranger-card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-ranger-text">Sighting Activity</h2>
                  <div className="flex items-center gap-2">
                    <select disabled className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none opacity-50 cursor-not-allowed">
                      <option>All Zones</option>
                      <option>Northern Corridor</option>
                      <option>Eastern Plains</option>
                    </select>
                    <select disabled className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none opacity-50 cursor-not-allowed">
                      <option>30 Days</option>
                      <option>7 Days</option>
                      <option>90 Days</option>
                    </select>
                    <button disabled aria-label="Filter" className="rounded-lg border border-ranger-border p-1.5 text-ranger-muted opacity-50 cursor-not-allowed">
                      <Icons.Filter />
                    </button>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sightingData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: CHART.axis, fontSize: 10 }}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                        interval={4}
                      />
                      <YAxis
                        tick={{ fill: CHART.axis, fontSize: 10 }}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART.tooltipBg,
                          border: `1px solid ${CHART.tooltipBorder}`,
                          borderRadius: "8px",
                          color: CHART.tooltipText,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
                      <ReferenceLine y={0} stroke={CHART.grid} />
                      <Bar dataKey="sightings" fill={CHART.bar1} name="Sightings" animationDuration={1000} />
                      <Bar dataKey="incidents" fill={CHART.bar2} name="Incidents" animationDuration={1000} />
                      <Bar dataKey="resolved" fill={CHART.bar3} name="Resolved" animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sighting Frequency */}
              <div className="rounded-xl border border-ranger-border bg-ranger-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ranger-text">Sighting Frequency</h2>
                </div>
                <div className="mb-4 flex gap-1">
                  {["7 Days", "30 Days", "90 Days"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFrequencyTab(tab)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        frequencyTab === tab
                          ? "bg-ranger-border text-ranger-text"
                          : "text-ranger-muted hover:text-ranger-text"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={frequencyChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: CHART.axis, fontSize: 10 }}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                        interval={frequencyXInterval}
                      />
                      <YAxis
                        tick={{ fill: CHART.axis, fontSize: 10 }}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART.tooltipBg,
                          border: `1px solid ${CHART.tooltipBorder}`,
                          borderRadius: "8px",
                          color: CHART.tooltipText,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: CHART.axis }} />
                      <Line
                        type="monotone"
                        dataKey="elephant"
                        stroke={CHART.line1}
                        strokeWidth={2}
                        dot={false}
                        name="Elephant"
                        animationDuration={1000}
                      />
                      <Line
                        type="monotone"
                        dataKey="lion"
                        stroke={CHART.line2}
                        strokeWidth={2}
                        dot={false}
                        name="Lion"
                        animationDuration={1000}
                      />
                      <Line
                        type="monotone"
                        dataKey="rhino"
                        stroke={CHART.line3}
                        strokeWidth={2}
                        dot={false}
                        name="Rhino"
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Panels */}
            <div className={`grid gap-6 ${isDesktop ? "grid-cols-2" : "grid-cols-1"}`}>
              {/* Zone Health */}
              <div className="rounded-xl border border-ranger-border bg-ranger-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-ranger-text">Zone Health</h2>
                <div className="mb-4">
                  <div className="text-3xl font-semibold text-ranger-text">
                    {zoneAnimalCount} Animals
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="text-ranger-moss">
                      <Icons.Stable />
                    </div>
                    <span className="text-sm text-ranger-muted">Stable Population</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-ranger-apricot">
                      <Icons.Risk />
                    </div>
                    <span className="text-sm text-ranger-muted">At Risk Population</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {zoneHealthData.map((zone, i) => (
                    <ZoneProgressBar
                      key={zone.name}
                      name={zone.name}
                      coverage={zone.coverage}
                      color={zone.color}
                      visible={zonesVisible[i]}
                      delay={i * 100}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Sightings */}
              <div className="rounded-xl border border-ranger-border bg-ranger-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ranger-text">Recent Sightings</h2>
                  <span className="text-xs text-ranger-muted">
                    {recentSightings.length === 0 ? "0" : `${sightingsPage * SIGHTINGS_PAGE_SIZE + 1}–${Math.min((sightingsPage + 1) * SIGHTINGS_PAGE_SIZE, recentSightings.length)}`} of {recentSightings.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ranger-border text-left text-xs uppercase text-ranger-muted">
                        <th className="pb-3 pr-4 w-28">Zone</th>
                        <th className="pb-3 pr-4">Species</th>
                        <th className="pb-3 pr-4">Threat</th>
                        <th className="pb-3 pr-4">Time</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSightings.slice(sightingsPage * SIGHTINGS_PAGE_SIZE, (sightingsPage + 1) * SIGHTINGS_PAGE_SIZE).map((sighting) => (
                        <tr
                          key={sighting.id}
                          className="border-b border-ranger-border/50 last:border-0"
                        >
                          <td className="py-3 pr-4 w-28 text-sm text-ranger-muted">{sighting.zone}</td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-ranger-text">{sighting.species}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <ThreatBadge level={sighting.threat} />
                          </td>
                          <td className="py-3 pr-4 text-sm text-ranger-muted">{sighting.time}</td>
                          <td className="py-3">
                            <button aria-label="More options" className="text-ranger-muted hover:text-ranger-text">
                              <Icons.MoreVertical />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recentSightings.length > SIGHTINGS_PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSightingsPage((p) => Math.max(0, p - 1))}
                      disabled={sightingsPage === 0}
                      className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-muted hover:text-ranger-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-ranger-muted">
                      {sightingsPage + 1} / {Math.ceil(recentSightings.length / SIGHTINGS_PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => setSightingsPage((p) => Math.min(Math.ceil(recentSightings.length / SIGHTINGS_PAGE_SIZE) - 1, p + 1))}
                      disabled={(sightingsPage + 1) * SIGHTINGS_PAGE_SIZE >= recentSightings.length}
                      className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-muted hover:text-ranger-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </main>
        </div>

        {/* Guardrail Footer */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-10 items-center justify-between border-t border-ranger-border bg-ranger-footer px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${guardrailActive ? "bg-ranger-moss" : "bg-ranger-muted"}`} />
            <img src="/civic-logo.png" alt="Civic" className="h-4 w-auto opacity-80" />
            <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
              {guardrailActive ? "Guardrails Active" : "Guardrails Unavailable"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              {guardrailMetricsLoading ? "—" : guardrailMetrics.totalCalls} calls audited
            </span>
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              {guardrailMetricsLoading ? "—" : guardrailMetrics.injectionsBlocked} injections blocked
            </span>
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              {guardrailMetricsLoading ? "—" : guardrailMetrics.errors} errors
            </span>
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
            civic-mcp v1.0
          </span>
        </footer>
      </div>
    </div>
  );
}
