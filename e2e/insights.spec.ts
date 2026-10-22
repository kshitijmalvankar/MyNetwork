import { expect, test } from "@playwright/test";

test("charts your network and writes a short summary @phone", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await expect(page.getByText("AI summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Companies you know best")).toBeVisible();
  await expect(page.getByRole("link", { name: /Northwind Robotics/ })).toBeVisible();
});

test("maps your network and lists the people on it @phone", async ({ page }) => {
  await page.goto("/graph");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("tab", { name: "List" }).click();
  await expect(page.getByText("Priya Shah").first()).toBeVisible();
});
