import { readMcpPort } from "@rangerwatch/shared/mcp-port";
import { startCivicMcpServer } from "./server.js";

export { inspectPayloadForInjection } from "./injection.js";
export { audit_log } from "./server.js";
export { startCivicMcpServer } from "./server.js";

if (import.meta.main) {
  const port = readMcpPort();
  startCivicMcpServer(port);
}
