import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { publicEnv } from "@/lib/env";

let provider: ReturnType<typeof createOpenRouter> | undefined;

function openrouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  provider ??= createOpenRouter({
    apiKey,
    headers: { "HTTP-Referer": publicEnv.siteUrl, "X-Title": "MyNetwork" },
  });
  return provider;
}

/**
 * Every model goes through here so routing is always private: only
 * zero-data-retention endpoints, no training on our data, and only providers
 * that honour every requested parameter (e.g. structured output).
 * The account-level ZDR toggle on OpenRouter is a second, independent guard.
 */
export function chatModel(modelId: string) {
  return openrouter()(modelId, {
    provider: { zdr: true, data_collection: "deny", require_parameters: true },
    usage: { include: true },
  });
}

/** Embeddings get the same private routing as chat models. */
export function embeddingModel(modelId: string) {
  return openrouter().textEmbeddingModel(modelId, {
    extraBody: { provider: { zdr: true, data_collection: "deny" }, usage: { include: true } },
  });
}

/** OpenRouter's billed cost for a call, in USD. */
export function costOf(result: { providerMetadata?: Record<string, unknown> }): number {
  const meta = result.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined;
  return Number(meta?.usage?.cost ?? 0);
}
