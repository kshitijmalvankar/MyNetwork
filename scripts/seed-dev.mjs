// Creates (or removes, with --clean) the local test account defined by
// E2E_TEST_EMAIL / E2E_TEST_PASSWORD in .env.local. Only touches accounts on
// reserved example domains, so it is safe to run against the shared project.
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret, E2E_TEST_EMAIL: email, E2E_TEST_PASSWORD: password } =
  process.env;
const TEST_DOMAIN = /@example\.(com|org|net)$/i;

if (!url || !secret || !email || !password) {
  console.error("Missing Supabase or E2E_TEST_* variables in .env.local");
  process.exit(1);
}
if (!TEST_DOMAIN.test(email)) {
  console.error("E2E_TEST_EMAIL must use a reserved example domain (example.com/org/net).");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findTestUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    found.push(...data.users.filter((u) => u.email && TEST_DOMAIN.test(u.email)));
    if (data.users.length < 200) break;
  }
  return found;
}

if (process.argv.includes("--clean")) {
  const users = await findTestUsers();
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw error;
  }
  console.log(`Removed ${users.length} test account(s).`);
} else {
  const existing = (await findTestUsers()).find((u) => u.email === email.toLowerCase());
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
    console.log("Test account already exists; password reset to the one in .env.local.");
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Test User" },
    });
    if (error) throw error;
    console.log("Created confirmed test account (see E2E_TEST_EMAIL in .env.local).");
  }
}
