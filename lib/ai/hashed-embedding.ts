import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/models";

/** FNV-1a: a fast, stable 32-bit string hash. */
function fnv1a(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A deterministic stand-in for a real embedding: each word adds +1 or -1 to
 * one of the dimensions it hashes to, and the vector is normalized. Texts that
 * share words end up close, which is enough for search to behave sensibly in
 * tests, at no cost and with identical results on every run.
 */
export function hashEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    const h = fnv1a(word);
    vector[h % dimensions] += h & 0x80000000 ? -1 : 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((x) => x / norm);
}

export function hashedEmbeddingModel(modelId: string): EmbeddingModelV4 {
  return {
    specificationVersion: "v4",
    provider: "local",
    modelId,
    maxEmbeddingsPerCall: 2048,
    supportsParallelCalls: true,
    async doEmbed({ values }) {
      return {
        embeddings: values.map((v) => hashEmbedding(v)),
        usage: { tokens: values.reduce((sum, v) => sum + Math.ceil(v.length / 4), 0) },
        warnings: [],
      };
    },
  };
}
