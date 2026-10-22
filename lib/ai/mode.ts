/**
 * How AI calls are served:
 * - live: real models through OpenRouter (the default, and the only mode allowed on Vercel)
 * - record: real models, with every response saved to fixtures/ai for replay
 * - mock: saved responses only, so end-to-end tests are free and repeatable
 * In record and mock modes, embeddings come from a local word-hashing model.
 */
export type AiMode = "live" | "record" | "mock";

export function aiMode(): AiMode {
  const mode = process.env.AI_MODE ?? "live";
  if (mode !== "live" && mode !== "record" && mode !== "mock") throw new Error(`AI_MODE must be live, record or mock (got "${mode}")`);
  if (mode !== "live" && process.env.VERCEL) throw new Error("AI_MODE must be live on Vercel");
  return mode;
}
