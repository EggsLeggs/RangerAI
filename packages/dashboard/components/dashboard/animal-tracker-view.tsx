"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { TimelineScrubber } from "./timeline-scrubber";
import { SightingLogTable } from "./sighting-log-table";
import { useAnimalMovement } from "../../hooks/use-animal-movement";
import { useWildlifeTimeline } from "../../hooks/use-wildlife-timeline";

const MovementMap = dynamic(
  () => import("./movement-map").then((m) => m.MovementMap),
  { ssr: false }
);

export function AnimalTrackerView() {
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [timeFrom, setTimeFrom] = useState<string | undefined>(undefined);
  const [timeTo, setTimeTo] = useState<string | undefined>(undefined);

  const { sightings: timelineSightings, loading: timelineLoading, error: timelineError } = useWildlifeTimeline({
    from: timeFrom,
    to: timeTo,
  });

  const { sightings: movementSightings, loading: movementLoading, error: movementError } = useAnimalMovement({
    species: selectedSpecies,
  });

  function handleRangeChange(from: string, to: string) {
    setTimeFrom(from || undefined);
    setTimeTo(to || undefined);
  }

  if (timelineError || movementError) {
    return (
      <div className="space-y-4">
        <div className="flex h-48 items-center justify-center rounded-xl border border-ranger-border bg-ranger-card">
          <p className="text-sm text-ranger-apricot">
            Failed to load {timelineError && movementError ? "timeline and movement" : timelineError ? "timeline" : "movement"} data. Try refreshing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline scrubber */}
      {timelineLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-ranger-border/40" />
      ) : (
        <TimelineScrubber
          sightings={timelineSightings}
          from={timeFrom}
          to={timeTo}
          onRangeChange={handleRangeChange}
        />
      )}

      {/* Map + log split */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Movement map — 60% */}
        <div className="relative h-[420px] lg:h-[540px] lg:w-[60%]">
          {selectedSpecies === null ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-ranger-border bg-ranger-card text-sm text-ranger-muted">
              Select a species from the log to view its movement trail
            </div>
          ) : movementLoading ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-ranger-border bg-ranger-card">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ranger-border border-t-ranger-moss" />
            </div>
          ) : (
            <>
              <MovementMap sightings={movementSightings} />
              {selectedSpecies && (
                <div className="absolute left-3 top-3 rounded-lg border border-ranger-border bg-ranger-card/90 px-3 py-1.5 text-xs font-semibold text-ranger-text backdrop-blur-sm">
                  {selectedSpecies}
                  <button
                    onClick={() => setSelectedSpecies(null)}
                    className="ml-2 text-ranger-muted hover:text-ranger-text"
                    aria-label="Close species tracker"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sighting log — 40% */}
        <div className="lg:w-[40%]">
          <SightingLogTable
            sightings={timelineSightings}
            onSpeciesClick={(species) => setSelectedSpecies(species)}
          />
        </div>
      </div>
    </div>
  );
}
