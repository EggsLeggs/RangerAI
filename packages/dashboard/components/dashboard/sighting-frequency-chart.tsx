"use client";

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
import type { FrequencyPoint } from "../../hooks/use-sighting-frequency";

const LINE_COLOURS = ["#1C2417", "#B86F0A", "#4a7c5a", "#5a9fd4", "#d45a5a"] as const;

export function SightingFrequencyChart({
  frequencyTab,
  onTabChange,
  series,
  species,
  loading,
}: {
  frequencyTab: string;
  onTabChange: (tab: string) => void;
  series: FrequencyPoint[];
  species: string[];
  loading: boolean;
}) {
  const pointsToShow = series.length;
  // show ~8 labels regardless of window size
  const frequencyXInterval = pointsToShow <= 8 ? 0 : Math.ceil(pointsToShow / 8) - 1;

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
        {species.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-sm text-ranger-muted">
            no sighting data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
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
              {species.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={LINE_COLOURS[i % LINE_COLOURS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={s}
                  animationDuration={1000}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
