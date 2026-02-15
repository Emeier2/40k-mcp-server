import { readFile, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  GameData,
  Unit,
  Stratagem,
  Enhancement,
  Detachment,
  FactionRule,
  CoreRule,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");

async function loadJsonFile<T>(filepath: string): Promise<T> {
  const content = await readFile(filepath, "utf-8");
  return JSON.parse(content) as T;
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await stat(filepath);
    return true;
  } catch {
    return false;
  }
}

async function getFactionDirs(): Promise<string[]> {
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== "index")
    .map((e) => e.name);
}

async function loadFactionData(faction: string): Promise<{
  units: Unit[];
  stratagems: Stratagem[];
  enhancements: Enhancement[];
  detachments: Detachment[];
  factionRules: FactionRule[];
}> {
  const dir = join(DATA_DIR, faction);

  const [units, stratagems, enhancements, detachments, factionRules] =
    await Promise.all([
      loadJsonFile<Unit[]>(join(dir, "units.json")).catch(() => []),
      loadJsonFile<Stratagem[]>(join(dir, "stratagems.json")).catch(() => []),
      loadJsonFile<Enhancement[]>(join(dir, "enhancements.json")).catch(
        () => []
      ),
      loadJsonFile<Detachment[]>(join(dir, "detachments.json")).catch(() => []),
      loadJsonFile<FactionRule[]>(join(dir, "faction-rules.json")).catch(
        () => []
      ),
    ]);

  // Inject faction field into items that may not have it from older data
  for (const u of units) u.faction = u.faction || faction;
  for (const s of stratagems) s.faction = s.faction || faction;
  for (const e of enhancements) e.faction = e.faction || faction;
  for (const d of detachments) d.faction = d.faction || faction;
  for (const r of factionRules) r.faction = r.faction || faction;

  return { units, stratagems, enhancements, detachments, factionRules };
}

export async function loadAllData(): Promise<GameData> {
  const factionDirs = await getFactionDirs();

  const allUnits: Unit[] = [];
  const allStratagems: Stratagem[] = [];
  const allEnhancements: Enhancement[] = [];
  const allDetachments: Detachment[] = [];
  const allFactionRules: FactionRule[] = [];

  // Load all factions in parallel
  const factionResults = await Promise.all(
    factionDirs.map((faction) => loadFactionData(faction))
  );

  for (const result of factionResults) {
    allUnits.push(...result.units);
    allStratagems.push(...result.stratagems);
    allEnhancements.push(...result.enhancements);
    allDetachments.push(...result.detachments);
    allFactionRules.push(...result.factionRules);
  }

  // Load core rules if available
  const coreRulesPath = join(DATA_DIR, "core-rules.json");
  const coreRules = (await fileExists(coreRulesPath))
    ? await loadJsonFile<CoreRule[]>(coreRulesPath)
    : [];

  console.error(
    `Loaded ${factionDirs.length} factions: ` +
      `${allUnits.length} units, ${allStratagems.length} stratagems, ` +
      `${allEnhancements.length} enhancements, ${allDetachments.length} detachments, ` +
      `${allFactionRules.length} faction rules, ${coreRules.length} core rules`
  );

  return {
    units: allUnits,
    stratagems: allStratagems,
    enhancements: allEnhancements,
    detachments: allDetachments,
    factionRules: allFactionRules,
    coreRules,
  };
}
