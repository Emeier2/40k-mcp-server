import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData } from "../data/types.js";
import { formatUnit } from "../utils/formatting.js";

export function registerGetUnit(server: McpServer, data: GameData) {
  server.registerTool(
    "get_unit",
    {
      description:
        "Get the full datasheet for a Warhammer 40k Aeldari unit including stats, weapons, abilities, points, and keywords. Supports exact and partial name matching.",
      inputSchema: {
        name: z
          .string()
          .describe("Unit name or partial match (e.g. 'Wraithguard', 'avatar')"),
      },
    },
    async ({ name }) => {
      const query = name.toLowerCase().trim();

      // Exact match first
      const exact = data.units.find(
        (u) => u.name.toLowerCase() === query
      );
      if (exact) {
        return {
          content: [{ type: "text" as const, text: formatUnit(exact) }],
        };
      }

      // Partial match
      const matches = data.units.filter((u) =>
        u.name.toLowerCase().includes(query)
      );

      if (matches.length === 1) {
        return {
          content: [{ type: "text" as const, text: formatUnit(matches[0]) }],
        };
      }

      if (matches.length > 1) {
        const names = matches.map((u) => `- ${u.name}`).join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple units match "${name}". Please be more specific:\n${names}`,
            },
          ],
        };
      }

      // No match - suggest similar names
      const suggestions = data.units
        .filter((u) => {
          const uName = u.name.toLowerCase();
          return query.split(" ").some((word) => uName.includes(word));
        })
        .slice(0, 5)
        .map((u) => `- ${u.name}`)
        .join("\n");

      const msg = suggestions
        ? `No unit found matching "${name}". Did you mean:\n${suggestions}`
        : `No unit found matching "${name}". There are ${data.units.length} Aeldari units available.`;

      return {
        content: [{ type: "text" as const, text: msg }],
      };
    }
  );
}
