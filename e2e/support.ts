import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** The signed-in browser state every test starts from. */
export const AUTH_FILE = "playwright/.auth/state.json";
/** This run's throwaway account. */
export const ACCOUNT_FILE = "playwright/.auth/account.json";

export type Account = { email: string; password: string; userId: string };
export const account = (): Account => JSON.parse(readFileSync(ACCOUNT_FILE, "utf8")) as Account;

/** True when recording AI responses: then the voice note has to capture the whole spoken fixture. */
export const recording = process.env.AI_MODE === "record";

/** Runs scripts/e2e-account.ts, which needs the server-side code and .env.local. */
export function accountScript(command: "create" | "delete") {
  execFileSync("pnpm", ["exec", "tsx", "--conditions=react-server", "--env-file=.env.local", "scripts/e2e-account.ts", command, ACCOUNT_FILE], {
    stdio: "inherit",
    env: { ...process.env, AI_MODE: "mock" },
  });
}

/** Opens a contact from the contacts list. */
export async function openContact(page: Page, name: string) {
  await page.goto("/contacts");
  await page.getByLabel("Search contacts").fill(name);
  // The search applies after a short pause by updating the address; clicking
  // before then would have that update cancel the navigation.
  await page.waitForURL(/[?&]q=/);
  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/**
 * Some work happens in the background after a response (follow-up
 * suggestions, card reading). Reloads until `check` passes.
 */
export async function eventually(page: Page, check: () => Promise<void>, timeout = 30_000) {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout, intervals: [1_000, 2_000, 3_000] });
}
