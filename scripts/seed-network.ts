// Loads a fictional network into a local test account, replacing that
// account's contacts, companies, events and chats, then indexes it for Ask.
// Refuses any account that isn't on a reserved example domain.
//
//   pnpm seed:network            the 32 people in fixtures/network.json, into E2E_TEST_EMAIL (for the Ask eval)
//   pnpm seed:network --large    about 500 generated people, into E2E_TEST_EMAIL with "+network" added
import { largeNetwork } from "./seed/large-network";
import { daysSinceFixture, findTestAccount, largeNetworkEmail, seedNetwork } from "./seed/network";

async function main() {
  const large = process.argv.includes("--large");
  const testEmail = process.env.E2E_TEST_EMAIL ?? "";
  const email = large ? largeNetworkEmail(testEmail) : testEmail;
  const userId = await findTestAccount(email);
  if (!userId) throw new Error(`No test account for ${email}. Run \`pnpm seed:dev\` first.`);
  // The large network's dates follow today, so it always looks current; the small one stays fixed for the eval.
  const result = await seedNetwork(userId, large ? { fixture: largeNetwork().fixture, shiftDays: daysSinceFixture() } : {});
  console.log(`Seeded ${result.contacts} contacts, ${result.companies} companies and ${result.events} events.`);
  console.log(`Indexed ${result.indexed} items for Ask${result.failed ? `, ${result.failed} failed` : ""}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
