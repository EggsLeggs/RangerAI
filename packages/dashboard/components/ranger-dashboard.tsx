"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Icons } from "./icons";
import { AgentLogsPanel } from "./agent-logs-panel";
import { useWindowSize } from "../hooks/use-window-size";
import { useAgentPipeline } from "../hooks/use-agent-pipeline";
import { useAlertStream } from "../hooks/use-alert-stream";
import { useMapSightings } from "../hooks/use-map-sightings";
import { useGuardrailMetrics } from "../hooks/use-guardrail-metrics";
import { useStats } from "../hooks/use-stats";
import { useZoneHealth } from "../hooks/use-zone-health";
import { useSightingActivity } from "../hooks/use-sighting-activity";
import { useSightingFrequency } from "../hooks/use-sighting-frequency";
import { useReportGenerator } from "../hooks/use-report-generator";
import { Sidebar } from "./dashboard/sidebar";
import { Header } from "./dashboard/header";
import { AgentPipelineBar } from "./dashboard/agent-pipeline-bar";
import { GuardrailFooter } from "./dashboard/guardrail-footer";
import { DashboardView } from "./dashboard/dashboard-view";
import { LiveMapView } from "./dashboard/live-map-view";
import { ReportModal } from "./dashboard/report-modal";
import { ReportsView } from "./dashboard/reports-view";
import type { MapSighting } from "./live-map";
import type { DashboardView as DashboardViewType, NavSection } from "./dashboard/types";

export default function RangerDashboard() {
  const breakpoint = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<DashboardViewType>("dashboard");

  const { agentPipeline, setAgentPipeline, paused } = useAgentPipeline();

  const {
    streamLive,
    streamError,
    recentSightings,
    sightingsPage,
    setSightingsPage,
    alertsToday,
    mapSightings,
    setMapSightings,
  } = useAlertStream(setAgentPipeline);

  const {
    mapHistoryLoaded,
    mapHistoryError,
    mapFitKey,
    setMapFitKey,
    mapSeverityFilter,
    setMapSeverityFilter,
    mapTimeRange,
    setMapTimeRange,
    mapBoundsActive,
    setMapBoundsActive,
    setMapBounds,
    filteredMapSightings,
  } = useMapSightings(mapSightings, setMapSightings);

  const {
    metrics: guardrailMetrics,
    active: guardrailActive,
    loading: guardrailMetricsLoading,
  } = useGuardrailMetrics();
  const { openOrGenerate, generating, lastReport, error } = useReportGenerator();
  const [modalOpen, setModalOpen] = useState(true);
  const [pendingReportSpecies, setPendingReportSpecies] = useState<string | null>(null);

  useEffect(() => {
    if (generating !== null || lastReport !== null) {
      setModalOpen(true);
    }
  }, [generating, lastReport]);

  const triggerReport = useCallback((alertId: string, species: string) => {
    setPendingReportSpecies(species);
    void openOrGenerate(alertId, species);
  }, [setPendingReportSpecies, openOrGenerate]);

  const onPinClick = useCallback((sighting: MapSighting) => {
    if (sighting.alertId) {
      triggerReport(sighting.alertId, sighting.label ?? "Unknown species");
    }
  }, [triggerReport]);

  const { activeZones, speciesTracked, loading: statsLoading, error: statsError } = useStats({ alertCount: alertsToday });
  const { zones, totalAnimals, loading: zonesLoading } = useZoneHealth({ alertCount: alertsToday });

  const [activityDays, setActivityDays] = useState(7);
  const [activityZone, setActivityZone] = useState("all");
  const { series: activitySeries, loading: activityLoading } = useSightingActivity({
    days: activityDays,
    zone: activityZone,
  });

  const [frequencyTab, setFrequencyTab] = useState("7 Days");
  const { series: frequencySeries, species: frequencySpecies, loading: frequencyLoading } =
    useSightingFrequency({ tab: frequencyTab });

  // re-fit map when navigating to the live-map view
  useEffect(() => {
    if (activeView === "live-map") {
      setMapFitKey((k) => k + 1);
    }
  }, [activeView, setMapFitKey]);

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
          {
            name: "Reports",
            icon: <Icons.Report />,
            active: activeView === "reports",
            onSelect: () => setActiveView("reports"),
          },
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
        : activeView === "reports"
          ? "Reports"
          : "Dashboard";

  return (
    <div className="flex h-screen flex-col bg-ranger-bg font-sans">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        breakpoint={breakpoint}
        navSections={navSections}
        notificationsCount={alertsToday}
      />

      <div className={`flex flex-1 flex-col overflow-hidden ${isDesktop ? "ml-[220px]" : ""}`}>
        <div className="ranger-scrollbar flex-1 overflow-y-auto pb-10">
          <Header
            pageTitle={pageTitle}
            isDesktop={isDesktop}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <AgentPipelineBar
            agents={agentPipeline}
            paused={paused}
            streamLive={streamLive}
            streamError={streamError}
          />

          <main className="p-4 md:p-6">
            {activeView === "agent-logs" ? (
              <AgentLogsPanel />
            ) : activeView === "reports" ? (
              <ReportsView />
            ) : activeView === "live-map" ? (
              <LiveMapView
                filteredSightings={filteredMapSightings}
                allSightingsCount={mapSightings.length}
                historyLoaded={mapHistoryLoaded}
                historyError={mapHistoryError}
                fitKey={mapFitKey}
                severityFilter={mapSeverityFilter}
                onSeverityFilterChange={setMapSeverityFilter}
                timeRange={mapTimeRange}
                onTimeRangeChange={setMapTimeRange}
                boundsActive={mapBoundsActive}
                onBoundsActiveChange={setMapBoundsActive}
                onBoundsChange={setMapBounds}
                zones={zones}
                onPinClick={onPinClick}
              />
            ) : (
              <DashboardView
                isMobile={isMobile}
                isDesktop={isDesktop}
                alertsToday={alertsToday}
                activeZones={activeZones}
                speciesTracked={speciesTracked}
                statsLoading={statsLoading}
                statsError={statsError}
                recentSightings={recentSightings}
                sightingsPage={sightingsPage}
                onSightingsPageChange={setSightingsPage}
                zones={zones}
                totalAnimals={totalAnimals}
                zonesLoading={zonesLoading}
                activitySeries={activitySeries}
                activityLoading={activityLoading}
                onZoneChange={setActivityZone}
                onDaysChange={setActivityDays}
                frequencySeries={frequencySeries}
                frequencySpecies={frequencySpecies}
                frequencyLoading={frequencyLoading}
                frequencyTab={frequencyTab}
                onFrequencyTabChange={setFrequencyTab}
                onGenerateReport={triggerReport}
                generatingAlertId={generating}
              />
            )}
          </main>
        </div>

        <GuardrailFooter
          active={guardrailActive}
          metrics={guardrailMetrics}
          loading={guardrailMetricsLoading}
        />
      </div>
      {modalOpen && (generating !== null || lastReport !== null) && (
        <ReportModal
          generating={generating !== null}
          species={generating ? pendingReportSpecies : (lastReport?.species ?? null)}
          reportUrl={lastReport?.reportUrl}
          filePath={lastReport?.filePath}
          onClose={() => setModalOpen(false)}
        />
      )}
      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-ranger-apricot/40 bg-ranger-apricot/10 px-4 py-2 text-xs text-ranger-apricot">
          {error}
        </div>
      )}
    </div>
  );
}
