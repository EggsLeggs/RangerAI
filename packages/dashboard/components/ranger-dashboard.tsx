"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import { Icons } from "./icons";
import type { MapSighting } from "./live-map";

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
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      setCount(Math.floor(easedProgress * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
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
type DashboardView = "dashboard" | "live-map";

const INITIAL_AGENT_PIPELINE = [
  { name: "Ingest Agent", status: "Polling", color: "#4a7c5a" },
  { name: "Vision Agent", status: "Classifying", color: "#4a7c5a" },
  { name: "Threat Agent", status: "1 Warning", color: "#B86F0A" },
  { name: "Alert Agent", status: "Active", color: "#4a7c5a" },
];

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

const INITIAL_RECENT_SIGHTINGS = [
  { zone: "ZN-01", species: "African Elephant", threat: "INFO", time: "2 mins ago" },
  { zone: "ZN-03", species: "Lion Pride", threat: "WARNING", time: "8 mins ago" },
  { zone: "ZN-02", species: "Cape Buffalo", threat: "INFO", time: "15 mins ago" },
  { zone: "ZN-07", species: "Leopard", threat: "CRITICAL", time: "22 mins ago" },
  { zone: "ZN-04", species: "Cheetah", threat: "WARNING", time: "31 mins ago" },
  { zone: "ZN-09", species: "Black Rhino", threat: "CRITICAL", time: "45 mins ago" },
];

const DEMO_MAP_SIGHTINGS: MapSighting[] = [
  { lat: -2.15, lng: 34.75, level: "INFO", label: "African Elephant" },
  { lat: -2.4, lng: 35.0, level: "WARNING", label: "Lion Pride" },
  { lat: -2.3, lng: 34.9, level: "INFO", label: "Cape Buffalo" },
  { lat: -2.5, lng: 34.8, level: "CRITICAL", label: "Leopard" },
  { lat: -2.2, lng: 35.1, level: "WARNING", label: "Cheetah" },
  { lat: -2.45, lng: 34.7, level: "CRITICAL", label: "Black Rhino" },
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

function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return `ZN-${String(n).padStart(2, "0")}`;
}

function threatToMapLevel(t: string): MapSighting["level"] {
  if (t === "CRITICAL" || t === "WARNING" || t === "INFO") return t;
  return "INFO";
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
                key={item.name}
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

  if (breakpoint === "mobile") {
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

// ============ MAIN COMPONENT ============
export default function RangerDashboard() {
  const breakpoint = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [frequencyTab, setFrequencyTab] = useState("7 Days");
  const [activeView, setActiveView] = useState<DashboardView>("dashboard");
  const [agentPipeline, setAgentPipeline] = useState(INITIAL_AGENT_PIPELINE);
  const [recentSightings, setRecentSightings] = useState(INITIAL_RECENT_SIGHTINGS);
  const [mapSightings, setMapSightings] = useState<MapSighting[]>(DEMO_MAP_SIGHTINGS);
  const [streamLive, setStreamLive] = useState(false);
  const cardsVisible = useStaggeredMount(3, 150);
  const zonesVisible = useStaggeredMount(4, 100);
  const zoneAnimalCount = useCountUp(847, 1500);

  const pointsToShow = getPointsForFrequency(frequencyTab);
  const frequencyChartData = useMemo(
    () => buildFrequencySeries(pointsToShow),
    [pointsToShow]
  );
  const frequencyXInterval = Math.max(0, Math.min(47, Math.floor(pointsToShow / 12) - 1));

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
          { name: "Agent Logs", icon: <Icons.Logs />, active: false },
        ],
      },
    ];
  }, [activeView]);

  useEffect(() => {
    const es = new EventSource("/api/alerts");

    es.onmessage = (ev) => {
      let msg: { type?: string; alert?: Record<string, unknown> };
      try {
        msg = JSON.parse(ev.data) as { type?: string; alert?: Record<string, unknown> };
      } catch {
        return;
      }

      if (msg.type === "connected") {
        setStreamLive(true);
        return;
      }

      if (msg.type !== "alert" || !msg.alert) return;

      const a = msg.alert;
      const species = typeof a.species === "string" ? a.species : "Unknown";
      const lat = typeof a.lat === "number" ? a.lat : 0;
      const lng = typeof a.lng === "number" ? a.lng : 0;
      const threatLevel = typeof a.threatLevel === "string" ? a.threatLevel : "INFO";

      setStreamLive(true);
      setRecentSightings((prev) =>
        [
          {
            zone: zoneIdFromCoords(lat, lng),
            species,
            threat: threatLevel,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ].slice(0, 20)
      );

      setMapSightings((prev) =>
        [
          {
            lat,
            lng,
            level: threatToMapLevel(threatLevel),
            label: species,
          },
          ...prev,
        ].slice(0, 40)
      );

      setAgentPipeline((prev) =>
        prev.map((p) =>
          p.name === "Alert Agent" ? { ...p, status: "Dispatching", color: "#4a7c5a" } : p
        )
      );
    };

    return () => es.close();
  }, []);

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
  const pageTitle = activeView === "live-map" ? "Live Map" : "Dashboard";

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
                <button className="rounded-lg p-2 text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text">
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
                    className="flex items-center gap-2 rounded-full border border-ranger-border bg-ranger-bg px-3 py-1.5"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="text-xs text-ranger-muted">{agent.name}</span>
                    <span className="text-xs font-medium text-ranger-text">{agent.status}</span>
                  </div>
                ))}
              </div>
              <div
                className="flex shrink-0 items-center gap-2"
                title={
                  streamLive
                    ? "Connected to /api/alerts stream"
                    : "Waiting for alert stream"
                }
              >
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
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <main className="p-4 md:p-6">
            {activeView === "live-map" ? (
              <div>
                <p className="mb-4 text-sm text-ranger-muted">
                  Severity-coded markers from the alert stream and demo sightings. Critical, warning,
                  and info levels match pipeline threat scores.
                </p>
                <LiveMap sightings={mapSightings} />
              </div>
            ) : (
              <>
            {/* Stat Cards */}
            <div className={`mb-6 grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
              <StatCard
                title="Active Zones"
                value={3}
                subtitle="of 12 zones online"
                trend="up"
                visible={cardsVisible[0]}
                delay={0}
              />
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
                value={14}
                subtitle="6 resolved, 8 open"
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
                    <select className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none">
                      <option>All Zones</option>
                      <option>Northern Corridor</option>
                      <option>Eastern Plains</option>
                    </select>
                    <select className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none">
                      <option>30 Days</option>
                      <option>7 Days</option>
                      <option>90 Days</option>
                    </select>
                    <button className="rounded-lg border border-ranger-border p-1.5 text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text">
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
                <h2 className="mb-4 text-lg font-semibold text-ranger-text">Recent Sightings</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ranger-border text-left text-xs uppercase text-ranger-muted">
                        <th className="pb-3 pr-4">Zone</th>
                        <th className="pb-3 pr-4">Species</th>
                        <th className="pb-3 pr-4">Threat</th>
                        <th className="pb-3 pr-4">Time</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSightings.map((sighting, i) => (
                        <tr
                          key={i}
                          className="border-b border-ranger-border/50 last:border-0"
                        >
                          <td className="py-3 pr-4 text-sm text-ranger-muted">{sighting.zone}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ranger-border text-xs font-medium text-ranger-text">
                                {sighting.species[0]}
                              </div>
                              <span className="text-sm text-ranger-text">{sighting.species}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <ThreatBadge level={sighting.threat} />
                          </td>
                          <td className="py-3 pr-4 text-sm text-ranger-muted">{sighting.time}</td>
                          <td className="py-3">
                            <button className="text-ranger-muted hover:text-ranger-text">
                              <Icons.MoreVertical />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
              </>
            )}
          </main>
        </div>

        {/* Guardrail Footer */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-10 items-center justify-between border-t border-ranger-border bg-ranger-footer px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ranger-moss" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/civic-logo.png" alt="Civic" className="h-4 w-auto opacity-80" />
            <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
              Guardrails Active
            </span>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              124 calls audited
            </span>
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              3 injections blocked
            </span>
            <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
              0 errors
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
