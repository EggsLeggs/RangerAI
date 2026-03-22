import type { ObjectId } from "mongodb";

export type ReportDoc = {
  _id: ObjectId;
  filePath: string;
  generatedAt: Date | string;
  species: string;
  alertId?: string;
  reportUrl?: string;
};

export function stringifyId(id: unknown): string {
  if (typeof id === "string") return id;
  if (
    id &&
    typeof id === "object" &&
    "toString" in id &&
    typeof (id as { toString: () => string }).toString === "function"
  ) {
    return (id as { toString: () => string }).toString();
  }
  return "";
}
