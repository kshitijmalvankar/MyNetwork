// Regenerates the synthetic voice-note fixtures in fixtures/voice with the
// macOS `say` and `afconvert` tools. The content is fictional.
//   node scripts/make-voice-fixtures.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtures = JSON.parse(readFileSync("fixtures/voice/expected.json", "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "voice-"));
try {
  for (const f of fixtures) {
    const aiff = join(tmp, `${f.id}.aiff`);
    execFileSync("say", ["-v", f.voice, "-o", aiff, f.script]);
    // Mono AAC at 32 kbps: the same format and bitrate the app records in.
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", aiff, `fixtures/voice/${f.id}.m4a`]);
    console.log(`fixtures/voice/${f.id}.m4a`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
