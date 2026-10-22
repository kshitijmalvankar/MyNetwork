// Installs this repository's git hooks (they live in .git/hooks, so they stay
// on this machine and never reach GitHub):
//   pre-commit  blocks commits that contain anything that looks like a key
//   pre-push    runs the unit and end-to-end tests, and stops the push if any fail
// Skip a hook once with --no-verify, e.g. `git push --no-verify`.
//
//   pnpm hooks:install
import { chmodSync, writeFileSync } from "node:fs";

const hooks = {
  "pre-commit": `#!/bin/sh
pnpm -s secrets:check
`,
  "pre-push": `#!/bin/sh
# Tests the working copy, so commit or stash unfinished changes first.
# Skip once with: git push --no-verify
set -e
echo "pre-push: unit tests"
pnpm -s test
echo "pre-push: end-to-end tests (builds the app; takes a few minutes)"
pnpm -s test:e2e
`,
};

for (const [name, script] of Object.entries(hooks)) {
  writeFileSync(`.git/hooks/${name}`, script);
  chmodSync(`.git/hooks/${name}`, 0o755);
  console.log(`Installed .git/hooks/${name}`);
}
