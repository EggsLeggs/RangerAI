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
  onGenerateReport,
  generatingAlertId,
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
  onGenerateReport: (alertId: string, species: string) => void;
  generatingAlertId: string | null;
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
          onGenerateReport={onGenerateReport}
          generatingAlertId={generatingAlertId}
        />
      </div>

    </>
  );
}
