import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { ACCOUNT_FILE, AUTH_FILE, account, accountScript } from "./support";

setup("create a test account with the fictional network and sign in", async ({ page }) => {
  setup.setTimeout(180_000);
  mkdirSync(dirname(ACCOUNT_FILE), { recursive: true });
  accountScript("create");
  const { email, password } = account();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  // The bot check fills in its token once Cloudflare's script has run.
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Asha$/ })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
