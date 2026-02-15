import { LocalIndex } from "vectra";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { embedText, embedBatch } from "./embeddings.js";
import type { Chunk } from "./chunker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_DIR = join(__dirname, "..", "..", "data", "index");

let index: LocalIndex | null = null;

function getIndex(): LocalIndex {
  if (!index) {
    index = new LocalIndex(INDEX_DIR);
  }
  return index;
}

export interface ChunkMetadata {
  [key: string]: string;
  text: string;
  type: string;
  unitName: string;
  detachment: string;
  source: string;
}

export async function buildIndex(chunks: Chunk[]): Promise<void> {
  const idx = getIndex();

  if (await idx.isIndexCreated()) {
    await idx.deleteIndex();
  }

  await idx.createIndex({
    version: 1,
    metadata_config: {
      indexed: ["type"],
    },
  });

  console.error(`Generating embeddings for ${chunks.length} chunks...`);
  const texts = chunks.map((c) => c.text);
  const vectors = await embedBatch(texts);

  console.error("Inserting into vector index...");
  await idx.beginUpdate();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await idx.insertItem({
      vector: vectors[i],
      metadata: {
        text: chunk.text,
        type: chunk.metadata.type,
        unitName: chunk.metadata.unitName ?? "",
        detachment: chunk.metadata.detachment ?? "",
        source: chunk.metadata.source,
      } satisfies ChunkMetadata,
    });
  }

  await idx.endUpdate();
  console.error(`Index built with ${chunks.length} items.`);
}

export interface SearchResult {
  text: string;
  score: number;
  metadata: ChunkMetadata;
}

export async function queryIndex(
  query: string,
  topK: number = 5,
  typeFilter?: string
): Promise<SearchResult[]> {
  const idx = getIndex();

  if (!(await idx.isIndexCreated())) {
    throw new Error(
      "Vector index not found. Run 'npm run build-index' first."
    );
  }

  const queryVector = await embedText(query);

  const filter = typeFilter ? { type: { $eq: typeFilter } } : undefined;
  const results = await idx.queryItems<ChunkMetadata>(
    queryVector,
    query,
    topK,
    filter
  );

  return results.map((r) => ({
    text: r.item.metadata.text,
    score: r.score,
    metadata: r.item.metadata,
  }));
}

export async function isIndexReady(): Promise<boolean> {
  const idx = getIndex();
  return idx.isIndexCreated();
}
