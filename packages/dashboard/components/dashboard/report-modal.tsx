"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Card } from "../ui/card";

export function ReportModal({
  generating,
  species,
  reportUrl,
  filePath,
  onClose,
}: {
  generating: boolean;
  species: string | null;
  reportUrl?: string;
  filePath?: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  if (!generating && !reportUrl && !filePath) return null;

  const titleId = "report-modal-title";

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a3a2acc] p-4 outline-none"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <Card className="w-full max-w-lg p-6">
        {generating ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ranger-moss border-t-transparent" />
            <h2 id={titleId} className="text-xl font-semibold text-ranger-text">
              Generating report for {species ?? "species"}...
            </h2>
            <p className="text-sm text-ranger-muted">
              Requesting DALL-E 3 illustration and
              <br />
              GPT-4o field narrative. This takes around 20-30 seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 id={titleId} className="text-xl font-semibold text-ranger-text">Report ready</h2>
              {species && <p className="mt-1 text-sm text-ranger-muted">{species}</p>}
            </div>

            {reportUrl ? (
              <a
                href={reportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg border border-ranger-moss bg-ranger-moss/10 px-4 py-2 text-sm font-medium text-ranger-text hover:bg-ranger-moss/20"
              >
                Open Report
              </a>
            ) : filePath ? (
              <div className="space-y-2">
                <p className="text-xs text-ranger-muted">
                  Report file is available on the pipeline server.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-ranger-border bg-ranger-bg p-3 text-xs text-ranger-text">
                  <code>{filePath}</code>
                </pre>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <Link href="/reports" className="text-xs text-ranger-moss hover:underline">
                View all reports
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-ranger-border px-3 py-1.5 text-xs text-ranger-text hover:bg-ranger-border/40"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
