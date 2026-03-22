"use client";

import { Icons } from "../icons";
import { Card } from "../ui/card";
import { ThreatBadge } from "./threat-badge";
import { SIGHTINGS_PAGE_SIZE } from "../../lib/constants";
import type { RecentSightingRow } from "./types";

export function RecentSightingsTable({
  sightings,
  page,
  onPageChange,
}: {
  sightings: RecentSightingRow[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(sightings.length / SIGHTINGS_PAGE_SIZE);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ranger-text">Recent Sightings</h2>
        <span className="text-xs text-ranger-muted">
          {sightings.length === 0 ? "0" : `${page * SIGHTINGS_PAGE_SIZE + 1}–${Math.min((page + 1) * SIGHTINGS_PAGE_SIZE, sightings.length)}`} of {sightings.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ranger-border text-left text-xs uppercase text-ranger-muted">
              <th className="pb-3 pr-4 w-28">Zone</th>
              <th className="pb-3 pr-4">Species</th>
              <th className="pb-3 pr-4">Threat</th>
              <th className="pb-3 pr-4">Time</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {sightings.slice(page * SIGHTINGS_PAGE_SIZE, (page + 1) * SIGHTINGS_PAGE_SIZE).map((sighting) => (
              <tr
                key={sighting.id}
                className="border-b border-ranger-border/50 last:border-0"
              >
                <td className="py-3 pr-4 w-28 text-sm text-ranger-muted">{sighting.zone}</td>
                <td className="py-3 pr-4">
                  <span className="text-sm text-ranger-text">{sighting.species}</span>
                </td>
                <td className="py-3 pr-4">
                  <ThreatBadge level={sighting.threat} />
                </td>
                <td className="py-3 pr-4 text-sm text-ranger-muted">{sighting.time}</td>
                <td className="py-3">
                  {/* TODO: wire to a context menu or detail drawer */}
                  <button
                    type="button"
                    aria-label="More options"
                    disabled
                    aria-disabled="true"
                    className="cursor-not-allowed text-ranger-muted opacity-40"
                  >
                    <Icons.MoreVertical />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sightings.length > SIGHTINGS_PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-muted hover:text-ranger-text disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-xs text-ranger-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={(page + 1) * SIGHTINGS_PAGE_SIZE >= sightings.length}
            className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-muted hover:text-ranger-text disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </Card>
  );
}
