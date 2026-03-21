import { config } from "dotenv";
config(); // must run before any process.env reads

import { readMcpPort } from "@rangerai/shared/mcp-port";
import { initSdk } from "./inspect.js";
import { startCivicMCP } from "./server.js";

export { startCivicMCP } from "./server.js";

export async function startCivicMcpServer(): Promise<void> {
  await initSdk();
  const port = readMcpPort();
  startCivicMCP(port);
}

if (import.meta.main) {
  await startCivicMcpServer();
}
