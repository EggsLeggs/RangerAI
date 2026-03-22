"use client";

import type { TimelineSighting } from "../../hooks/use-wildlife-timeline";
import { THREAT_COLORS } from "../../lib/iucn-utils";

export function TimelineScrubber({
  sightings,
  from,
  to,
  onRangeChange,
}: {
  sightings: TimelineSighting[];
  from?: string;
  to?: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ranger-border bg-ranger-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ranger-muted">
          Timeline filter
        </span>
        <span className="text-xs text-ranger-muted">{sightings.length} sightings</span>
      </div>

      {/* density SVG */}
      <div className="mb-3 h-10 w-full overflow-hidden rounded">
        <svg width="100%" height="40" preserveAspectRatio="none">
          {sightings.length > 0 &&
            sightings.map((s, i) => {
              const pct = (i / Math.max(1, sightings.length - 1)) * 100;
              const color = THREAT_COLORS[s.threatLevel] ?? "#4a7c5a";
              return (
                <rect
                  key={i}
                  x={`${pct}%`}
                  y={4}
                  width={2}
                  height={32}
                  fill={color}
                  opacity={0.7}
                />
              );
            })}
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-ranger-muted">From</span>
          <input
            type="datetime-local"
            value={from ? from.slice(0, 16) : ""}
            onChange={(e) => onRangeChange(e.target.value, to ?? "")}
            className="rounded border border-ranger-border bg-ranger-bg px-2 py-1 text-xs text-ranger-text focus:outline-none focus:ring-1 focus:ring-ranger-moss"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-ranger-muted">To</span>
          <input
            type="datetime-local"
            value={to ? to.slice(0, 16) : ""}
            onChange={(e) => onRangeChange(from ?? "", e.target.value)}
            className="rounded border border-ranger-border bg-ranger-bg px-2 py-1 text-xs text-ranger-text focus:outline-none focus:ring-1 focus:ring-ranger-moss"
          />
        </label>
        {(from || to) && (
          <button
            onClick={() => onRangeChange("", "")}
            className="self-end rounded border border-ranger-border px-2 py-1 text-xs text-ranger-muted hover:text-ranger-text"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
