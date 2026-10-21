/**
 * Model choices, overridable per environment. Defaults are the cheapest models
 * that pass the evals (`pnpm eval`); the strong tier is only used when
 * deterministic checks on the cheap model's answer fail.
 */
export const models = {
  vision: process.env.VISION_MODEL ?? "anthropic/claude-haiku-5.5",
  visionStrong: process.env.VISION_MODEL_STRONG ?? "anthropic/claude-sonnet-5.5",
  chat: process.env.CHAT_MODEL ?? "anthropic/claude-haiku-5.5",
  // Changing the embedding model (or its size) needs `pnpm reindex`.
  embedding: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
};

/** Must match the vector size in the knowledge_chunks table. */
export const EMBEDDING_DIMENSIONS = 1536;
