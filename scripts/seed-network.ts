// Loads the fictional network in fixtures/network.json into the local test
// account (E2E_TEST_EMAIL), replacing that account's contacts, companies,
// events and chats, then indexes it for Ask. Refuses any account that isn't on
// a reserved example domain.
//
//   pnpm seed:network
import { findTestAccount, seedNetwork } from "./seed/network";

async function main() {
  const userId = await findTestAccount(process.env.E2E_TEST_EMAIL ?? "");
  if (!userId) throw new Error("Test account not found. Run `pnpm seed:dev` first.");
  const result = await seedNetwork(userId);
  console.log(`Seeded ${result.contacts} contacts, ${result.companies} companies and ${result.events} events.`);
  console.log(`Indexed ${result.indexed} items for Ask${result.failed ? `, ${result.failed} failed` : ""}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
