export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { ReportDoc } from "../_shared";
import { stringifyId } from "../_shared";

function isLikelyObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!isLikelyObjectId(id)) {
      return Response.json({ error: "report not found" }, { status: 404 });
    }

    const { ObjectId } = await import("mongodb");
    const { getCollection, COLLECTIONS } = await import("@rangerai/shared/db");
    const col = await getCollection<ReportDoc>(COLLECTIONS.REPORTS);
    const report = await col.findOne({ _id: new ObjectId(id) });
    if (!report) {
      return Response.json({ error: "report not found" }, { status: 404 });
    }

    return Response.json({
      ...report,
      _id: stringifyId(report._id),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
