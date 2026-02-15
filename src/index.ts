import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAllData } from "./data/loader.js";
import type { GameData } from "./data/types.js";
import { registerGetUnit } from "./tools/get-unit.js";
import { registerListStratagems } from "./tools/list-stratagems.js";
import { registerCompareUnits } from "./tools/compare-units.js";
import { registerValidateList } from "./tools/validate-list.js";
import { registerSearchRules } from "./tools/search-rules.js";

const server = new McpServer({
  name: "40k-mcp-server",
  version: "1.0.0",
});

async function main() {
  const data = await loadAllData();

  registerGetUnit(server, data);
  registerListStratagems(server, data);
  registerCompareUnits(server, data);
  registerValidateList(server, data);
  registerSearchRules(server, data);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("40k MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
