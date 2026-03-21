const DEFAULT_MCP_PORT = 3001;

/** MCP HTTP port only; does not load other env vars (safe for lightweight clients). */
export function readMcpPort(): number {
  const raw = process.env.MCP_PORT?.trim();
  if (!raw) {
    return DEFAULT_MCP_PORT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `invalid MCP_PORT "${raw}". expected an integer in range 1-65535.`
    );
  }

  return parsed;
}
