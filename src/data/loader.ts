import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  GameData,
  Unit,
  Stratagem,
  Enhancement,
  Detachment,
  FactionRule,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");

async function loadJsonFile<T>(filename: string): Promise<T> {
  const filepath = join(DATA_DIR, filename);
  const content = await readFile(filepath, "utf-8");
  return JSON.parse(content) as T;
}

export async function loadAllData(): Promise<GameData> {
  const [units, stratagems, enhancements, detachments, factionRules] =
    await Promise.all([
      loadJsonFile<Unit[]>("units.json"),
      loadJsonFile<Stratagem[]>("stratagems.json"),
      loadJsonFile<Enhancement[]>("enhancements.json"),
      loadJsonFile<Detachment[]>("detachments.json"),
      loadJsonFile<FactionRule[]>("faction-rules.json"),
    ]);

  console.error(
    `Loaded: ${units.length} units, ${stratagems.length} stratagems, ` +
      `${enhancements.length} enhancements, ${detachments.length} detachments, ` +
      `${factionRules.length} faction rules`
  );

  return { units, stratagems, enhancements, detachments, factionRules };
}
