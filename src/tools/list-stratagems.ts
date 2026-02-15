import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData } from "../data/types.js";
import { formatStratagem } from "../utils/formatting.js";

export function registerListStratagems(server: McpServer, data: GameData) {
  server.registerTool(
    "list_stratagems",
    {
      description:
        "List Aeldari stratagems, optionally filtered by detachment, type, or keyword search. Returns stratagem names, CP costs, timing, targets, and effects.",
      inputSchema: {
        detachment: z
          .string()
          .optional()
          .describe(
            "Filter by detachment name (e.g. 'Warhost', 'Aspect Host')"
          ),
        type: z
          .string()
          .optional()
          .describe(
            "Filter by stratagem type (e.g. 'Battle Tactic', 'Strategic Ploy', 'Epic Deed')"
          ),
        keyword: z
          .string()
          .optional()
          .describe("Search stratagem text for a keyword"),
      },
    },
    async ({ detachment, type, keyword }) => {
      let results = [...data.stratagems];

      if (detachment) {
        const dq = detachment.toLowerCase();
        results = results.filter((s) =>
          s.detachment.toLowerCase().includes(dq)
        );
      }

      if (type) {
        const tq = type.toLowerCase();
        results = results.filter((s) => s.type.toLowerCase().includes(tq));
      }

      if (keyword) {
        const kq = keyword.toLowerCase();
        results = results.filter(
          (s) =>
            s.name.toLowerCase().includes(kq) ||
            s.when.toLowerCase().includes(kq) ||
            s.target.toLowerCase().includes(kq) ||
            s.effect.toLowerCase().includes(kq)
        );
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No stratagems found matching the given filters. There are ${data.stratagems.length} total stratagems across all detachments.`,
            },
          ],
        };
      }

      const formatted = results.map(formatStratagem).join("\n\n---\n\n");
      const header = `Found ${results.length} stratagem${results.length > 1 ? "s" : ""}:\n\n`;

      return {
        content: [{ type: "text" as const, text: header + formatted }],
      };
    }
  );
}
