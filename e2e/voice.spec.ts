import { expect, test } from "@playwright/test";
import { eventually, openContact, recording } from "./support";

test("records a voice note, transcribes it and suggests the promised follow-up", async ({ page }) => {
  test.setTimeout(90_000);
  await openContact(page, "Rahul Desai");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

  // The fake microphone plays a recorded note (about 14 seconds). When recording
  // AI responses the model has to hear all of it; replays don't listen at all.
  await page.waitForTimeout(recording ? 16_000 : 2_000);
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByText(/demo video/i).first()).toBeVisible({ timeout: 45_000 });
  await eventually(page, () => expect(page.getByText("Suggested follow-ups")).toBeVisible({ timeout: 2_000 }));
});
