/**
 * Model choices, overridable per environment. Defaults are the cheapest models
 * that pass the extraction eval (`pnpm eval`); the strong tier is only used
 * when deterministic checks on the cheap model's answer fail.
 */
export const models = {
  vision: process.env.VISION_MODEL ?? "anthropic/claude-haiku-5.5",
  visionStrong: process.env.VISION_MODEL_STRONG ?? "anthropic/claude-sonnet-5.5",
};
