import { expect, test } from "@playwright/test";
import { eventually } from "./support";

test("reads a card, then saves it to your contacts after review", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/scan");
  await page.getByRole("tab", { name: "Many cards" }).click();
  await page.getByRole("tabpanel").locator('input[type="file"]').setInputFiles("fixtures/cards/01-english-qr-front.png");
  await page.getByRole("button", { name: "Upload 1 card" }).click();
  await expect(page.getByText("1 of 1 uploaded")).toBeVisible({ timeout: 30_000 });

  // The card is read in the background; the queue updates when it's ready.
  await page.getByRole("link", { name: "Review cards" }).click();
  await page.waitForURL("**/review");
  const card = page.getByRole("link", { name: /Ananya Rao/ });
  await eventually(page, () => expect(card).toBeVisible({ timeout: 3_000 }), 45_000);
  await card.click();

  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ananya Rao");
  await expect(page.getByLabel("Job title")).toHaveValue("Senior Software Engineer");
  await expect(page.getByLabel("Email")).toHaveValue("ananya.rao@xyztech.example");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByText("Saved Ananya Rao")).toBeVisible();

  await page.goto("/contacts");
  await page.getByLabel("Search contacts").fill("Ananya");
  await expect(page.getByRole("link", { name: /Ananya Rao/ }).first()).toBeVisible();
});
