import { ThreatLevel, type ScoredSighting } from "@rangerai/shared";
import { generateReport } from "../../../../../alert-agent/src/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type AlertDoc = {
  alertId: string;
  id: string;
  source: "inaturalist" | "gbif";
  imageUrl: string;
  lat: number;
  lng: number;
  observedAt: Date | string;
  observerNotes?: string;
  species: string;
  confidence: number;
  invasive: boolean;
  taxonId: string | null;
  needsReview: boolean;
  anomalyScore: number;
  threatLevel: string;
  iucnStatus: string;
  inRange: boolean;
};

type ReportInsert = {
  filePath: string;
  generatedAt: Date;
  species: string;
  alertId: string;
  reportUrl?: string;
};

function normalizeThreatLevel(level: string): ThreatLevel {
  if (level === ThreatLevel.CRITICAL) return ThreatLevel.CRITICAL;
  if (level === ThreatLevel.WARNING) return ThreatLevel.WARNING;
  if (level === ThreatLevel.NEEDS_REVIEW) return ThreatLevel.NEEDS_REVIEW;
  return ThreatLevel.INFO;
}

function proxyReportUrl(filePath: string): string {
  const filename = filePath.split("/").pop() ?? "";
  return `/api/reports/view/${encodeURIComponent(filename)}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { alertId?: string };
    const alertId = body.alertId?.trim();
    if (!alertId) {
      return Response.json({ ok: false, error: "alertId is required" }, { status: 400 });
    }

    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const alertsCol = await getCollection<AlertDoc>(COLLECTIONS.ALERTS);
    const alert = await alertsCol.findOne({ alertId });
    if (!alert) {
      return Response.json({ ok: false, error: "alert not found" }, { status: 404 });
    }

    const scoredSighting: ScoredSighting = {
      id: alert.id,
      source: alert.source,
      imageUrl: alert.imageUrl,
      lat: alert.lat,
      lng: alert.lng,
      observedAt: new Date(alert.observedAt),
      observerNotes: alert.observerNotes,
      species: alert.species,
      confidence: alert.confidence,
      invasive: alert.invasive,
      taxonId: alert.taxonId,
      needsReview: alert.needsReview,
      anomalyScore: alert.anomalyScore,
      threatLevel: normalizeThreatLevel(alert.threatLevel),
      iucnStatus: alert.iucnStatus,
      inRange: alert.inRange,
    };

    const { filePath, uploadedToS3 } = await generateReport([scoredSighting]);
    const reportUrl = uploadedToS3 ? proxyReportUrl(filePath) : undefined;

    const reportsCol = await getCollection<ReportInsert>(COLLECTIONS.REPORTS);
    const reportDoc: ReportInsert = {
      filePath,
      generatedAt: new Date(),
      species: alert.species,
      alertId,
      ...(reportUrl ? { reportUrl } : {}),
    };
    const insert = await reportsCol.insertOne(reportDoc);

    return Response.json({
      ok: true,
      reportId: insert.insertedId.toString(),
      filePath,
      species: alert.species,
      reportUrl,
    });
  } catch (err) {
    console.error("[reports/generate] unhandled error:", err instanceof Error ? err.stack : err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
