import { loadAllData } from "../src/data/loader.js";
import { generateAllChunks } from "../src/rag/chunker.js";
import { buildIndex } from "../src/rag/vector-store.js";

async function main() {
  console.error("Loading game data...");
  const data = await loadAllData();

  console.error("Generating chunks...");
  const chunks = generateAllChunks(data);

  console.error("Building vector index...");
  await buildIndex(chunks);

  console.error("Done! Index built successfully.");
}

main().catch((error) => {
  console.error("Error building index:", error);
  process.exit(1);
});
