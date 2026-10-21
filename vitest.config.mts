import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside the React server runtime; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: process.env.VITEST_EVAL ? ["evals/**/*.eval.ts"] : process.env.VITEST_DB ? ["tests/db/**/*.db.test.ts"] : ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**", ...(process.env.VITEST_DB ? [] : ["tests/db/**"])],
    env: {
      APP_MASTER_KEY: Buffer.alloc(32, 1).toString("base64"),
      APP_MASTER_KEY_VERSION: "1",
      APP_BLIND_INDEX_KEY: Buffer.alloc(32, 2).toString("base64"),
    },
  },
});
