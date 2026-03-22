"use client";

import { useStaggeredMount } from "../../hooks/use-staggered-mount";
import { StatCard } from "./stat-card";
import { SightingActivityChart } from "./sighting-activity-chart";
import { SightingFrequencyChart } from "./sighting-frequency-chart";
import { ZoneHealthPanel } from "./zone-health-panel";
import { RecentSightingsTable } from "./recent-sightings-table";
import type { RecentSightingRow } from "./types";
import type { ZoneData } from "../../hooks/use-zone-health";
import type { ActivityPoint } from "../../hooks/use-sighting-activity";
import type { FrequencyPoint } from "../../hooks/use-sighting-frequency";

export function DashboardView({
  isMobile,
  isDesktop,
  alertsToday,
  activeZones,
  speciesTracked,
  statsLoading,
  statsError,
  recentSightings,
  sightingsPage,
  onSightingsPageChange,
  zones,
  totalAnimals,
  zonesLoading,
  activitySeries,
  activityLoading,
  onZoneChange,
  onDaysChange,
  frequencySeries,
  frequencySpecies,
  frequencyLoading,
  frequencyTab,
  onFrequencyTabChange,
  civicActive,
  civicTotalToolCallsAudited,
  civicInjectionsBlocked,
}: {
  isMobile: boolean;
  isDesktop: boolean;
  alertsToday: number;
  activeZones: number;
  speciesTracked: number;
  statsLoading: boolean;
  statsError: boolean;
  recentSightings: RecentSightingRow[];
  sightingsPage: number;
  onSightingsPageChange: (page: number) => void;
  zones: ZoneData[];
  totalAnimals: number;
  zonesLoading: boolean;
  activitySeries: ActivityPoint[];
  activityLoading: boolean;
  onZoneChange: (zone: string) => void;
  onDaysChange: (days: number) => void;
  frequencySeries: FrequencyPoint[];
  frequencySpecies: string[];
  frequencyLoading: boolean;
  frequencyTab: string;
  onFrequencyTabChange: (tab: string) => void;
  civicActive: boolean;
  civicTotalToolCallsAudited: number;
  civicInjectionsBlocked: number;
}) {
  const cardsVisible = useStaggeredMount(3, 150);

  return (
    <>
      {/* Stat Cards */}
      <div className={`mb-6 grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        <StatCard
          title="Active Zones"
          value={activeZones}
          subtitle="zones active today"
          trend="up"
          visible={cardsVisible[0]}
          delay={0}
          loading={statsLoading}
          error={statsError}
        />
        <StatCard
          title="Species Tracked"
          value={speciesTracked}
          subtitle="distinct species today"
          trend="up"
          visible={cardsVisible[1]}
          delay={100}
          loading={statsLoading}
          error={statsError}
        />
        <StatCard
          title="Alerts Today"
          value={alertsToday}
          subtitle="from live alert stream"
          trend="down"
          visible={cardsVisible[2]}
          delay={200}
          loading={statsLoading}
          error={statsError}
        />
      </div>

      {/* Charts Row */}
      <div className={`mb-6 grid gap-6 ${isDesktop ? "grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
        <SightingActivityChart
          series={activitySeries}
          loading={activityLoading}
          zones={zones}
          onZoneChange={onZoneChange}
          onDaysChange={onDaysChange}
        />
        <SightingFrequencyChart
          frequencyTab={frequencyTab}
          onTabChange={onFrequencyTabChange}
          series={frequencySeries}
          species={frequencySpecies}
          loading={frequencyLoading}
        />
      </div>

      {/* Bottom Panels */}
      <div className={`grid gap-6 ${isDesktop ? "grid-cols-2" : "grid-cols-1"}`}>
        <ZoneHealthPanel
          zones={zones}
          totalAnimals={totalAnimals}
          loading={zonesLoading}
        />
        <RecentSightingsTable
          sightings={recentSightings}
          page={sightingsPage}
          onPageChange={onSightingsPageChange}
        />
      </div>

      {/* Civic Guardrail Audit Strip */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ranger-border bg-ranger-card px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${civicActive ? "bg-ranger-moss" : "bg-ranger-muted"}`} />
          <span className="font-mono text-xs uppercase tracking-widest text-ranger-muted">
            {civicActive ? "Civic Guardrails Active" : "Civic Guardrails Unavailable"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
            {civicTotalToolCallsAudited} calls audited
          </span>
          <span className="rounded bg-ranger-border/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ranger-muted">
            {civicInjectionsBlocked} injections blocked
          </span>
        </div>
      </div>
    </>
  );
}
