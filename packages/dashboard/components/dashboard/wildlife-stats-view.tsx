"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Card } from "../ui/card";
import { IucnTreemap } from "./iucn-treemap";
import { ThreatHistogram } from "./threat-histogram";
import { useCoOccurrence } from "../../hooks/use-co-occurrence";
import { useThreatBreakdown } from "../../hooks/use-threat-breakdown";

const CoOccurrenceGraph = dynamic(
  () => import("./co-occurrence-graph").then((m) => m.CoOccurrenceGraph),
  { ssr: false }
);

const HOURS_OPTIONS = [
  { label: "6h", value: 6 },
  { label: "12h", value: 12 },
  { label: "24h", value: 24 },
  { label: "7d", value: 168 },
];

export function WildlifeStatsView() {
  const [hours, setHours] = useState(24);
  const { pairs, nodes, loading: coLoading, error: coError } = useCoOccurrence({ hours });
  const { iucnBreakdown, anomalyHistogram, loading: bdLoading, error: bdError } = useThreatBreakdown();

  return (
    <div className="space-y-4">
      {/* Co-occurrence graph */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ranger-text">Species Co-occurrence Network</h2>
            <p className="text-xs text-ranger-muted">Species seen together in the same zone within the same hour. Node size = total sightings. Line weight = co-occurrence frequency.</p>
          </div>
          <div className="flex gap-1">
            {HOURS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHours(opt.value)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  hours === opt.value
                    ? "bg-ranger-moss text-white"
                    : "border border-ranger-border text-ranger-muted hover:text-ranger-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[400px] w-full">
          {coLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ranger-border border-t-ranger-moss" />
            </div>
          ) : coError ? (
            <div className="flex h-full items-center justify-center text-sm text-ranger-apricot">
              Failed to load co-occurrence data
            </div>
          ) : (
            <CoOccurrenceGraph pairs={pairs} nodes={nodes} />
          )}
        </div>
      </Card>

      {/* IUCN treemap + threat histogram */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ranger-text">IUCN Status Distribution</h2>
          <p className="mb-3 text-xs text-ranger-muted">Breakdown of observed species by IUCN Red List conservation status. Larger cells indicate more sightings of that category.</p>
          {bdLoading ? (
            <div className="h-[220px] animate-pulse rounded bg-ranger-border/40" />
          ) : bdError ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-ranger-apricot">
              Failed to load IUCN data
            </div>
          ) : (
            <IucnTreemap data={iucnBreakdown} />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ranger-text">Anomaly Score Distribution</h2>
          <p className="mb-3 text-xs text-ranger-muted">Sightings bucketed by anomaly score (0–100). Red bars ≥ 80 are critical, amber 50–79 are warnings, green below 50 are routine.</p>
          {bdLoading ? (
            <div className="h-[220px] animate-pulse rounded bg-ranger-border/40" />
          ) : bdError ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-ranger-apricot">
              Failed to load anomaly data
            </div>
          ) : (
            <ThreatHistogram data={anomalyHistogram} />
          )}
        </Card>
      </div>
    </div>
  );
}
