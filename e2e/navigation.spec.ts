import { expect, test } from "@playwright/test";

test("moves between the main sections @phone", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /, Asha$/ })).toBeVisible();

  // The sidebar on desktop and the bottom bar on phones use the same names.
  const nav = (name: string) => page.getByRole("link", { name, exact: true }).filter({ visible: true }).first();
  await nav("Contacts").click();
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await nav("Ask").click();
  await expect(page.getByLabel("Your question")).toBeVisible();
  await nav("Graph").click();
  await expect(page.getByRole("heading", { level: 1, name: "Graph" })).toBeVisible();
  await nav("Home").click();
  await expect(page).toHaveURL(/\/home$/);
});
