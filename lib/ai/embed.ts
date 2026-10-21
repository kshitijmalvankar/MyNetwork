import "server-only";
import { embed, embedMany } from "ai";
import { costOf, embeddingModel } from "@/lib/ai/client";
import type { UsageEntry } from "@/lib/ai/metering";
import { EMBEDDING_DIMENSIONS, models } from "@/lib/ai/models";

const BATCH = 64;

function check(vectors: number[][]) {
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMENSIONS) throw new Error(`Embedding has ${v.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return vectors;
}

/** Embeds texts in batches. Returns vectors in input order plus metering entries. */
export async function embedTexts(texts: string[], feature: UsageEntry["feature"] = "ask") {
  const embeddings: number[][] = [];
  const usage: UsageEntry[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const started = Date.now();
    const result = await embedMany({ model: embeddingModel(models.embedding), values: texts.slice(i, i + BATCH), maxRetries: 2 });
    embeddings.push(...check(result.embeddings));
    usage.push({
      feature,
      model: models.embedding,
      inputTokens: result.usage.tokens,
      outputTokens: 0,
      costUsd: costOf(result),
      latencyMs: Date.now() - started,
    });
  }
  return { embeddings, usage };
}

export async function embedQuery(text: string) {
  const started = Date.now();
  const result = await embed({ model: embeddingModel(models.embedding), value: text, maxRetries: 2 });
  const [embedding] = check([result.embedding]);
  const usage: UsageEntry = {
    feature: "ask",
    model: models.embedding,
    inputTokens: result.usage.tokens,
    outputTokens: 0,
    costUsd: costOf(result),
    latencyMs: Date.now() - started,
  };
  return { embedding, usage };
}

/** pgvector's text format, which PostgREST casts to `vector`. */
export const toPgVector = (v: number[]) => `[${v.join(",")}]`;
