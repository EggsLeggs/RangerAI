"use client";

import Image from "next/image";
import { Card } from "../ui/card";
import type { SpeciesIndexEntry } from "../../hooks/use-species-index";
import { formatRelativeTime } from "../../lib/sighting-helpers";
import { iucnColor, THREAT_COLORS } from "../../lib/iucn-utils";

export function SpeciesCard({
  entry,
  onClick,
}: {
  entry: SpeciesIndexEntry;
  onClick?: (name: string) => void;
}) {
  const color = iucnColor(entry.iucnStatus);
  const initials = entry.name.slice(0, 2).toUpperCase();
  const confidence = entry.avgConfidence !== null ? Math.round(entry.avgConfidence * 100) : null;

  const totalThreats = Object.values(entry.threatBreakdown).reduce((a, b) => a + b, 0);
  const threatOrder = ["CRITICAL", "WARNING", "INFO", "NEEDS_REVIEW"] as const;

  const lastSeenText = entry.lastSeen
    ? formatRelativeTime(new Date(entry.lastSeen))
    : "never";

  return (
    <Card
      className="cursor-pointer p-4 transition-colors hover:bg-ranger-border/10"
      onClick={() => onClick?.(entry.name)}
    >
      <div className="flex items-start gap-3">
        {entry.imageUrl ? (
          <Image
            src={entry.imageUrl}
            alt={entry.name}
            width={80}
            height={80}
            className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold"
            style={{ backgroundColor: color + "33", color }}
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ranger-text">{entry.name}</span>
            {entry.iucnStatus && (
              <span
                className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: color + "33",
                  color,
                  border: `1px solid ${color}66`,
                }}
              >
                {entry.iucnStatus}
              </span>
            )}
          </div>

          <p className="mb-2 text-xs text-ranger-muted">
            {entry.totalSightings} sighting{entry.totalSightings !== 1 ? "s" : ""} &middot; {entry.lastZone ?? "—"} &middot; {lastSeenText}
          </p>

          {/* threat mini-bar */}
          <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full">
            {totalThreats === 0 ? (
              <div className="h-full w-full bg-ranger-border" />
            ) : (
              threatOrder.map((tl) => {
                const count = entry.threatBreakdown[tl] ?? 0;
                if (count === 0) return null;
                const pct = (count / totalThreats) * 100;
                return (
                  <div
                    key={tl}
                    style={{ width: `${pct}%`, backgroundColor: THREAT_COLORS[tl] }}
                    className="h-full"
                  />
                );
              })
            )}
          </div>

          {confidence !== null && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                confidence >= 80
                  ? "bg-ranger-moss/20 text-ranger-moss"
                  : confidence >= 60
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-ranger-border/40 text-ranger-muted"
              }`}
            >
              {confidence}% confidence
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
