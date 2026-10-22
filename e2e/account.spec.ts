import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { account } from "./support";

// Runs after every other test, because the last one deletes the account.

async function confirmItsYou(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("Password", { exact: true }).fill(account().password);
  await expect(dialog.locator('input[name="captchaToken"]')).not.toHaveValue("");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toBeHidden();
}

test("shows what this month's tests used of the allowance", async ({ page }) => {
  await page.goto("/settings/usage");
  const meter = (label: string) => page.getByRole("listitem").filter({ hasText: label });
  await expect(meter("Card scans")).toContainText("1 of 50 scans");
  await expect(meter("Questions in Ask")).toContainText("1 of 150 questions");
  await expect(meter("Voice note minutes")).toContainText("1 of 30 minutes");
  await expect(meter("Briefs, drafts and summaries")).toContainText("2 of 20 uses");
});

test("downloads your contacts as a spreadsheet after confirming it's you", async ({ page }) => {
  await page.goto("/settings/data");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = page.waitForEvent("download");
  await confirmItsYou(page);
  const csv = readFileSync(await (await download).path(), "utf8");
  expect(csv.split("\n")[0]).toContain("Name,");
  expect(csv).toContain("Priya Shah");
  expect(csv).toContain("priya.shah@northwind-robotics.example");
  expect(csv).toContain("Ananya Rao");
});

test("deletes the account and everything in it", async ({ page }) => {
  await page.goto("/settings/data");
  await page.getByRole("button", { name: "Delete account" }).click();
  await confirmItsYou(page);

  const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
  await expect(dialog.getByRole("button", { name: "Delete everything" })).toBeDisabled();
  await dialog.getByLabel(/to confirm/).fill("delete");
  await dialog.getByRole("button", { name: "Delete everything" }).click();

  await page.waitForURL("**/login?notice=account-deleted", { timeout: 30_000 });
  await expect(page.getByText("Your account and everything in it have been deleted.")).toBeVisible();
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});
