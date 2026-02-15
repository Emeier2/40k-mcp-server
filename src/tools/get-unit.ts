import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData } from "../data/types.js";
import { formatUnit } from "../utils/formatting.js";

export function registerGetUnit(server: McpServer, data: GameData) {
  server.registerTool(
    "get_unit",
    {
      description:
        "Get the full datasheet for a Warhammer 40k unit including stats, weapons, abilities, points, and keywords. Supports exact and partial name matching. Optionally filter by faction.",
      inputSchema: {
        name: z
          .string()
          .describe("Unit name or partial match (e.g. 'Intercessors', 'avatar')"),
        faction: z
          .string()
          .optional()
          .describe(
            "Filter by faction slug (e.g. 'space-marines', 'aeldari', 'necrons')"
          ),
      },
    },
    async ({ name, faction }) => {
      const query = name.toLowerCase().trim();
      let units = data.units;

      if (faction) {
        const fq = faction.toLowerCase();
        units = units.filter((u) => u.faction.toLowerCase() === fq);
        if (units.length === 0) {
          const factions = [...new Set(data.units.map((u) => u.faction))].sort();
          return {
            content: [
              {
                type: "text" as const,
                text: `No faction found matching "${faction}". Available factions:\n${factions.map((f) => `- ${f}`).join("\n")}`,
              },
            ],
          };
        }
      }

      // Exact match first
      const exact = units.find(
        (u) => u.name.toLowerCase() === query
      );
      if (exact) {
        return {
          content: [{ type: "text" as const, text: formatUnit(exact) }],
        };
      }

      // Partial match
      const matches = units.filter((u) =>
        u.name.toLowerCase().includes(query)
      );

      if (matches.length === 1) {
        return {
          content: [{ type: "text" as const, text: formatUnit(matches[0]) }],
        };
      }

      if (matches.length > 1) {
        const names = matches.map((u) => `- ${u.name} (${u.faction})`).join("\n");
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
      const suggestions = units
        .filter((u) => {
          const uName = u.name.toLowerCase();
          return query.split(" ").some((word) => uName.includes(word));
        })
        .slice(0, 5)
        .map((u) => `- ${u.name} (${u.faction})`)
        .join("\n");

      const scope = faction ? `${faction} units` : `all ${data.units.length} units`;
      const msg = suggestions
        ? `No unit found matching "${name}". Did you mean:\n${suggestions}`
        : `No unit found matching "${name}". There are ${units.length} ${scope} available.`;

      return {
        content: [{ type: "text" as const, text: msg }],
      };
    }
  );
}
