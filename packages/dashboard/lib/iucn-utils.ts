export const IUCN_COLORS: Record<string, string> = {
  CR: "#A84E2A",
  EN: "#B86F0A",
  VU: "#d4820a",
  NT: "#4a7c5a",
  LC: "#4a7c5a",
  DD: "#9A9790",
  EX: "#5c2020",
  EW: "#7a3030",
};

export const IUCN_DEFAULT_COLOR = "#9A9790";

export function iucnColor(status: string | null): string {
  if (!status) return IUCN_DEFAULT_COLOR;
  return IUCN_COLORS[status] ?? IUCN_DEFAULT_COLOR;
}

export const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "#A84E2A",
  WARNING: "#B86F0A",
  INFO: "#4a7c5a",
  NEEDS_REVIEW: "#9A9790",
};
