import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("the landing page, privacy policy and terms are public @phone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Never lose a business card");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
});

test("signed-out visitors are sent to sign in @phone", async ({ page }) => {
  await page.goto("/contacts");
  await expect(page).toHaveURL(/\/login\?next=%2Fcontacts$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("sign-up links to the terms and privacy policy", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: "terms", exact: true })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "privacy policy", exact: true })).toHaveAttribute("href", "/privacy");
});
