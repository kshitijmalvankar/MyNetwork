import { expect, test } from "@playwright/test";
import { openContact } from "./support";

test("writes a meeting brief and saves it to notes", async ({ page }) => {
  await openContact(page, "Priya Shah");
  await page.getByRole("button", { name: "Brief me" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Brief: Priya" })).toBeVisible();
  await sheet.getByRole("button", { name: "Save to notes" }).click({ timeout: 30_000 });
  await expect(sheet.getByRole("button", { name: "Saved" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("Saved brief")).toBeVisible();
});

test("drafts a follow-up to check and send yourself", async ({ page }) => {
  await openContact(page, "Priya Shah");
  await page.getByRole("button", { name: "Draft follow-up" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Follow up with Priya" })).toBeVisible();
  await sheet.getByLabel("What should it say? (optional)").fill("Thank her for the chat and share our pick-and-place case study");
  await sheet.getByRole("button", { name: "Write draft" }).click();

  await expect(sheet.getByText("AI draft · check it, then send it yourself")).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByLabel("Message")).not.toBeEmpty();
  await expect(sheet.getByLabel("Message")).toContainText("Priya");
});
