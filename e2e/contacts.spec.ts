import { expect, test } from "@playwright/test";
import { eventually, openContact } from "./support";

test("lists your network and finds people by search @phone", async ({ page }) => {
  await page.goto("/contacts");
  await expect(page.getByRole("link", { name: /Priya Shah/ }).first()).toBeVisible();
  await page.getByLabel("Search contacts").fill("Cobalt");
  await expect(page.getByRole("link", { name: /Rahul Desai/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Priya Shah/ })).toHaveCount(0);
});

test("adds a note and suggests the follow-up promised in it", async ({ page }) => {
  await openContact(page, "Daniel Okafor");
  const note = "Great chat about their robot fleet. I promised to send Daniel our pick-and-place benchmark report by Friday.";
  await page.getByPlaceholder(/Add a note/).fill(note);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText(note)).toBeVisible();

  // Follow-ups are spotted in the background after the note is saved.
  await eventually(page, async () => {
    await expect(page.getByText("Suggested follow-ups")).toBeVisible({ timeout: 2_000 });
  });
  await expect(page.getByText(/benchmark report/i).last()).toBeVisible();
});

test("adds a follow-up and marks it done", async ({ page }) => {
  await openContact(page, "Mei Lin");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByPlaceholder("What to follow up about (optional)").fill("Send the design system notes");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const item = page.getByRole("listitem").filter({ hasText: "Send the design system notes" });
  await expect(item.getByText("Today")).toBeVisible();
  await item.getByRole("checkbox", { name: "Mark done" }).click();
  await expect(item.getByRole("checkbox", { name: "Mark done" })).toBeChecked();
  await expect(item.getByText("Today")).toBeHidden();
});
