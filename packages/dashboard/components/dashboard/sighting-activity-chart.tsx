"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card } from "../ui/card";
import { Icons } from "../icons";
import { CHART } from "../../lib/constants";
import type { ActivityPoint } from "../../hooks/use-sighting-activity";
import type { ZoneData } from "../../hooks/use-zone-health";

export function SightingActivityChart({
  series,
  loading,
  zones,
  onZoneChange,
  onDaysChange,
}: {
  series: ActivityPoint[];
  loading: boolean;
  zones: ZoneData[];
  onZoneChange: (zone: string) => void;
  onDaysChange: (days: number) => void;
}) {
  // Negate resolved values so they render below the zero line in the diverging chart
  const displaySeries = series.map((pt) => ({ ...pt, resolved: -pt.resolved }));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ranger-text">Sighting Activity</h2>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by zone"
            className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none"
            onChange={(e) => onZoneChange(e.target.value)}
            defaultValue="all"
          >
            <option value="all">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.id} · {z.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by days"
            className="rounded-lg border border-ranger-border bg-ranger-bg px-3 py-1.5 text-sm text-ranger-text outline-none"
            onChange={(e) => onDaysChange(Number(e.target.value))}
            defaultValue="7"
          >
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
          </select>
          <span aria-hidden="true" className="rounded-lg border border-ranger-border p-1.5 text-ranger-muted">
            <Icons.Filter />
          </span>
        </div>
      </div>
      <div className="relative h-[280px]">
        {loading && (
          <div role="status" aria-live="polite" aria-busy="true" className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-ranger-bg/70">
            <span className="sr-only">Loading chart data</span>
            <div aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-ranger-muted border-t-transparent" />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={loading ? [] : displaySeries}>
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
    </Card>
  );
}
