import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./e2e/support";

// End-to-end tests against a production build of the app. AI responses are
// replayed from fixtures/ai, so a run costs nothing and gives the same answers
// every time; `pnpm test:e2e:record` refreshes those recordings with real models.
//
// Each run creates its own @example.com account with the fictional network,
// runs the flows on desktop and then phone-sized screens, and finally deletes
// the account through the app. Tests share that account and change its data,
// so they run one at a time, in order.

const PORT = 3200;
const AI_MODE = process.env.AI_MODE === "record" ? "record" : "mock";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The service worker caches build files; keep each test's network traffic plain.
    serviceWorkers: "block",
    permissions: ["microphone"],
    launchOptions: {
      // A fake microphone that plays a fictional voice note, for the voice note test.
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${path.resolve("fixtures/voice/promise-with-date.wav")}`,
      ],
    },
  },
  projects: [
    { name: "setup", testMatch: "setup.ts", teardown: "teardown" },
    { name: "teardown", testMatch: "teardown.ts" },
    {
      name: "desktop",
      testIgnore: ["account.spec.ts"],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
    {
      name: "phone",
      grep: /@phone/,
      testIgnore: ["account.spec.ts"],
      dependencies: ["desktop"],
      use: { ...devices["Pixel 7"], storageState: AUTH_FILE },
    },
    {
      // Deletes the account, so it goes last.
      name: "account",
      testMatch: "account.spec.ts",
      dependencies: ["phone"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `pnpm start -p ${PORT}` : `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: { AI_MODE },
    timeout: 300_000,
    reuseExistingServer: false,
  },
});
