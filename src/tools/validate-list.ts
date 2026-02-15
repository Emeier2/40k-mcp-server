import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GameData, Unit } from "../data/types.js";

export function registerValidateList(server: McpServer, data: GameData) {
  server.registerTool(
    "validate_list",
    {
      description:
        "Validate an Aeldari army list against points limits and basic army construction rules. Checks total points, identifies unknown units, and reports constraint violations.",
      inputSchema: {
        units: z
          .array(
            z.object({
              name: z.string().describe("Unit name"),
              count: z.number().describe("Number of models/unit size"),
            })
          )
          .describe("List of units in the army"),
        pointsLimit: z
          .number()
          .default(2000)
          .describe("Maximum points allowed (default 2000)"),
      },
    },
    async ({ units: listUnits, pointsLimit }) => {
      const issues: string[] = [];
      const warnings: string[] = [];
      let totalPoints = 0;
      const resolvedUnits: Array<{ name: string; points: number; unit: Unit }> = [];

      for (const entry of listUnits) {
        const query = entry.name.toLowerCase().trim();
        const unit = data.units.find(
          (u) =>
            u.name.toLowerCase() === query ||
            u.name.toLowerCase().includes(query)
        );

        if (!unit) {
          issues.push(`Unknown unit: "${entry.name}"`);
          continue;
        }

        // Find the correct points cost for the given model count
        const pointsOption = unit.points.find((p) => p.models === entry.count);
        if (pointsOption) {
          totalPoints += pointsOption.points;
          resolvedUnits.push({
            name: unit.name,
            points: pointsOption.points,
            unit,
          });
        } else if (unit.points.length > 0) {
          // Use closest match or minimum
          const closest =
            unit.points.find((p) => p.models >= entry.count) ??
            unit.points[unit.points.length - 1];
          totalPoints += closest.points;
          resolvedUnits.push({
            name: unit.name,
            points: closest.points,
            unit,
          });
          const validSizes = unit.points
            .map((p) => `${p.models} (${p.points}pts)`)
            .join(", ");
          warnings.push(
            `${unit.name}: ${entry.count} models doesn't match available sizes: ${validSizes}. Used ${closest.models} models (${closest.points}pts).`
          );
        }
      }

      // Check points limit
      const pointsOk = totalPoints <= pointsLimit;

      // Check for EPIC HERO duplicates
      const epicHeroes = resolvedUnits.filter((u) =>
        u.unit.keywords.some(
          (k) => k.toUpperCase() === "EPIC HERO"
        )
      );
      const heroNames = epicHeroes.map((u) => u.name);
      const duplicateHeroes = heroNames.filter(
        (name, i) => heroNames.indexOf(name) !== i
      );
      if (duplicateHeroes.length > 0) {
        issues.push(
          `Duplicate EPIC HERO units (only one of each allowed): ${[...new Set(duplicateHeroes)].join(", ")}`
        );
      }

      // Build result
      const lines: string[] = [];
      lines.push("# Army List Validation");
      lines.push("");
      lines.push(`**Total Points:** ${totalPoints} / ${pointsLimit}`);
      lines.push(
        `**Status:** ${pointsOk ? "VALID" : "OVER LIMIT"} (${pointsOk ? "within" : `${totalPoints - pointsLimit} points over`} limit)`
      );
      lines.push("");

      lines.push("## Units");
      for (const u of resolvedUnits) {
        lines.push(`- ${u.name}: ${u.points} pts`);
      }
      lines.push("");

      if (issues.length > 0) {
        lines.push("## Issues");
        for (const issue of issues) {
          lines.push(`- ${issue}`);
        }
        lines.push("");
      }

      if (warnings.length > 0) {
        lines.push("## Warnings");
        for (const w of warnings) {
          lines.push(`- ${w}`);
        }
        lines.push("");
      }

      if (issues.length === 0 && warnings.length === 0 && pointsOk) {
        lines.push("No issues found. List appears valid.");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
