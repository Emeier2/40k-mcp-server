import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData, Unit } from "../data/types.js";
import { formatUnitComparison } from "../utils/formatting.js";

function findUnit(units: Unit[], query: string): Unit | string {
  const q = query.toLowerCase().trim();
  const exact = units.find((u) => u.name.toLowerCase() === q);
  if (exact) return exact;

  const matches = units.filter((u) => u.name.toLowerCase().includes(q));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return `Multiple units match "${query}": ${matches.map((u) => u.name).join(", ")}`;
  }
  return `No unit found matching "${query}"`;
}

export function registerCompareUnits(server: McpServer, data: GameData) {
  server.registerTool(
    "compare_units",
    {
      description:
        "Compare two Warhammer 40k units side-by-side, showing stats, weapons, abilities, and points differences. Works across all factions.",
      inputSchema: {
        unit_a: z.string().describe("First unit name"),
        unit_b: z.string().describe("Second unit name"),
      },
    },
    async ({ unit_a, unit_b }) => {
      const resultA = findUnit(data.units, unit_a);
      const resultB = findUnit(data.units, unit_b);

      if (typeof resultA === "string") {
        return { content: [{ type: "text" as const, text: resultA }] };
      }
      if (typeof resultB === "string") {
        return { content: [{ type: "text" as const, text: resultB }] };
      }

      const comparison = formatUnitComparison(resultA, resultB);
      return { content: [{ type: "text" as const, text: comparison }] };
    }
  );
}
