"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/card";
import { ThreatBadge } from "./threat-badge";
import { formatRelativeTime, zoneIdFromCoords } from "../../lib/sighting-helpers";

type DispatchRow = {
  alertId: string;
  species: string;
  zone: string;
  dispatchedAt: Date;
  anomalyScore: number | null;
  method: "email" | "stub";
};

function parseRow(a: Record<string, unknown>): DispatchRow | null {
  if (typeof a.alertId !== "string" || typeof a.species !== "string") return null;
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  const raw = a.dispatchedAt ?? a.receivedAt ?? a.timestamp;
  if (!raw) return null;
  const dispatchedAt = new Date(raw as string);
  if (isNaN(dispatchedAt.getTime())) return null;
  return {
    alertId: a.alertId,
    species: a.species,
    zone: zoneIdFromCoords(a.lat, a.lng),
    dispatchedAt,
    anomalyScore: typeof a.anomalyScore === "number" ? a.anomalyScore : null,
    method: typeof a.emailSent === "boolean" && a.emailSent ? "email" : "stub",
  };
}

function mergeRow(prev: DispatchRow[], row: DispatchRow): DispatchRow[] {
  if (prev.some((r) => r.alertId === row.alertId)) return prev;
  return [row, ...prev].sort((a, b) => b.dispatchedAt.getTime() - a.dispatchedAt.getTime());
}

export function RangerDispatchView() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Initial fetch for historical CRITICAL alerts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/alerts/history?levels=CRITICAL", { cache: "no-store" });
        const data = (await res.json()) as { alerts?: Record<string, unknown>[]; error?: string };
        if (cancelled) return;
        if (!res.ok) { setError(data.error ?? "Failed to load dispatch log"); return; }
        const parsed = (data.alerts ?? [])
          .flatMap((a) => { const row = parseRow(a); return row ? [row] : []; });
        setRows((prev) => {
          const map = new Map(prev.map((r) => [r.alertId, r]));
          for (const row of parsed) {
            const existing = map.get(row.alertId);
            if (!existing || row.dispatchedAt > existing.dispatchedAt) map.set(row.alertId, row);
          }
          return [...map.values()].sort((a, b) => b.dispatchedAt.getTime() - a.dispatchedAt.getTime());
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dispatch log");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // SSE subscription for live new alerts — filter CRITICAL and merge into state
  useEffect(() => {
    const es = new EventSource("/api/alerts");
    es.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; alert?: Record<string, unknown> };
        setStreamError(null);
        if (msg.type !== "alert" || !msg.alert) return;
        if (msg.alert.threatLevel !== "CRITICAL") return;
        const row = parseRow(msg.alert);
        if (row) setRows((prev) => mergeRow(prev, row));
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => setStreamError("Alert stream disconnected — live updates paused.");
    return () => es.close();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header explainer */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="mb-1 text-base font-semibold text-ranger-text">Ranger Dispatch Log</h2>
            <p className="text-sm text-ranger-muted">
              Every <ThreatBadge level="CRITICAL" /> alert triggers an email dispatch to the ranger on duty via Resend. Alerts are shown below in reverse chronological order. When no Resend credentials are configured the alert agent stubs the send to console — those entries are marked <span className="font-medium text-ranger-muted">stub</span>.
            </p>
          </div>
          <div className="flex-shrink-0 rounded-lg border border-ranger-border bg-ranger-bg px-3 py-2 text-center">
            <div className="text-xl font-bold text-ranger-text">{loading ? "—" : rows.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-ranger-muted">critical alerts</div>
          </div>
        </div>
      </Card>

      {streamError && (
        <div className="rounded-lg border border-ranger-apricot/30 bg-ranger-apricot/10 px-4 py-2 text-xs text-ranger-apricot">
          {streamError}
        </div>
      )}

      {/* Dispatch table */}
      <Card className="p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-ranger-border/40" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-ranger-apricot">{error}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium text-ranger-text">No critical alerts dispatched yet</p>
            <p className="text-xs text-ranger-muted">Critical alerts appear here the moment the threat agent scores a sighting ≥ 80 or detects a CR/EN species out of range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ranger-border text-left text-xs uppercase text-ranger-muted">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Species</th>
                  <th className="pb-3 pr-4">Zone</th>
                  <th className="pb-3 pr-4">Anomaly</th>
                  <th className="pb-3 pr-4">Dispatch</th>
                  <th className="pb-3">Alert ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.alertId}-${i}`} className="border-b border-ranger-border/50 last:border-0">
                    <td className="py-3 pr-4 text-sm text-ranger-muted">
                      <span title={row.dispatchedAt.toLocaleString()}>
                        {formatRelativeTime(row.dispatchedAt)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm font-medium text-ranger-text">{row.species}</td>
                    <td className="py-3 pr-4 text-sm text-ranger-muted">{row.zone}</td>
                    <td className="py-3 pr-4 text-sm text-ranger-muted">
                      {row.anomalyScore !== null ? (
                        <span className="font-mono text-ranger-apricot">{row.anomalyScore}</span>
                      ) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {row.method === "email" ? (
                        <span className="rounded border border-ranger-moss/40 bg-ranger-moss/20 px-1.5 py-0.5 text-[10px] font-semibold text-ranger-moss">
                          email sent
                        </span>
                      ) : (
                        <span className="rounded border border-ranger-muted/40 bg-ranger-muted/20 px-1.5 py-0.5 text-[10px] font-semibold text-ranger-muted">
                          stub
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-xs text-ranger-muted">{row.alertId.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
