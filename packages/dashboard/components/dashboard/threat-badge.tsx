import { Badge } from "../ui/badge";

const THREAT_VARIANT: Record<string, "critical" | "warning" | "info" | "needs_review"> = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
  NEEDS_REVIEW: "needs_review",
};

export function ThreatBadge({ level }: { level: string }) {
  return (
    <Badge variant={THREAT_VARIANT[level] ?? "default"}>
      {level}
    </Badge>
  );
}
