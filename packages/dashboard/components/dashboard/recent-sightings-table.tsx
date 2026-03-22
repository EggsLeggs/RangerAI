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
  onGenerateReport,
  generatingAlertId,
}: {
  sightings: RecentSightingRow[];
  page: number;
  onPageChange: (page: number) => void;
  onGenerateReport: (alertId: string, species: string) => void;
  generatingAlertId: string | null;
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
              <th className="pb-3 w-5" />
            </tr>
          </thead>
          <tbody>
            {sightings.slice(page * SIGHTINGS_PAGE_SIZE, (page + 1) * SIGHTINGS_PAGE_SIZE).map((sighting) => {
              const alertId = sighting.alertId ?? sighting.id;
              const isGenerating = generatingAlertId === alertId;
              const isDisabled = generatingAlertId !== null && !isGenerating;
              return (
              <tr
                key={sighting.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-label={isGenerating ? `Generating report for ${sighting.species}` : `Open report for ${sighting.species}`}
                aria-disabled={isDisabled}
                onClick={() => !isDisabled && onGenerateReport(alertId, sighting.species)}
                onKeyDown={(e) => {
                  if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onGenerateReport(alertId, sighting.species);
                  }
                }}
                className={`border-b border-ranger-border/50 last:border-0 transition-colors ${
                  isDisabled
                    ? "cursor-not-allowed opacity-50"
                    : isGenerating
                      ? "cursor-wait bg-ranger-border/10"
                      : "cursor-pointer hover:bg-ranger-border/20"
                }`}
              >
                <td className="py-3 pr-4 w-28 text-sm text-ranger-muted">{sighting.zone}</td>
                <td className="py-3 pr-4">
                  <span className="text-sm text-ranger-text">{sighting.species}</span>
                </td>
                <td className="py-3 pr-4">
                  <ThreatBadge level={sighting.threat} />
                </td>
                <td className="py-3 pr-4 text-sm text-ranger-muted">{sighting.time}</td>
                <td className="py-3 w-5 text-ranger-muted">
                  {isGenerating ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-ranger-muted border-t-transparent inline-block" />
                  ) : (
                    <Icons.Report />
                  )}
                </td>
              </tr>
            )})}
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
