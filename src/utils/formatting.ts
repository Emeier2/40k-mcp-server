import type { Unit, Weapon, Stratagem, Enhancement } from "../data/types.js";

export function formatUnit(unit: Unit): string {
  const lines: string[] = [];

  lines.push(`# ${unit.name}`);
  lines.push(`**Category:** ${unit.unitCategory} | **Faction:** ${unit.factionKeywords.join(", ")}`);
  lines.push("");

  // Stats
  lines.push("## Stats");
  const stats = unit.stats;
  lines.push(
    `| M | T | Sv | W | Ld | OC |`
  );
  lines.push(`|---|---|---|---|---|---|`);
  lines.push(
    `| ${stats.M} | ${stats.T} | ${stats.Sv} | ${stats.W} | ${stats.Ld} | ${stats.OC} |`
  );
  if (unit.invulnerableSave) {
    lines.push(`**Invulnerable Save:** ${unit.invulnerableSave}`);
  }
  lines.push("");

  // Ranged Weapons
  if (unit.rangedWeapons.length > 0) {
    lines.push("## Ranged Weapons");
    lines.push(formatWeaponsTable(unit.rangedWeapons, "BS"));
    lines.push("");
  }

  // Melee Weapons
  if (unit.meleeWeapons.length > 0) {
    lines.push("## Melee Weapons");
    lines.push(formatWeaponsTable(unit.meleeWeapons, "WS"));
    lines.push("");
  }

  // Abilities
  lines.push("## Abilities");
  if (unit.abilities.core.length > 0) {
    lines.push(`**Core:** ${unit.abilities.core.join(", ")}`);
  }
  if (unit.abilities.faction.length > 0) {
    lines.push(`**Faction:** ${unit.abilities.faction.join(", ")}`);
  }
  for (const ab of unit.abilities.unit) {
    lines.push(`- **${ab.name}:** ${ab.description}`);
  }
  lines.push("");

  // Points
  if (unit.points.length > 0) {
    lines.push("## Points");
    for (const p of unit.points) {
      lines.push(`- ${p.models} model${p.models > 1 ? "s" : ""}: ${p.points} pts`);
    }
    lines.push("");
  }

  // Composition
  if (unit.composition.description) {
    lines.push("## Composition");
    lines.push(unit.composition.description);
    lines.push("");
  }

  // Keywords
  lines.push(`**Keywords:** ${unit.keywords.join(", ")}`);

  // Leader info
  if (unit.leaderAttachableTo && unit.leaderAttachableTo.length > 0) {
    lines.push(`**Can lead:** ${unit.leaderAttachableTo.join(", ")}`);
  }

  // Contextual analysis
  lines.push("");
  lines.push("## Quick Reference");
  const minPts = unit.points.length > 0 ? Math.min(...unit.points.map(p => p.points)) : 0;
  const minModels = unit.points.length > 0 ? unit.points.find(p => p.points === minPts)?.models ?? 1 : 1;
  const wounds = typeof unit.stats.W === "string" ? parseInt(unit.stats.W) : unit.stats.W;
  if (minPts > 0 && !isNaN(wounds)) {
    const totalWounds = wounds * minModels;
    lines.push(`- **Points per wound:** ${(minPts / totalWounds).toFixed(1)} pts/W (${minModels} models, ${totalWounds}W total)`);
  }
  const roles: string[] = [];
  if (unit.keywords.some(k => k.toUpperCase() === "BATTLELINE")) roles.push("Battleline");
  if (unit.keywords.some(k => k.toUpperCase() === "CHARACTER")) roles.push("Character");
  if (unit.keywords.some(k => k.toUpperCase() === "EPIC HERO")) roles.push("Epic Hero (unique)");
  if (unit.abilities.core.some(a => a.toLowerCase().includes("deep strike"))) roles.push("Deep Strike");
  if (unit.abilities.core.some(a => a.toLowerCase().includes("leader"))) roles.push("Leader");
  if (unit.abilities.core.some(a => a.toLowerCase().includes("scouts"))) roles.push("Scouts");
  if (unit.abilities.core.some(a => a.toLowerCase().includes("lone operative"))) roles.push("Lone Operative");
  if (roles.length > 0) {
    lines.push(`- **Roles:** ${roles.join(", ")}`);
  }

  return lines.join("\n");
}

function formatWeaponsTable(
  weapons: Weapon[],
  skillType: "BS" | "WS"
): string {
  const lines: string[] = [];
  lines.push(
    `| Weapon | Range | A | ${skillType} | S | AP | D | Keywords |`
  );
  lines.push(`|--------|-------|---|---|---|---|---|----------|`);
  for (const w of weapons) {
    const skill = skillType === "BS" ? w.BS ?? "-" : w.WS ?? "-";
    const kw = w.keywords.length > 0 ? w.keywords.join(", ") : "-";
    lines.push(
      `| ${w.name} | ${w.range} | ${w.A} | ${skill} | ${w.S} | ${w.AP} | ${w.D} | ${kw} |`
    );
  }
  return lines.join("\n");
}

export function formatUnitComparison(a: Unit, b: Unit): string {
  const lines: string[] = [];

  lines.push(`# Comparison: ${a.name} vs ${b.name}`);
  lines.push("");

  // Stats comparison
  lines.push("## Stats");
  lines.push(`| Stat | ${a.name} | ${b.name} |`);
  lines.push(`|------|${"-".repeat(a.name.length + 2)}|${"-".repeat(b.name.length + 2)}|`);

  const statKeys = ["M", "T", "Sv", "W", "Ld", "OC"] as const;
  for (const key of statKeys) {
    const aVal = a.stats[key];
    const bVal = b.stats[key];
    lines.push(`| ${key} | ${aVal} | ${bVal} |`);
  }

  lines.push(
    `| Invuln | ${a.invulnerableSave ?? "None"} | ${b.invulnerableSave ?? "None"} |`
  );
  lines.push("");

  // Points comparison
  const aMinPts = a.points.length > 0 ? Math.min(...a.points.map((p) => p.points)) : 0;
  const bMinPts = b.points.length > 0 ? Math.min(...b.points.map((p) => p.points)) : 0;
  lines.push("## Points");
  lines.push(`- ${a.name}: ${a.points.map((p) => `${p.models} models = ${p.points} pts`).join(", ")}`);
  lines.push(`- ${b.name}: ${b.points.map((p) => `${p.models} models = ${p.points} pts`).join(", ")}`);
  lines.push("");

  // Weapons summary
  lines.push("## Weapons");
  lines.push(`**${a.name}:**`);
  for (const w of [...a.rangedWeapons, ...a.meleeWeapons]) {
    lines.push(`  - ${w.name}: ${w.range} A${w.A} ${w.BS ?? w.WS ?? ""} S${w.S} AP${w.AP} D${w.D}`);
  }
  lines.push(`**${b.name}:**`);
  for (const w of [...b.rangedWeapons, ...b.meleeWeapons]) {
    lines.push(`  - ${w.name}: ${w.range} A${w.A} ${w.BS ?? w.WS ?? ""} S${w.S} AP${w.AP} D${w.D}`);
  }
  lines.push("");

  // Abilities summary
  lines.push("## Abilities");
  lines.push(`**${a.name}:** ${a.abilities.unit.map((ab) => ab.name).join(", ") || "None"}`);
  lines.push(`**${b.name}:** ${b.abilities.unit.map((ab) => ab.name).join(", ") || "None"}`);
  lines.push("");

  // Keywords
  lines.push("## Keywords");
  lines.push(`**${a.name}:** ${a.keywords.join(", ")}`);
  lines.push(`**${b.name}:** ${b.keywords.join(", ")}`);

  return lines.join("\n");
}

export function formatStratagem(strat: Stratagem): string {
  const lines: string[] = [];
  lines.push(`**${strat.name}** (${strat.cpCost}CP) — ${strat.type}`);
  lines.push(`*Detachment: ${strat.detachment}*`);
  lines.push(`**WHEN:** ${strat.when}`);
  lines.push(`**TARGET:** ${strat.target}`);
  lines.push(`**EFFECT:** ${strat.effect}`);
  if (strat.restrictions) {
    lines.push(`**RESTRICTIONS:** ${strat.restrictions}`);
  }
  return lines.join("\n");
}

export function formatEnhancement(enh: Enhancement): string {
  const lines: string[] = [];
  lines.push(`**${enh.name}** (${enh.pointsCost} pts)`);
  lines.push(`*Detachment: ${enh.detachment}*`);
  if (enh.restrictions) {
    lines.push(`*Restrictions: ${enh.restrictions}*`);
  }
  lines.push(enh.effect);
  return lines.join("\n");
}
