import { existsSync } from "node:fs";
import { test as teardown } from "@playwright/test";
import { ACCOUNT_FILE, accountScript } from "./support";

// The last test deletes the account through the app. This catches runs that
// stopped before then, so no test account is ever left behind.
teardown("delete the test account if it's still there", () => {
  if (existsSync(ACCOUNT_FILE)) accountScript("delete");
});
