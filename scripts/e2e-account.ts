// The throwaway account an end-to-end test run signs in with. Run by the
// Playwright setup and teardown, with AI_MODE=mock or record so the network is
// indexed with local embeddings.
//
//   tsx scripts/e2e-account.ts create <file>   new account with the fictional network; details go to <file>
//   tsx scripts/e2e-account.ts delete <file>   delete that account and everything in it, if it still exists
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { deleteAccountData } from "@/lib/account/delete";
import { aiMode } from "@/lib/ai/mode";
import { adminClient } from "@/lib/supabase/admin";
import { daysSinceFixture, findTestAccount, seedNetwork } from "./seed/network";

export type E2eAccount = { email: string; password: string; userId: string };

async function create(file: string) {
  if (aiMode() === "live") throw new Error("Run with AI_MODE=mock or AI_MODE=record, so test data never gets real embeddings.");
  const email = `e2e-run-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Asha Rao" } });
  if (error) throw error;
  const account: E2eAccount = { email, password, userId: data.user.id };
  writeFileSync(file, JSON.stringify(account), { mode: 0o600 });

  // A fixed time zone and region keep prompts the same wherever the tests run.
  const { error: profileError } = await db.from("profiles").update({ timezone: "Asia/Kolkata", phone_region: "IN" }).eq("id", account.userId);
  if (profileError) throw profileError;
  const seeded = await seedNetwork(account.userId, { shiftDays: daysSinceFixture() });
  if (seeded.failed) throw new Error(`${seeded.failed} item(s) failed to index`);
  console.log(`Created ${email} with ${seeded.contacts} contacts.`);
}

async function remove(file: string) {
  const { email } = JSON.parse(readFileSync(file, "utf8")) as E2eAccount;
  const userId = await findTestAccount(email);
  if (!userId) return console.log(`${email} is already gone.`);
  const result = await deleteAccountData(userId);
  if (!result.ok) throw new Error(`Couldn't delete ${email} (${result.step})`);
  console.log(`Deleted ${email}.`);
}

const [command, file] = process.argv.slice(2);
if (!file || (command !== "create" && command !== "delete")) {
  console.error("Usage: tsx scripts/e2e-account.ts create|delete <file>");
  process.exit(1);
}
(command === "create" ? create(file) : remove(file)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
