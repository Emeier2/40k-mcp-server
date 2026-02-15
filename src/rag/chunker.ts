import type {
  GameData,
  Unit,
  Stratagem,
  Enhancement,
  Detachment,
  FactionRule,
  CoreRule,
} from "../data/types.js";

export interface Chunk {
  text: string;
  metadata: {
    type: "unit_overview" | "unit_weapons" | "unit_abilities" | "stratagem" | "enhancement" | "detachment_rule" | "faction_rule" | "unit_composition" | "core_rule";
    unitName?: string;
    detachment?: string;
    faction: string;
    source: string;
  };
}

function chunkUnit(unit: Unit): Chunk[] {
  const chunks: Chunk[] = [];
  const faction = unit.faction || "";

  // Overview chunk: name, stats, keywords, points
  const overviewParts = [
    `[Unit: ${unit.name}] (${faction})`,
    `Category: ${unit.unitCategory}`,
    `Stats: M ${unit.stats.M}, T ${unit.stats.T}, Sv ${unit.stats.Sv}, W ${unit.stats.W}, Ld ${unit.stats.Ld}, OC ${unit.stats.OC}`,
  ];
  if (unit.invulnerableSave) {
    overviewParts.push(`Invulnerable Save: ${unit.invulnerableSave}`);
  }
  overviewParts.push(
    `Points: ${unit.points.map((p) => `${p.models} models = ${p.points}pts`).join(", ")}`
  );
  overviewParts.push(`Keywords: ${unit.keywords.join(", ")}`);
  overviewParts.push(`Faction: ${unit.factionKeywords.join(", ")}`);

  chunks.push({
    text: overviewParts.join(". "),
    metadata: { type: "unit_overview", unitName: unit.name, faction, source: "units" },
  });

  // Weapons chunk
  if (unit.rangedWeapons.length > 0 || unit.meleeWeapons.length > 0) {
    const weaponParts = [`[Unit: ${unit.name}] Weapons:`];

    for (const w of unit.rangedWeapons) {
      weaponParts.push(
        `Ranged - ${w.name}: Range ${w.range}, A${w.A}, BS ${w.BS ?? "-"}, S${w.S}, AP${w.AP}, D${w.D}${w.keywords.length ? ` [${w.keywords.join(", ")}]` : ""}`
      );
    }
    for (const w of unit.meleeWeapons) {
      weaponParts.push(
        `Melee - ${w.name}: Range ${w.range}, A${w.A}, WS ${w.WS ?? "-"}, S${w.S}, AP${w.AP}, D${w.D}${w.keywords.length ? ` [${w.keywords.join(", ")}]` : ""}`
      );
    }

    chunks.push({
      text: weaponParts.join("\n"),
      metadata: { type: "unit_weapons", unitName: unit.name, faction, source: "units" },
    });
  }

  // Abilities chunk
  if (
    unit.abilities.core.length > 0 ||
    unit.abilities.faction.length > 0 ||
    unit.abilities.unit.length > 0
  ) {
    const abilityParts = [`[Unit: ${unit.name}] Abilities:`];

    if (unit.abilities.core.length > 0) {
      abilityParts.push(`Core: ${unit.abilities.core.join(", ")}`);
    }
    if (unit.abilities.faction.length > 0) {
      abilityParts.push(`Faction: ${unit.abilities.faction.join(", ")}`);
    }
    for (const ab of unit.abilities.unit) {
      abilityParts.push(`${ab.name}: ${ab.description}`);
    }

    chunks.push({
      text: abilityParts.join("\n"),
      metadata: {
        type: "unit_abilities",
        unitName: unit.name,
        faction,
        source: "units",
      },
    });
  }

  // Composition chunk (if it has leader or composition info)
  if (unit.composition.description || unit.leaderAttachableTo) {
    const compParts = [`[Unit: ${unit.name}] Composition and Leader Info:`];
    if (unit.composition.description) {
      compParts.push(`Composition: ${unit.composition.description}`);
    }
    if (unit.leaderAttachableTo && unit.leaderAttachableTo.length > 0) {
      compParts.push(
        `Can be attached to: ${unit.leaderAttachableTo.join(", ")}`
      );
    }
    if (unit.leader) {
      compParts.push(
        `Leader ability: ${unit.leader.name} - ${unit.leader.description}`
      );
    }

    chunks.push({
      text: compParts.join("\n"),
      metadata: {
        type: "unit_composition",
        unitName: unit.name,
        faction,
        source: "units",
      },
    });
  }

  return chunks;
}

function chunkStratagem(strat: Stratagem): Chunk {
  const parts = [
    `[Stratagem: ${strat.name}] (${strat.faction})`,
    `Detachment: ${strat.detachment}`,
    `Type: ${strat.type}`,
    `CP Cost: ${strat.cpCost}CP`,
    `WHEN: ${strat.when}`,
    `TARGET: ${strat.target}`,
    `EFFECT: ${strat.effect}`,
  ];
  if (strat.restrictions) {
    parts.push(`RESTRICTIONS: ${strat.restrictions}`);
  }

  return {
    text: parts.join("\n"),
    metadata: {
      type: "stratagem",
      detachment: strat.detachment,
      faction: strat.faction || "",
      source: "stratagems",
    },
  };
}

function chunkEnhancement(enh: Enhancement): Chunk {
  const parts = [
    `[Enhancement: ${enh.name}] (${enh.faction})`,
    `Detachment: ${enh.detachment}`,
    `Points Cost: ${enh.pointsCost}pts`,
  ];
  if (enh.restrictions) {
    parts.push(`Restrictions: ${enh.restrictions}`);
  }
  parts.push(`Effect: ${enh.effect}`);

  return {
    text: parts.join("\n"),
    metadata: {
      type: "enhancement",
      detachment: enh.detachment,
      faction: enh.faction || "",
      source: "enhancements",
    },
  };
}

function chunkDetachmentRule(detach: Detachment): Chunk {
  return {
    text: `[Detachment Rule: ${detach.name}] (${detach.faction}) ${detach.ruleName}: ${detach.ruleText}`,
    metadata: {
      type: "detachment_rule",
      detachment: detach.name,
      faction: detach.faction || "",
      source: "detachments",
    },
  };
}

function chunkFactionRule(rule: FactionRule): Chunk {
  return {
    text: `[Faction Rule: ${rule.name}] (${rule.faction}) ${rule.text}`,
    metadata: {
      type: "faction_rule",
      faction: rule.faction || "",
      source: "faction-rules",
    },
  };
}

function chunkCoreRule(rule: CoreRule): Chunk {
  return {
    text: `[Core Rule: ${rule.name}] ${rule.text}`,
    metadata: {
      type: "core_rule",
      faction: "",
      source: "core-rules",
    },
  };
}

export function generateAllChunks(data: GameData): Chunk[] {
  const chunks: Chunk[] = [];

  for (const unit of data.units) {
    chunks.push(...chunkUnit(unit));
  }

  for (const strat of data.stratagems) {
    chunks.push(chunkStratagem(strat));
  }

  for (const enh of data.enhancements) {
    chunks.push(chunkEnhancement(enh));
  }

  for (const detach of data.detachments) {
    chunks.push(chunkDetachmentRule(detach));
  }

  for (const rule of data.factionRules) {
    chunks.push(chunkFactionRule(rule));
  }

  for (const rule of data.coreRules) {
    chunks.push(chunkCoreRule(rule));
  }

  console.error(`Generated ${chunks.length} chunks`);
  return chunks;
}
