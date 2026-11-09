import { expect, test } from "@playwright/test";
import { eventually, openContact } from "./support";

test("lists your network and finds people by search @phone", async ({ page }) => {
  await page.goto("/contacts");
  await expect(page.getByRole("link", { name: /Priya Shah/ }).first()).toBeVisible();
  await page.getByLabel("Search contacts").fill("Cobalt");
  await expect(page.getByRole("link", { name: /Rahul Desai/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Priya Shah/ })).toHaveCount(0);
  await expect(page.getByLabel("Search contacts")).toBeFocused();
});

test("carries a person's avatar and name into their profile and back @phone", async ({ page }) => {
  // The pseudo-elements only exist mid-transition, so note them as each one starts.
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { viewTransitions: seen });
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((...args: Parameters<typeof start>) => {
      const transition = start(...args);
      transition.ready.then(
        () => seen.push(document.getAnimations().map((a) => (a.effect as KeyframeEffect).pseudoElement).join(" ")),
        () => {},
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
  const lastTransition = () => page.evaluate(() => (window as unknown as { viewTransitions: string[] }).viewTransitions.at(-1) ?? "");

  await page.goto("/contacts");
  await page.getByRole("link", { name: /Priya Shah/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Priya Shah" })).toBeVisible();
  await expect.poll(lastTransition).toContain("person-avatar-");
  expect(await lastTransition()).toContain("person-name-");

  await page.getByRole("main").getByRole("link", { name: "Contacts", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await expect.poll(lastTransition).toContain("person-avatar-");
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

test("records who introduced whom, and finds former colleagues from a past job", async ({ page }) => {
  await openContact(page, "Priya Shah");
  const connections = page.locator('[data-slot="card"]', { hasText: "Connections" });

  await connections.getByRole("button", { name: "Add connection" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search your contacts").fill("Rahul");
  await dialog.getByRole("button", { name: /Rahul Desai/ }).click();
  await dialog.getByLabel("Rahul introduced you to Priya").check();
  await dialog.getByRole("button", { name: "Connect" }).click();
  await expect(connections.getByText("Introduced you to Priya")).toBeVisible();
  await expect(connections.getByRole("link", { name: /Rahul Desai/ })).toBeVisible();

  // It shows on Rahul's profile too, read from his side.
  await connections.getByRole("link", { name: /Rahul Desai/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rahul Desai" })).toBeVisible();
  await expect(page.getByText("Rahul introduced you to Priya")).toBeVisible();

  // A past job at Bluefin links Priya to the people there now.
  await page.getByRole("main").getByRole("link", { name: "Contacts", exact: true }).click();
  await openContact(page, "Priya Shah");
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("button", { name: "Add a past job" }).click();
  await page.getByLabel("Past company").fill("Bluefin Analytics Ltd");
  await page.getByLabel("Past job title").fill("Data Analyst");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(connections.getByText("Worked together")).toBeVisible();
  await expect(connections.getByRole("link", { name: /Tom Becker/ })).toBeVisible();
  await expect(connections.getByText("Now at Bluefin Analytics, where Priya used to work").first()).toBeVisible();
});
