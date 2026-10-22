import { expect, test, type Page } from "@playwright/test";

/**
 * Follows the main navigation the way a person would: the rail's icons on
 * desktop (its labels only show once it opens), the dock on phones, and the
 * More sheet for sections that aren't in the dock.
 */
async function go(page: Page, isMobile: boolean, name: string) {
  const nav = page.getByRole("navigation", { name: "Primary" }).filter({ visible: true });
  const link = nav.getByRole("link", { name, exact: true });
  if (isMobile && (await link.count()) === 0) {
    await nav.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog").getByRole("link", { name, exact: true }).click();
    return;
  }
  await link.click({ position: { x: 20, y: 20 } });
}

test("moves between the main sections @phone", async ({ page, isMobile }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /, Asha$/ })).toBeVisible();

  await go(page, isMobile, "Contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await go(page, isMobile, "Ask");
  await expect(page.getByLabel("Your question")).toBeVisible();
  await go(page, isMobile, "Graph");
  await expect(page.getByRole("heading", { level: 1, name: "Graph" })).toBeVisible();
  await go(page, isMobile, "Home");
  await expect(page).toHaveURL(/\/home$/);
});

test("opens search from the navigation and jumps to a person @phone", async ({ page, isMobile }) => {
  await page.goto("/home");
  if (isMobile) {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Search people…" }).click();
  } else {
    await page.keyboard.press("ControlOrMeta+k");
  }
  const search = page.getByRole("dialog", { name: "Search" });
  await search.getByPlaceholder("Search people, companies, pages…").fill("Priya");
  await search.getByRole("option", { name: /Priya Shah/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Priya Shah" })).toBeVisible();
});
