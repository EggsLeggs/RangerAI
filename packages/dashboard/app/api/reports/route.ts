export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { ReportDoc } from "./_shared";
import { stringifyId } from "./_shared";

export async function GET() {
  try {
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection<ReportDoc>(COLLECTIONS.REPORTS);
    const reports = await col.find({ reportUrl: { $exists: true, $ne: "" } }).sort({ generatedAt: -1 }).limit(200).toArray();
    return Response.json({
      reports: reports.map((r) => ({
        ...r,
        _id: stringifyId(r._id),
      })),
      total: reports.length,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
