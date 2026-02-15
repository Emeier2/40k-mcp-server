import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData } from "../data/types.js";
import { queryIndex, isIndexReady } from "../rag/vector-store.js";

export function registerSearchRules(server: McpServer, _data: GameData) {
  server.registerTool(
    "search_rules",
    {
      description:
        "Semantic search over all Warhammer 40k rules, unit data, stratagems, enhancements, and abilities across all factions. Uses vector embeddings for natural language queries like 'best anti-tank weapons' or 'units that can deep strike'.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Natural language search query about rules, units, or abilities"
          ),
        type: z
          .enum([
            "all",
            "unit_overview",
            "unit_weapons",
            "unit_abilities",
            "stratagem",
            "enhancement",
            "detachment_rule",
            "faction_rule",
            "core_rule",
          ])
          .optional()
          .describe("Filter results to a specific type"),
        faction: z
          .string()
          .optional()
          .describe(
            "Filter results to a specific faction (e.g. 'space-marines', 'necrons')"
          ),
        limit: z
          .number()
          .min(1)
          .max(20)
          .default(5)
          .describe("Number of results to return (default 5)"),
      },
    },
    async ({ query, type, faction, limit }) => {
      if (!(await isIndexReady())) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Vector index not built. The server administrator needs to run 'npm run build-index' first.",
            },
          ],
        };
      }

      const typeFilter = type && type !== "all" ? type : undefined;
      let results = await queryIndex(query, limit ?? 5, typeFilter);

      // Post-filter by faction if specified
      if (faction) {
        const fq = faction.toLowerCase();
        results = results.filter(
          (r) => r.metadata.faction === fq || r.metadata.faction === ""
        );
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No results found for "${query}". Try a different query or remove filters.`,
            },
          ],
        };
      }

      const lines: string[] = [];
      lines.push(`## Search Results for "${query}"`);
      lines.push(`Found ${results.length} results:\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const score = (r.score * 100).toFixed(1);
        const factionLabel = r.metadata.faction
          ? ` | Faction: ${r.metadata.faction}`
          : "";
        lines.push(
          `### ${i + 1}. [${r.metadata.type}] (${score}% match)${factionLabel}`
        );
        if (r.metadata.unitName) {
          lines.push(`**Unit:** ${r.metadata.unitName}`);
        }
        if (r.metadata.detachment) {
          lines.push(`**Detachment:** ${r.metadata.detachment}`);
        }
        lines.push(r.text);
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
