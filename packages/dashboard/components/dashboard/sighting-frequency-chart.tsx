"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "../ui/card";
import { CHART } from "../../lib/constants";
import { getPointsForFrequency, buildFrequencySeries } from "../../lib/sighting-helpers";

export function SightingFrequencyChart({
  frequencyTab,
  onTabChange,
}: {
  frequencyTab: string;
  onTabChange: (tab: string) => void;
}) {
  const pointsToShow = getPointsForFrequency(frequencyTab);
  const frequencyChartData = useMemo(
    () => buildFrequencySeries(pointsToShow),
    [pointsToShow]
  );
  const frequencyXInterval = Math.max(0, Math.min(47, Math.floor(pointsToShow / 12) - 1));

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ranger-text">Sighting Frequency</h2>
      </div>
      <div className="mb-4 flex gap-1">
        {["7 Days", "30 Days", "90 Days"].map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
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
    </Card>
  );
}
