"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "../icons";
import { Separator } from "../ui/separator";
import type { MapSighting, MapBounds } from "../live-map";
import type { ZoneData } from "../../hooks/use-zone-health";

const LiveMap = dynamic(
  () => import("../live-map").then((m) => m.LiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(70vh,560px)] w-full animate-pulse rounded-xl border border-ranger-border bg-ranger-border/30" />
    ),
  }
);

export function LiveMapView({
  filteredSightings,
  allSightingsCount,
  historyLoaded,
  historyError,
  fitKey,
  severityFilter,
  onSeverityFilterChange,
  timeRange,
  onTimeRangeChange,
  boundsActive,
  onBoundsActiveChange,
  onBoundsChange,
  zones,
  onPinClick,
}: {
  filteredSightings: MapSighting[];
  allSightingsCount: number;
  historyLoaded: boolean;
  historyError: string | null;
  fitKey: number;
  severityFilter: Set<string>;
  onSeverityFilterChange: (filter: Set<string>) => void;
  timeRange: "1h" | "6h" | "24h" | "7d" | "all";
  onTimeRangeChange: (range: "1h" | "6h" | "24h" | "7d" | "all") => void;
  boundsActive: boolean;
  onBoundsActiveChange: (active: boolean) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  zones: ZoneData[];
  onPinClick?: (sighting: MapSighting) => void;
}) {
  const [zonesOverlay, setZonesOverlay] = useState(true);
  const [hoveredZone, setHoveredZone] = useState<{ id: string; color: string } | null>(null);

  return (
    <div>
      {/* Filter toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Severity toggles */}
        <div className="flex items-center gap-1">
          {(["CRITICAL", "WARNING", "INFO"] as const).map((lvl) => {
            const active = severityFilter.has(lvl);
            const colors = { CRITICAL: "#c85a3a", WARNING: "#d4820a", INFO: "#4a7c5a" };
            return (
              <button
                key={lvl}
                onClick={() => {
                  const next = new Set(severityFilter);
                  if (next.has(lvl)) { next.delete(lvl); } else { next.add(lvl); }
                  onSeverityFilterChange(next);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-transparent text-ranger-text"
                    : "border-ranger-border text-ranger-muted opacity-50"
                }`}
                style={active ? { backgroundColor: `${colors[lvl]}33`, borderColor: colors[lvl] } : {}}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors[lvl], opacity: active ? 1 : 0.4 }}
                />
                {lvl}
              </button>
            );
          })}
        </div>

        <Separator orientation="vertical" />

        {/* Time range presets */}
        <div className="flex items-center gap-1">
          {(["1h", "6h", "24h", "7d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-ranger-border text-ranger-text"
                  : "text-ranger-muted hover:text-ranger-text"
              }`}
            >
              {range === "all" ? "All time" : range}
            </button>
          ))}
        </div>

        <Separator orientation="vertical" />

        {/* Zone overlay toggle */}
        {zones.length > 0 && (
          <button
            onClick={() => setZonesOverlay((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              zonesOverlay
                ? "border-ranger-moss/60 bg-ranger-moss/10 text-ranger-moss"
                : "border-ranger-border text-ranger-muted hover:text-ranger-text"
            }`}
            title="Toggle zone health overlay"
          >
            <Icons.Zone />
            Zones
          </button>
        )}

        {/* Area filter toggle */}
        <button
          onClick={() => onBoundsActiveChange(!boundsActive)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            boundsActive
              ? "border-ranger-moss/60 bg-ranger-moss/10 text-ranger-moss"
              : "border-ranger-border text-ranger-muted hover:text-ranger-text"
          }`}
          title="Only show sightings within the current map viewport"
        >
          <Icons.Map />
          Within view
        </button>

        {/* Count */}
        <span className="ml-auto text-xs text-ranger-muted">
          {filteredSightings.length} sighting{filteredSightings.length === 1 ? "" : "s"}
        </span>
      </div>

      {allSightingsCount === 0 ? (
        historyError ? (
          <div className="flex h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-2 rounded-xl border border-ranger-border bg-ranger-card px-6 text-center">
            <span className="text-sm font-medium text-ranger-apricot">Could not load map history</span>
            <span className="text-xs text-ranger-muted">{historyError}</span>
          </div>
        ) : !historyLoaded ? (
          <div className="flex h-[min(70vh,560px)] w-full items-center justify-center rounded-xl border border-ranger-border bg-ranger-card">
            <span className="text-sm text-ranger-muted">Loading sightings…</span>
          </div>
        ) : (
          <div className="flex h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-2 rounded-xl border border-ranger-border bg-ranger-card">
            <span className="text-sm font-medium text-ranger-text">No sightings found</span>
            <span className="text-xs text-ranger-muted">No alert data yet — run the seed script or trigger the pipeline.</span>
          </div>
        )
      ) : (
        <div className="relative">
          {historyError && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-ranger-apricot/40 bg-ranger-apricot/10 px-3 py-2 text-xs text-ranger-apricot">
              <span className="font-medium">History unavailable:</span>
              <span>{historyError}</span>
            </div>
          )}
          {!historyLoaded && !historyError && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-ranger-border bg-ranger-card px-3 py-2 text-xs text-ranger-muted">
              <span>Loading full history…</span>
            </div>
          )}
          <LiveMap
            sightings={filteredSightings}
            onBoundsChange={onBoundsChange}
            onPinClick={onPinClick}
            fitKey={fitKey}
            hoveredZone={hoveredZone}
          />

          {/* Zone health overlay */}
          {zonesOverlay && zones.length > 0 && (
            <div className="absolute right-3 top-3 z-[1000] w-52 rounded-xl border border-ranger-border bg-ranger-card/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ranger-muted">
                Zone Health
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {zones.map((z) => {
                  const isHovered = hoveredZone?.id === z.id;
                  return (
                    <div
                      key={z.id}
                      onMouseEnter={() => setHoveredZone({ id: z.id, color: z.color })}
                      onMouseLeave={() => setHoveredZone(null)}
                      className={`cursor-default rounded-lg px-1.5 py-1 transition-colors ${isHovered ? "bg-ranger-border/50" : "hover:bg-ranger-border/30"}`}
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-1 text-xs">
                        <span className="truncate text-ranger-text" title={z.name}>{z.name}</span>
                        <span className="shrink-0 text-ranger-muted">{z.coverage}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {z.atRisk && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: z.color }}
                            title="At risk"
                          />
                        )}
                        <div className="h-1 flex-1 rounded-full bg-ranger-border">
                          <div
                            className="h-1 rounded-full transition-all duration-700"
                            style={{ width: `${z.coverage}%`, backgroundColor: z.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredSightings.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto rounded-xl border border-ranger-border bg-ranger-card/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm">
                <p className="text-sm font-medium text-ranger-text">No sightings in this area</p>
                <p className="mt-1 text-xs text-ranger-muted">
                  {boundsActive
                    ? "No pins fall within the current map view."
                    : "No sightings match the current filters."}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  {boundsActive && (
                    <button
                      type="button"
                      onClick={() => onBoundsActiveChange(false)}
                      className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-text hover:bg-ranger-border/40"
                    >
                      Clear area filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onSeverityFilterChange(new Set(["CRITICAL", "WARNING", "INFO"]));
                      onTimeRangeChange("all");
                      onBoundsActiveChange(false);
                    }}
                    className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-text hover:bg-ranger-border/40"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
