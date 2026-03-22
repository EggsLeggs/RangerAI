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
import { CHART, sightingData } from "../../lib/constants";

export function SightingActivityChart() {
  return (
    <Card className="p-5">
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
    </Card>
  );
}
