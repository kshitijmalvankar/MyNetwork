import { expect, test } from "@playwright/test";

test("answers from your network, links to the people and keeps the chat", async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("Your question").fill("Who do I know at Northwind Robotics?");
  await page.getByRole("button", { name: "Send" }).click();

  // The answer links each person it mentions to their contact page.
  const priya = page.getByRole("link", { name: "Priya Shah" }).first();
  await expect(priya).toBeVisible({ timeout: 30_000 });
  await expect(priya).toHaveAttribute("href", /^\/contacts\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Show on graph" })).toBeVisible();

  // Once answered, the chat gets its own address and is saved.
  await page.waitForURL(/\/ask\/[0-9a-f-]{36}$/);
  await page.reload();
  // Once in the conversation, and once as its title in the list of past chats.
  await expect(page.getByText("Who do I know at Northwind Robotics?").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Priya Shah" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Priya Shah" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Priya Shah" })).toBeVisible();
});
