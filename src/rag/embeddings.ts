import type { FeatureExtractionPipeline } from "@huggingface/transformers";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    console.error("Loading embedding model (first run downloads ~80MB)...");
    const { pipeline } = await import("@huggingface/transformers");
    extractor = (await (pipeline as Function)(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "fp32" }
    )) as FeatureExtractionPipeline;
    console.error("Embedding model loaded.");
  }
  return extractor;
}

export async function embedText(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  const result = output.tolist();
  return result[0] as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const ext = await getExtractor();
  const results: number[][] = [];

  // Process in batches of 32 to avoid OOM
  const batchSize = 32;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const output = await ext(batch, { pooling: "mean", normalize: true });
    const list = output.tolist() as number[][];
    results.push(...list);

    if (texts.length > batchSize) {
      console.error(
        `  Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
      );
    }
  }

  return results;
}
