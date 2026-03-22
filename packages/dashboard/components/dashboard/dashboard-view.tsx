"use client";

import { useState } from "react";
import { useStaggeredMount } from "../../hooks/use-staggered-mount";
import { StatCard } from "./stat-card";
import { SightingActivityChart } from "./sighting-activity-chart";
import { SightingFrequencyChart } from "./sighting-frequency-chart";
import { ZoneHealthPanel } from "./zone-health-panel";
import { RecentSightingsTable } from "./recent-sightings-table";
import type { RecentSightingRow } from "./types";

export function DashboardView({
  isMobile,
  isDesktop,
  alertsToday,
  recentSightings,
  sightingsPage,
  onSightingsPageChange,
}: {
  isMobile: boolean;
  isDesktop: boolean;
  alertsToday: number;
  recentSightings: RecentSightingRow[];
  sightingsPage: number;
  onSightingsPageChange: (page: number) => void;
}) {
  const [frequencyTab, setFrequencyTab] = useState("7 Days");
  const cardsVisible = useStaggeredMount(3, 150);

  return (
    <>
      {/* Stat Cards */}
      <div className={`mb-6 grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {/* TODO: wire to /api/stats once endpoint exists */}
        <StatCard
          title="Active Zones"
          value={0}
          subtitle="demo — no live data yet"
          trend="up"
          visible={cardsVisible[0]}
          delay={0}
        />
        {/* TODO: wire to /api/stats once endpoint exists */}
        <StatCard
          title="Species Tracked"
          value={0}
          subtitle="demo — no live data yet"
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
        <SightingActivityChart />
        <SightingFrequencyChart
          frequencyTab={frequencyTab}
          onTabChange={setFrequencyTab}
        />
      </div>

      {/* Bottom Panels */}
      <div className={`grid gap-6 ${isDesktop ? "grid-cols-2" : "grid-cols-1"}`}>
        <ZoneHealthPanel />
        <RecentSightingsTable
          sightings={recentSightings}
          page={sightingsPage}
          onPageChange={onSightingsPageChange}
        />
      </div>
    </>
  );
}
