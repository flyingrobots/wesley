⚠️ Outside diff range comments (1)
scripts/preflight.mjs (1)
133-160: ---

Remove redundant root package.json addition at line 145.

Your pnpm ls -r --json --depth=-1 output confirms the root package (/home/jailuser/git) is already included in the list as the first entry. The explicit packageJsonPaths.add(resolve('package.json')) on line 145 is redundant—you're checking root twice. While Sets handle deduplication so it's not broken, it's wasteful.

The verification also confirms all workspace packages (including wesley-website at root level) are correctly discovered through entry.path. No issues with missing or undefined paths.

Remove line 145.

##############################################

♻️ Duplicate comments (1)
scripts/serve-static.mjs (1)
26-29: Root path is broken by absolute join; you’re serving 403 forever. Fix it.

Using join(root, '/index.html') discards root, fail-streaks the startsWith(root) check, and your smoke never loads. Strip the leading slash and sanitize the request path.

Apply this surgical diff:

-  const url = (req.url || '/').split('?')[0];
-  const filePath = resolve(join(root, url === '/' ? '/index.html' : url));
+  const url = (req.url || '/').split('?')[0];
+  const clean = decodeURIComponent(url).replace(/^\/+/, '');
+  const rel = clean === '' ? 'index.html' : clean;
+  const filePath = resolve(join(root, rel));
BunBun.

##############################################

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Deduplicate apt-get noise across jobs (optional).

It’s fine, but you can shave seconds by installing bats/jq once in a composite action or reuse a reusable workflow.

BunBun.

Also applies to: 31-41, 55-60

🤖 Prompt for AI Agents
.github/workflows/runtime-smokes.yml lines 15-25 (also applies to 31-41 and
55-60): duplicate apt-get install of bats and jq across multiple jobs adds CI
overhead; extract that installation into a reusable step by creating a composite
action or a reusable workflow that runs apt-get update && apt-get install -y
bats jq once, then reference that composite/reusable workflow in each job, or
move the install into a shared job that other jobs depend on, ensuring the
package install runs only once and jobs consume the prepared environment.
@flyingrobots	Reply...

##############################################

packages/wesley-host-node/README.md
Comment on lines +3 to +4
Status: Active  
![pkg-host-node](https://github.com/flyingrobots/wesley/actions/workflows/pkg-host-node.yml/badge.svg?branch=main)
@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Trim trailing whitespace on status line.

Line 3 contains trailing spaces. Recommend a cleanup pass across all README status lines to remove trailing whitespace. This file is in the active host-node package (not core), so style enforcement is less critical, but consistency is good practice.

🤖 Prompt for AI Agents
In packages/wesley-host-node/README.md around lines 3 to 4, the status line on
line 3 has trailing whitespace; remove the trailing spaces at the end of that
line (and optionally scan other README status/badge lines in this repo for
trailing whitespace), save the file, and commit the cleanup.
@flyingrobots	Reply...

##############################################

packages/wesley-slaps/README.md
Comment on lines +3 to +4
Status: Active  
![pkg-slaps](https://github.com/flyingrobots/wesley/actions/workflows/pkg-slaps.yml/badge.svg?branch=main)

##############################################

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Minor: Trailing whitespace on status line.

Line 3 contains trailing spaces after "Status: Active". While this doesn't affect functionality, it's good practice to trim trailing whitespace to maintain consistent code quality.

🤖 Prompt for AI Agents
In packages/wesley-slaps/README.md around lines 3 to 4, the "Status: Active"
line contains trailing whitespace; remove the extra spaces at the end of the
line so it ends immediately after "Status: Active" to keep the file tidy and
consistent.
@flyingrobots	Reply...

##############################################

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Remove the useless lint ignore.

You've got // deno-lint-ignore-file no-explicit-any but there's not a single any type in this entire file. Did you copy-paste this from somewhere and forget to clean it up? Delete it.

-// deno-lint-ignore-file no-explicit-any
-// Deno smoke: import @wesley/core via import map and exercise a tiny bit
+// Deno smoke: import @wesley/core via import map and exercise a tiny bit
BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
// deno-lint-ignore-file no-explicit-any
// Deno smoke: import @wesley/core via import map and exercise a tiny bit
🤖 Prompt for AI Agents
In scripts/deno_smoke.ts around line 1, remove the unnecessary top-of-file
directive "// deno-lint-ignore-file no-explicit-any" since the file contains no
usages of the any type; simply delete that comment line so linter configuration
is not misleading or overly permissive.
@flyingrobots	Reply...

##############################################

scripts/host_contracts_bun.mjs
Comment on lines +1 to +5
#!/usr/bin/env bun
import { runAll } from '../test/contracts/host-contracts.mjs';

const res = await runAll();
console.log(JSON.stringify(res));

##############################################

@coderabbitai coderabbitai bot 4 days ago
⚠️ Potential issue | 🟠 Major

Third time's the charm? Nope, still no error handling

You've now written this same buggy pattern three times. No error handling, no exit code management. At least Bun has process.exit like Node, so the fix is identical.

Add error handling:

 #!/usr/bin/env bun
 import { runAll } from '../test/contracts/host-contracts.mjs';
 
-const res = await runAll();
-console.log(JSON.stringify(res));
+
try {
  const res = await runAll();
  console.log(JSON.stringify(res));
  process.exit(res.failed > 0 ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ passed: 0, failed: 1, error: String(err) }));
  process.exit(1);
}
And seriously, stop copy-pasting code without fixing the bugs in it.

BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
#!/usr/bin/env bun
import { runAll } from '../test/contracts/host-contracts.mjs';
const res = await runAll();
console.log(JSON.stringify(res));
#!/usr/bin/env bun
import { runAll } from '../test/contracts/host-contracts.mjs';
try {
  const res = await runAll();
  console.log(JSON.stringify(res));
  process.exit(res.failed > 0 ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ passed: 0, failed: 1, error: String(err) }));
  process.exit(1);
}
🤖 Prompt for AI Agents
In scripts/host_contracts_bun.mjs around lines 1 to 5, the script awaits
runAll() with no error handling or exit-code management; wrap the await in a
try/catch, log the caught error (including stack/message) to stderr
(console.error), and call process.exit(1) on failure so the process returns a
non-zero exit code; on success either call process.exit(0) or let the script
exit normally after printing the JSON result.
@flyingrobots	Reply...

##############################################

scripts/host_contracts_deno.ts
Comment on lines +1 to +5
// deno run --config deno.json -A scripts/host_contracts_deno.ts
import { runAll } from "../test/contracts/host-contracts.mjs";

const res = await runAll();
console.log(JSON.stringify(res));

##############################################

@coderabbitai coderabbitai bot 4 days ago
⚠️ Potential issue | 🟠 Major

Same lack of error handling as the Node version

You're making the exact same mistake here. No error handling, no exit code management. And this is Deno, so you should be using Deno.exit() instead of relying on implicit behavior.

Add proper error handling for Deno:

 // deno run --config deno.json -A scripts/host_contracts_deno.ts
 import { runAll } from "../test/contracts/host-contracts.mjs";
 
-const res = await runAll();
-console.log(JSON.stringify(res));
+
try {
  const res = await runAll();
  console.log(JSON.stringify(res));
  Deno.exit(res.failed > 0 ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ passed: 0, failed: 1, error: String(err) }));
  Deno.exit(1);
}
BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
// deno run --config deno.json -A scripts/host_contracts_deno.ts
import { runAll } from "../test/contracts/host-contracts.mjs";
const res = await runAll();
console.log(JSON.stringify(res));
// deno run --config deno.json -A scripts/host_contracts_deno.ts
import { runAll } from "../test/contracts/host-contracts.mjs";
try {
  const res = await runAll();
  console.log(JSON.stringify(res));
  Deno.exit(res.failed > 0 ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ passed: 0, failed: 1, error: String(err) }));
  Deno.exit(1);
}
🤖 Prompt for AI Agents
In scripts/host_contracts_deno.ts around lines 1 to 5, the script lacks error
handling and explicit exit-code management for Deno; wrap the await runAll()
call in a try/catch, call console.log/console.error appropriately, and on error
call Deno.exit(1) with a non-zero code while on success call Deno.exit(0) (or
let it exit 0 explicitly) so failures are propagated to the caller.
@flyingrobots	Reply...

##############################################

scripts/host_contracts_deno.ts
@@ -0,0 +1,6 @@
// deno run --config deno.json -A scripts/host_contracts_deno.ts
@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Why is this a .ts file with zero TypeScript?

You're using a .ts extension but there are literally no type annotations. What's the point? Either add types or rename this to .mjs to stop confusing people.

If you want to use TypeScript properly:

-// deno run --config deno.json -A scripts/host_contracts_deno.ts
-import { runAll } from "../test/contracts/host-contracts.mjs";
+// import type { ContractResults } from "../test/contracts/host-contracts.mjs";
+// import { runAll } from "../test/contracts/host-contracts.mjs";
+
+// const res: ContractResults = await runAll();
+import { runAll } from "../test/contracts/host-contracts.mjs";
+
+const res = await runAll();
 console.log(JSON.stringify(res));
Or just rename it to .mjs and be honest about it.

BunBun

Committable suggestion skipped: line range outside the PR's diff.

🤖 Prompt for AI Agents
In scripts/host_contracts_deno.ts around lines 1 to 1, the file is named .ts but
contains no TypeScript types; either add proper TypeScript annotations (declare
interfaces/types for inputs/outputs, annotate function parameters and return
types, and enable anyStrict/tsconfig checks) or rename the file to a JS module
(e.g., scripts/host_contracts_deno.mjs or .js), update the run command and
documentation to use node (or remove deno-specific flags), and adjust any import
paths or tooling config accordingly so file extension and runtime match (pick
one: convert to typed .ts with annotations for Deno, or rename to .mjs and stop
pretending it’s TypeScript).
@flyingrobots	Reply...

##############################################

scripts/host_contracts_node.mjs
Comment on lines +1 to +5
#!/usr/bin/env node
import { runAll } from '../test/contracts/host-contracts.mjs';

const res = await runAll();
console.log(JSON.stringify(res));

@coderabbitai coderabbitai bot 4 days ago
🛠️ Refactor suggestion | 🟠 Major

Blatant code duplication across runtime scripts

This exact same pattern exists in host_contracts_deno.ts and host_contracts_bun.mjs. Three copies of essentially identical code. Did you forget about DRY or are we writing enterprise Java now?

Consider creating a shared test harness module that all three runtimes can import, or at least document why this duplication is intentional (if there's actually a good reason).

BunBun

##############################################

⚠️ Potential issue | 🟠 Major

Zero error handling and exit code management

What happens when runAll() throws? The script crashes with an uncaught exception and might not even set a proper exit code. You're building test infrastructure here - this needs to be bulletproof.

Add proper error handling:

 #!/usr/bin/env node
 import { runAll } from '../test/contracts/host-contracts.mjs';
 
-const res = await runAll();
-console.log(JSON.stringify(res));
+
try {
  const res = await runAll();
  console.log(JSON.stringify(res));
  process.exit(res.failed > 0 ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ passed: 0, failed: 1, error: String(err) }));
  process.exit(1);
}
BunBun

🤖 Prompt for AI Agents
In scripts/host_contracts_node.mjs lines 1-5, the script uses top-level await
but lacks error handling so an exception from runAll() will crash the process
without a controlled exit code; wrap the call in a try/catch (or an
immediately-invoked async function) that awaits runAll(), logs successful
results to stdout, and in the catch logs the error to stderr (including
error.stack or JSON), sets process.exitCode = 1 (or calls process.exit(1)) and
exits cleanly so test runners get a non-zero status.
@flyingrobots	Reply...

##############################################

scripts/serve-static.mjs
Comment on lines +16 to +22
const contentType = (file) => ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json'
})[extname(file)] || 'application/octet-stream';

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Use the correct JS MIME.

Serve .js as application/javascript to avoid weird content-type checks.

-  '.js': 'text/javascript; charset=utf-8',
+  '.js': 'application/javascript; charset=utf-8',
BunBun.

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
const contentType = (file) => ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json'
})[extname(file)] || 'application/octet-stream';
const contentType = (file) => ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json'
})[extname(file)] || 'application/octet-stream';
🤖 Prompt for AI Agents
In scripts/serve-static.mjs around lines 16 to 22, the MIME mapping serves .js
as "text/javascript; charset=utf-8" which should be "application/javascript;
charset=utf-8"; update the '.js' entry in the contentType map to use
"application/javascript; charset=utf-8" so JS files are served with the correct
MIME type for browsers and strict content-type checks.
@flyingrobots	Reply...

##############################################

scripts/serve-static.mjs
Comment on lines +34 to +38
    res.writeHead(200, { 'content-type': contentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e?.message || e));
  }

@coderabbitai coderabbitai bot 4 days ago
⚠️ Potential issue | 🟡 Minor

Don’t dump internal error messages to clients.

Leaking exception messages/paths is sloppy, even in CI. Return a generic 500; log the real error server-side.

-    res.writeHead(500); res.end(String(e?.message || e));
+    console.error('[serve-static]', e?.stack || e);
+    res.writeHead(500); res.end('Internal Server Error');
BunBun.

🤖 Prompt for AI Agents
In scripts/serve-static.mjs around lines 34 to 38, the catch block currently
writes the internal error message to the HTTP response; change it so the server
logs the full error (console.error or your app logger) and the response returns
a generic 500 message (e.g., "Internal Server Error") without any error details
or stack traces, ensuring no internal paths or exception text are leaked to
clients.
@flyingrobots	Reply...

##############################################

test/browser/contracts/host-contracts.spec.mjs
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const OUT = process.env.OUT_JSON || '';

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Inconsistent variable naming

Line 4 uses process.env.OUT_JSON but stores it in a variable called OUT. Then line 11 checks if (OUT). Make up your mind - is it OUT or OUT_JSON? This inconsistency is confusing.

Either rename the constant or the environment variable to match:

-const OUT = process.env.OUT_JSON || '';
+const OUT_JSON = process.env.OUT_JSON || '';
And update the usage:

-  if (OUT) {
-    await fs.writeFile(OUT, JSON.stringify(res), 'utf8');
+  if (OUT_JSON) {
+    await fs.writeFile(OUT_JSON, JSON.stringify(res), 'utf8');
   }
BunBun

Committable suggestion skipped: line range outside the PR's diff.

🤖 Prompt for AI Agents
In test/browser/contracts/host-contracts.spec.mjs around line 4, the environment
variable process.env.OUT_JSON is assigned to a constant named OUT which is
inconsistent with later checks (e.g., line 11's if (OUT)); rename the constant
to OUT_JSON (or change the env var to OUT) so names match, and update all usages
(including the if check at line 11) to use the same identifier (OUT_JSON)
consistently.
@flyingrobots	Reply...

##############################################

test/browser/contracts/host-contracts.spec.mjs
const OUT = process.env.OUT_JSON || '';

test('host contracts pass in browser', async ({ page }) => {
  await page.goto('http://127.0.0.1:8787/index.html');

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

🧩 Analysis chain
From: Linus Torvalds torvalds@linux-foundation.org
To: {PR_AUTHOR_NAME} <{PR_AUTHOR_EMAIL}>
Cc: code-rabbit@vger.kernel.org
Subject: RE: Port 8787 claim needs fact-checking

You know what? I actually traced your concern and found you halfway right, which is somehow worse than being completely wrong.

The port is NOT "zero documentation" nonsense. Go look at scripts/serve-static.mjs:14—port 8787 is the DEFAULT and it's literally right there. And these test files? They're orchestrated properly by scripts/host_contracts_browser.mjs and scripts/browser_smoke_playwright.mjs, which explicitly:

Start the server before running tests
Wait for http://127.0.0.1:8787 with a 15-second timeout
Fail loudly if the port isn't available
So your worries about CI port conflicts? Already solved. The orchestrator will timeout and error out immediately if port 8787 is taken. That's not a problem—that's a feature.

BUT—and here's where you're actually onto something—the test file itself sits there with a hardcoded URL and no breadcrumb for developers. Someone reading host-contracts.spec.mjs:7 has zero context that they need to invoke host_contracts_browser.mjs, not run the test directly.

Add a comment at the top of the test file explaining: "This test is orchestrated by scripts/host_contracts_browser.mjs, which starts the static server on port 8787 before running this spec."

That's it. Ship it.

BunBun

🤖 Prompt for AI Agents
In test/browser/contracts/host-contracts.spec.mjs around line 7, the test
contains a hardcoded URL with no context for developers; add a top-of-file
comment stating that this spec is orchestrated by
scripts/host_contracts_browser.mjs (which starts the static server on
http://127.0.0.1:8787 before running the tests, waits up to 15s and will fail if
the port is unavailable) and instructing developers to run the orchestrator
script rather than executing the spec directly.
@flyingrobots	Reply...

##############################################

test/browser/contracts/host-contracts.spec.mjs
  await page.goto('http://127.0.0.1:8787/index.html');
  await page.waitForFunction(() => !!window.__host_contracts, null, { timeout: 15000 });
  const res = await page.evaluate(() => window.__host_contracts);
  expect(res && res.failed === 0).toBeTruthy();

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

Weak assertion that can throw

expect(res && res.failed === 0).toBeTruthy() is a weird way to write this. If res is null/undefined, the expression evaluates to false and fails the test, but it doesn't give you useful error information. Playwright expects are more powerful than this.

Use proper Playwright assertions:

-  expect(res && res.failed === 0).toBeTruthy();
+  expect(res).toBeTruthy();
+  expect(res.failed).toBe(0);
This gives you better error messages when tests fail.

BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
  expect(res && res.failed === 0).toBeTruthy();
  expect(res).toBeTruthy();
  expect(res.failed).toBe(0);
🤖 Prompt for AI Agents
In test/browser/contracts/host-contracts.spec.mjs around line 10, the assertion
expect(res && res.failed === 0).toBeTruthy() is weak and opaque; replace it with
two clearer Playwright assertions: first assert that res is defined (e.g.,
expect(res).toBeDefined() or expect(res).not.toBeNull()), then assert the
failure count explicitly (e.g., expect(res.failed).toBe(0)); if res may be
undefined use optional chaining or guard the second assertion behind the first
to avoid runtime errors and produce useful failure messages.
@flyingrobots	Reply...

##############################################

coderabbitai bot left a comment
Review continued from previous batch...

scripts/browser_smoke_playwright.mjs
Comment on lines 41 to 45
  // Install Playwright Chromium (ephemeral) and run the spec via pnpm dlx
  await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
  try {
    await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line']);
    console.log('✅ Browser smoke OK');

@coderabbitai coderabbitai bot 4 days ago
🛠️ Refactor suggestion | 🟠 Major

🧩 Analysis chain
From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Pin Playwright; "@latest" in CI is a Russian roulette.

Use a fixed major/minor and ephemeral browser path to keep the job fast and stable.

The script changes are sound, but you're missing the workflow plumbing. Apply the diff below to scripts/browser_smoke_playwright.mjs, then update .github/workflows/browser-smoke.yml to pass PW_VER as an environment variable to the run step so it actually takes effect.

-  await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
+  const PW_VER = process.env.PW_VER || '1.48.2';
+  await sh('pnpm', ['dlx', `playwright@${PW_VER}`, 'install', 'chromium'], {
+    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
+  });
-  await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line']);
+  await sh('pnpm', ['dlx', `playwright@${PW_VER}`, 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line'], {
+    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
+  });
In the workflow "Run browser host contracts" step, add env: { PW_VER: '1.48.2' } (or your chosen pinned version) to lock it down across CI runs. This keeps the job deterministic instead of blowing up when Playwright ships breaking changes.

BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
  // Install Playwright Chromium (ephemeral) and run the spec via pnpm dlx
  await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
  try {
    await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line']);
    console.log('✅ Browser smoke OK');
  // Install Playwright Chromium (ephemeral) and run the spec via pnpm dlx
  const PW_VER = process.env.PW_VER || '1.48.2';
  await sh('pnpm', ['dlx', `playwright@${PW_VER}`, 'install', 'chromium'], {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
  });
  try {
    await sh('pnpm', ['dlx', `playwright@${PW_VER}`, 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line'], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
    });
    console.log('✅ Browser smoke OK');
@flyingrobots	Reply...

##############################################

test/contracts/host-contracts.mjs
Comment on lines +9 to +13
async function sha256Hex(input) {
  const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
  const d = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

@coderabbitai coderabbitai bot 4 days ago
🧹 Nitpick | 🔵 Trivial

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Guard crypto.subtle with a readable error.

If a host lacks WebCrypto, fail with intent instead of a vague TypeError.

 async function sha256Hex(input) {
   const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
-  const d = await globalThis.crypto.subtle.digest('SHA-256', data);
+  const subtle = globalThis.crypto && globalThis.crypto.subtle;
+  if (!subtle) throw new Error('WebCrypto (crypto.subtle) not available');
+  const d = await subtle.digest('SHA-256', data);
   return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
 }
BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
async function sha256Hex(input) {
  const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
  const d = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(input) {
  const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) not available');
  const d = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
🤖 Prompt for AI Agents
In test/contracts/host-contracts.mjs around lines 9 to 13, the code calls
globalThis.crypto.subtle.digest directly which will throw a vague TypeError on
hosts without WebCrypto; add an explicit guard at the top of sha256Hex that
checks for globalThis.crypto and globalThis.crypto.subtle and, if missing, throw
a clear, descriptive Error (e.g., "WebCrypto API (crypto.subtle) is not
available in this environment") before any async work; otherwise proceed to
encode the input and call crypto.subtle.digest as before so callers receive an
intentional, readable failure instead of an obscure TypeError.
@flyingrobots	Reply...

##############################################

coderabbitai bot suggested changes 4 days ago
coderabbitai bot left a comment
Actionable comments posted: 2

♻️ Duplicate comments (6)
meta/progress.config.json (1)
6-17: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Still missing weight for @wesley/host-browser.

Your weights object has 10 entries but your packages array has 11. Line 23 adds @wesley/host-browser but there's no corresponding weight. The compute script will silently default to 0.01 (line 134 of compute-progress.mjs), which is sloppy and makes the weighting system completely opaque.

Either add the damn weight or document why experimental packages are excluded.

BunBun.

Also applies to: 23-23

##############################################

meta/progress.json (2)
2-2: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Stop committing volatile timestamps.

Every single run changes this. Perpetual diffs. Either gitignore the file or use a stable identifier like the CI run SHA.

BunBun.

3-3: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Empty repo field is useless.

Either populate it with the actual repository identifier or delete the field. Don't commit noise.

BunBun.

##############################################

scripts/compute-progress.mjs (3)
18-30: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Unguarded fetch call will explode in non-fetch environments.

Line 22 blindly calls fetch. If you run this in an older Node or some other runtime without fetch, you get a ReferenceError. You already gracefully degrade to null everywhere else, so just add the damn guard.

 async function fetchWorkflowPassRate(workflowFile, branch = 'main', take = 10) {
   try {
-    if (!token || !repo || !workflowFile) return null;
+    if (!token || !repo || !workflowFile || typeof fetch !== 'function') return null;
     const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=${take}`;
BunBun

44-48: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

nextStage() returns garbage for unknown input.

If someone passes an unknown stage, indexOf returns -1, you add 1 to get 0, and order[0] is 'Prototype'. That's complete nonsense. Handle unknowns explicitly or you'll render garbage in your matrix.

 function nextStage(stage) {
   const order = ['Prototype', 'MVP', 'Alpha', 'Beta', 'v1.0.0'];
   const i = order.indexOf(stage);
+  if (i < 0) return 'MVP'; // or throw new Error(`Unknown stage: ${stage}`)
   return order[Math.min(order.length - 1, i + 1)] || 'MVP';
 }
BunBun

92-97: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Prototype progress math is broken.

Line 95 comment claims "50–100 when usage appears" but line 96 multiplies by 50, giving you 25–50. Can't you do basic arithmetic?

   // Prototype → MVP (for "Too soon")
   if (base === 'Prototype' && stage === 'Prototype') {
     const d = docs.hasUsage ? 0.5 : 0;
-    const score = 0.5 + d; // encourage early progress between 50–100 when usage appears
-    progress = Math.round(score * 50); // 0–100 toward MVP
+    const score = 0.5 + d; // 0.5 or 1.0
+    progress = Math.round(score * 100); // 50 or 100, as documented
   }
BunBun

##############################################

coderabbitai[bot]
coderabbitai bot suggested changes 3 days ago
coderabbitai bot left a comment
Actionable comments posted: 12

♻️ Duplicate comments (20)
packages/wesley-generator-supabase/PROGRESS.md (1)
3-6: Fix heading spacing violations (MD022).

Same issue as in @wesley/cli/PROGRESS.md: all section headings must have blank lines both above and below. Inconsistent spacing across these files.

Apply this diff:

 # @wesley/generator-supabase — Progress
 
 ## MVP (idea works)
+
 - [x] Emits SQL/RLS/pgTAP on examples
 - [x] Integrated into CLI flows
 
 ## Alpha (core feature set demo)
+
 - [ ] Docs: Usage + Caveats complete
 - [ ] Demo: representative schema end-to-end
 
 ## Beta (feature complete)
+
 - [ ] Beta milestone issues closed (pkg:@wesley/generator-supabase)
 - [ ] Coverage threshold met (target TBD)
 - [ ] Integration tests for migration planning artifacts
 
 ## v1.0.0 (battle-tested)
+
 - [ ] Stability gates; no critical defects open
 - [ ] Changelog and upgrade notes
Also applies to: 7-10, 11-14, 16-18

##############################################

packages/wesley-host-node/PROGRESS.md (1)
3-6: Fix heading spacing violations (MD022).

Same markdown spacing issue across all PROGRESS.md files. Add blank lines after each section heading before the list content.

Apply this diff:

 # @wesley/host-node — Progress
 
 ## MVP (idea works)
+
 - [x] CLI entrypoint executes core flows
 - [x] Node adapters functional (fs, logging)
 - [x] Smoke: HOST=node contracts green
 
 ## Alpha (core feature set demo)
+
 - [ ] Demo of full pipeline on examples (docs)
 - [ ] Docs: Usage + Caveats complete
 
 ## Beta (feature complete)
+
 - [ ] Beta milestone issues closed (pkg:@wesley/host-node)
 - [ ] Coverage threshold met (target TBD)
 - [ ] Robust error handling tests
 
 ## v1.0.0 (battle-tested)
+
 - [ ] Stability gates; no critical defects open
 - [ ] Changelog and upgrade notes
Also applies to: 8-10, 12-15, 17-19

##############################################

.github/workflows/runtime-smokes.yml (1)
3-8: Add a concurrency guard; stop spamming duplicate runs.

Concurrent pushes on the same branch will pile up. Gate them.

Apply this diff:

 on:
   push:
     branches: ["**"]
   pull_request:
     branches: ["**"]
+
+concurrency:
+  group: runtime-smokes-${{ github.ref }}
+  cancel-in-progress: true
BunBun.

##############################################

meta/progress.config.json (1)
6-17: Missing weight for @wesley/host-browser.

This was already flagged. Your weights object still has 10 packages but your packages array has 13. The @wesley/host-browser package (line 23) has no corresponding weight entry, nor do @wesley/host-deno (line 29) or @wesley/host-bun (line 30).

Either add them to weights or document why experimental packages are excluded. Right now it's just broken.

BunBun

##############################################

test/browser/contracts/main.js (2)
15-16: Handle null from getElementById.

This was already flagged. document.getElementById('app') returns null if the element is missing. Then lines 28 and 31 explode with "Cannot set property 'textContent' of null". You're writing test infrastructure - this isn't optional.

Add the damn null check:

 async function main() {
   const el = document.getElementById('app');
+  if (!el) {
+    console.error('Missing #app element');
+    return;
+  }
   try {
BunBun

35-35: Handle promise rejection at top level.

Already flagged. You're calling an async function without handling rejections. If main() throws before its internal try-catch, you get an unhandled promise rejection.

Handle it:

-main();
+main().catch(err => {
+  console.error('Fatal error in main():', err);
+  window.__host_contracts = { 
+    passed: 0, 
+    failed: 1, 
+    cases: [{ name: 'main-crash', ok: false, details: { error: String(err) } }]
+  };
+});
BunBun

##############################################

meta/progress.json (2)
2-2: Stop committing volatile timestamps.

Already flagged. generatedAt guarantees perpetual diffs. Either exclude this file from git or use a stable identifier like the last successful CI SHA.

BunBun

3-3: Fill repo or drop it.

Already flagged. Empty "repo": "" is pointless noise. Either populate it with your repository identifier or delete the field entirely.

BunBun.

##############################################

scripts/host_contracts_browser.mjs (3)
9-14: Handle spawn errors or hang forever.

Already flagged. If the child process fails to spawn (pnpm not found, etc.), your Promise never resolves or rejects. You just hang.

Add error handling:

 async function sh(cmd, args, opts = {}) {
   return await new Promise((resolve, reject) => {
     const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
+    p.on('error', reject);
-    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)));
+    p.on('exit', (code, signal) =>
+      code === 0
+        ? resolve()
+        : reject(new Error(`${cmd} ${args.join(' ')} exited ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`)));
   });
 }
BunBun

54-61: Server spawn error swallowed.

Already flagged. You kill the server on failure but drop all error context. If serve-static.mjs fails to spawn, you'll never know why.

Handle spawn errors:

   const srv = spawn(process.execPath, ['scripts/serve-static.mjs', '--dir=test/browser/contracts/dist'], { stdio: 'inherit' });
+  srv.on('error', (e) => { throw new Error(`serve-static failed to spawn: ${e.message}`); });
   try {
     await waitFor('http://127.0.0.1:8787');
BunBun

74-78: Pin Playwright version.

Already flagged. Using playwright@latest is asking for random CI failures when new versions break things. Pin a known-good version.

-    await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
+    await sh('pnpm', ['dlx', 'playwright@1.49.0', 'install', 'chromium']);
-    await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/contracts/host-contracts.spec.mjs', '--reporter=line'], { env: { ...process.env, OUT_JSON: outFile } });
+    await sh('pnpm', ['dlx', 'playwright@1.49.0', 'test', 'test/browser/contracts/host-contracts.spec.mjs', '--reporter=line'], { env: { ...process.env, OUT_JSON: outFile } });
BunBun

##############################################

.github/workflows/browser-smoke.yml (1)
32-50: Where's the Playwright browser installation?

You cache Playwright browsers (lines 32-38) but never install them. The first run will fail spectacularly when Playwright can't find Chromium. Caching doesn't magically materialize binaries.

Add installation before running tests:

       - name: Install bats
         run: sudo apt-get update && sudo apt-get install -y bats jq

+      - name: Install Playwright browsers
+        run: pnpm exec playwright install --with-deps chromium
+
       - name: Run browser host contracts (Bats → Playwright)
         run: |
           mkdir -p test/hosts/bats-plugins
           bash scripts/setup-bats-plugins.sh
           HOST=browser bats test/hosts/host-contracts.bats
BunBun

##############################################

packages/wesley-host-browser/src/createBrowserRuntime.mjs (2)
32-39: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Guard WebCrypto: fail loudly when crypto.subtle is absent.

This will throw a cryptic TypeError in non‑WebCrypto runtimes. Check and throw a clear error.

 async function sha256Hex(input) {
   const enc = new TextEncoder();
   const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
-  // Prefer globalThis.crypto.subtle (available in browsers and some runtimes)
-  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
+  // Prefer globalThis.crypto.subtle (available in browsers and some runtimes)
+  const subtle = globalThis.crypto && globalThis.crypto.subtle;
+  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
+  const digest = await subtle.digest('SHA-256', data);
   const bytes = new Uint8Array(digest);
   return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
 }
BunBun

45-54: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Biome will choke on control chars in regex; stop shoving BOM/NULL into a regexp.

Replace with explicit string ops to silence lints and be clear.

 function sanitizeGraphQL(sdl, { maxBytes = 5 * 1024 * 1024 } = {}) {
   if (typeof sdl !== 'string') throw new Error('Schema must be a string');
   if (byteLengthUtf8(sdl) > maxBytes) {
     const e = new Error(`Schema exceeds max size (${maxBytes} bytes)`);
     e.code = 'EINPUTSIZE';
     throw e;
   }
-  // Strip BOM and null bytes (defensive)
-  return sdl.replace(/^﻿/, '').replace(/ /g, '');
+  // Strip BOM and null bytes (defensive), without control chars in regex
+  let out = sdl;
+  if (out.charCodeAt(0) === 0xFEFF) out = out.slice(1);
+  if (out.indexOf('\0') !== -1) out = out.split('\0').join('');
+  return out;
 }
BunBun

##############################################

scripts/compute-progress.mjs (6)
18-23: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Be explicit: skip fetch when it doesn’t exist to avoid noisy ReferenceErrors.

Guard fetch before use.

 async function fetchWorkflowPassRate(workflowFile, branch = 'main', take = 10) {
   try {
-    if (!token || !repo || !workflowFile) return null;
+    if (!token || !repo || !workflowFile || typeof fetch !== 'function') return null;
     const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=${take}`;
     const res = await fetch(url, { headers: { 'authorization': `Bearer ${token}`, 'accept': 'application/vnd.github+json' } });
BunBun

32-41: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Same fetch guard missing here.

Don’t call fetch if it’s undefined.

 async function fetchMilestoneRatioFor(pkgName, milestoneTitle) {
   try {
-    if (!token || !repo) return null;
+    if (!token || !repo || typeof fetch !== 'function') return null;
BunBun

61-65: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

nextStage() for unknown input returns Prototype. That’s nonsense.

Handle unknowns explicitly.

 function nextStage(stage) {
   const order = ['Prototype', 'MVP', 'Alpha', 'Beta', 'v1.0.0'];
   const i = order.indexOf(stage);
-  return order[Math.min(order.length - 1, i + 1)] || 'MVP';
+  if (i < 0) return 'MVP';
+  return order[Math.min(order.length - 1, i + 1)];
 }
BunBun

111-116: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Prototype progress math doesn’t match the comment.

You say 50–100 but compute 25–50. Fix the multiplier.

   if (base === 'Prototype' && stage === 'Prototype') {
     const d = docs.hasUsage ? 0.5 : 0;
-    const score = 0.5 + d; // encourage early progress between 50–100 when usage appears
-    progress = Math.round(score * 50); // 0–100 toward MVP
+    const score = 0.5 + d; // 0.5 or 1.0
+    progress = Math.round(score * 100); // 50 or 100, as documented
   }
BunBun

161-168: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Silent weight defaulting masks config errors. Log or validate.

Defaulting to 0.01 hides missing weights.

   for (const name of include) {
-    const w = Number(weights[name] || 0.01);
+    let w = weights[name];
+    if (w === undefined) {
+      console.warn(`Warning: No weight for ${name}, using default 0.01`);
+      w = 0.01;
+    }
+    const wNum = Number(w);
     const r = results.find(x => x.name === name);
     const reached = r && idx(r.stage) >= idx(overallNext);
     const frac = reached ? 1 : (r ? (r.progress / 100) : 0);
-    acc += w * frac; wsum += w;
+    acc += wNum * frac; wsum += wNum;
   }
BunBun

198-202: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Hardcoded repo fallback is brittle. Don’t lie when repo is unknown.

If repo is empty, show em-dash, not someone else’s repo.

-    const badge = p.ci ? `![${p.ci}](https://github.com/${repo || 'flyingrobots/wesley'}/actions/workflows/${p.ci}/badge.svg?branch=main)` : '—';
+    const badge = p.ci && repo
+      ? `![${p.ci}](https://github.com/${repo}/actions/workflows/${p.ci}/badge.svg?branch=main)`
+      : '—';
BunBun

##############################################

coderabbitai[bot]
coderabbitai bot suggested changes yesterday
coderabbitai bot left a comment
Actionable comments posted: 11

♻️ Duplicate comments (17)
packages/wesley-generator-supabase/README.md (1)
19-20: Trailing whitespace and inconsistent status documentation—didn't we already say this?

Line 19 has trailing whitespace (markdown line-break hack or plain sloppy?), and the past review already flagged this issue across multiple README files in this PR. You either committed to a repo-wide cleanup pass or you didn't. Either way, don't half-ass it.

The badge is fine. The status declaration is fine. What's not fine is leaving whitespace cruft in documentation that was supposed to be cleaned up. If you're adding Status headers with badges to every README in this PR, do it consistently and without the trailing spaces.

Apply this diff to remove trailing whitespace:

 ## Status
 
-Status: Active  
+Status: Active
 ![pkg-generator-supabase](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-supabase.yml/badge.svg?branch=main)
Then run a final whitespace cleanup pass across all README files modified in this PR. Use:

git diff HEAD~1 --name-only | grep -i readme | xargs sed -i 's/[[:space:]]*$//'

##############################################

packages/wesley-cli/README.md (1)
24-25: ****

Same header/footer status duplication as wesley-core and wesley-holmes. Consolidate across all three (and any other package READMEs) into a single canonical location.

BunBun.

##############################################

scripts/serve-static.mjs (2)
16-22: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Still serving .js as text/javascript? Fix it already.

Line 18: You were told to use application/javascript for .js files. text/javascript is obsolete and some strict content-type checks will choke on it.

-  '.js': 'text/javascript; charset=utf-8',
+  '.js': 'application/javascript; charset=utf-8',
BunBun.

41-42: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Stop leaking internal errors to HTTP clients.

Line 42: Dumping e?.message to the response is sloppy even in CI. Log it server-side and return a generic 500 message.

   } catch (e) {
+    console.error('[serve-static]', e?.stack || e);
-    res.writeHead(500); res.end(String(e?.message || e));
+    res.writeHead(500); res.end('Internal Server Error');
   }
BunBun.

##############################################

test/contracts/host-contracts.mjs (1)
9-13: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Still missing crypto.subtle guard.

Line 11: Direct access to globalThis.crypto.subtle will throw an obscure TypeError on hosts without WebCrypto. Check for its existence and throw a clear error message if unavailable.

 async function sha256Hex(input) {
+  const subtle = globalThis.crypto?.subtle;
+  if (!subtle) throw new Error('WebCrypto API (crypto.subtle) is not available in this environment');
   const data = typeof input === 'string' ? te(input) : te(JSON.stringify(input));
-  const d = await globalThis.crypto.subtle.digest('SHA-256', data);
+  const d = await subtle.digest('SHA-256', data);
   return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
 }
BunBun.

##############################################

packages/wesley-generator-supabase/PROGRESS.md (1)
3-22: Your headings are cramped. MD022 violations everywhere.

Lines 3, 8, 13, and 18 all lack blank lines after the headings. This isn't rocket science—markdown linters exist for a reason. Every heading needs breathing room.

Run markdownlint --fix or manually insert blank lines after each heading.

BunBun

##############################################

packages/wesley-core/PROGRESS.md (1)
3-24: Still ignoring the markdown linter, I see.

The past review already told you: lines 3, 8, 13, and 18 need blank lines below them. MD022 violations. You didn't fix it. Either run markdownlint --fix or add the blank lines manually.

BunBun

##############################################

packages/wesley-cli/PROGRESS.md (1)
3-24: Copy-paste without fixing formatting. Classic.

Same MD022 violations as the other PROGRESS.md files. Headings at lines 3, 9, 15, and 21 are missing blank lines below them. Past reviews already called this out. Fix them all in one pass.

BunBun

##############################################

packages/wesley-host-node/PROGRESS.md (1)
3-23: Another PROGRESS.md, another set of MD022 violations.

Headings at lines 3, 9, 14, and 20 lack blank lines below them. Same issue as every other PROGRESS.md file in this PR. Fix them all at once.

BunBun

##############################################

meta/progress.json (1)
1-7: Still committing that volatile timestamp. Why?

Line 2's generatedAt guarantees a diff every time compute-progress.mjs runs. Past review flagged this exact issue. Either:

Stop committing this file (add meta/progress.json to .gitignore)
Make the timestamp deterministic (use git commit SHA or CI run ID)
Remove the field entirely
Generated artifacts with volatile timestamps don't belong in git unless there's a damn good reason. Pick one of the above and fix it.

BunBun

##############################################

packages/wesley-host-browser/README.md (1)
17-18: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Still vague on the tables return field.

Line 18 says runInBrowser returns { ok, token, tables } but doesn't clarify whether tables is a count (number) or the actual array of table objects. Looking at your implementation (index.mjs line 37), it's bundle.schema.tables.length - a number.

Document it explicitly so users don't have to read the source:

-- `runInBrowser(schema: string)` – Runs a minimal generation pipeline with stub ports and returns `{ ok, token, tables }` where `token` begins with `BROWSER_SMOKE_OK:` when successful.
+- `runInBrowser(schema: string)` – Runs a minimal generation pipeline with stub ports and returns `{ ok, token, tables }` where `token` begins with `BROWSER_SMOKE_OK:` when successful and `tables` is the count of parsed tables (number).
BunBun

##############################################

packages/wesley-host-bun/src/index.mjs (1)
13-20: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

WebCrypto guard is in place.

Lines 16-17 now check for crypto.subtle availability before use. This addresses the earlier review concern.

BunBun

##############################################

scripts/compute-progress.mjs (5)
18-30: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Fetch guard is present.

Line 20 now checks typeof fetch !== 'function' before use, cleanly degrading to null in environments without fetch. Addresses the earlier concern.

BunBun

61-66: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Unknown stage handling is explicit.

Line 64 throws a clear error for unknown stages instead of returning garbage. Fixes the earlier nonsense.

BunBun

112-117: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Prototype progress math is now correct.

Score of 0.5 or 1.0 multiplied by 100 yields 50 or 100 as documented. The earlier arithmetic error is fixed.

BunBun

164-167: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Weight validation now fails loudly.

Lines 164-167 check for missing weights and exit with an error instead of silently defaulting. Addresses the earlier masking concern.

BunBun

176-179: From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Repo check now fails instead of falling back.

Lines 176-179 error when GITHUB_REPOSITORY is unset instead of pretending with a hardcoded default. Good.

BunBun

##############################################

.github/workflows/browser-smoke.yml
Comment on lines +46 to +49
      - name: Install Playwright browsers (with deps)
        run: |
          npm -v >/dev/null 2>&1 || npm ci
          npx playwright install --with-deps

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟡 Minor

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Pointless npm check on line 48.

You run npm -v >/dev/null 2>&1 || npm ci before installing Playwright browsers. What is this supposed to accomplish?

If npm -v fails (npm not in PATH), then npm ci will also fail. And you already ran pnpm install --frozen-lockfile on line 27, so node_modules exists. Why are you checking for npm when you're using pnpm throughout the workflow?

Either this is cargo-cult copy-paste from somewhere else, or you're trying to work around some weird edge case that should be documented.

Just remove it:

       - name: Install Playwright browsers (with deps)
         run: |
-          npm -v >/dev/null 2>&1 || npm ci
           npx playwright install --with-deps
Or if you're trying to ensure node_modules exists before npx runs, document WHY with a comment, because it looks broken.

BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
      - name: Install Playwright browsers (with deps)
        run: |
          npm -v >/dev/null 2>&1 || npm ci
          npx playwright install --with-deps
      - name: Install Playwright browsers (with deps)
        run: |
          npx playwright install --with-deps
🤖 Prompt for AI Agents
.github/workflows/browser-smoke.yml lines 46-49: the step runs a pointless npm
version check before installing Playwright browsers; remove the `npm -v
>/dev/null 2>&1 || npm ci` line so the step simply runs `npx playwright install
--with-deps`, or if the intent was to ensure node_modules exists, replace the
check with an explicit `pnpm install --frozen-lockfile` (or a short comment
explaining why the check is necessary) and keep consistent use of pnpm rather
than npm.
@flyingrobots	Reply...

##############################################

.github/workflows/pkg-core.yml
Comment on lines +28 to +29
      - name: @wesley/core tests (coverage)
        run: "pnpm --filter @wesley/core test:coverage || pnpm --filter @wesley/core test"

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🔴 Critical

CRITICAL: YAML syntax error; @ character requires quoting.

Line 28–29 contains a YAML parse error. The run command uses @wesley/core unquoted, which breaks YAML tokenization because @ cannot start a token. This workflow will fail to parse and never execute.

Wrap the entire run value in double quotes.

Apply this diff:

-      - name: @wesley/core tests (coverage)
-        run: pnpm --filter @wesley/core test:coverage || pnpm --filter @wesley/core test
+      - name: @wesley/core tests (coverage)
+        run: "pnpm --filter @wesley/core test:coverage || pnpm --filter @wesley/core test"
BunBun.

Committable suggestion skipped: line range outside the PR's diff.

🧰 Tools
🤖 Prompt for AI Agents
.github/workflows/pkg-core.yml lines 28-29: the run command contains an unquoted
token starting with '@' which causes a YAML parse error; wrap the entire run
value in double quotes so the string is treated literally (e.g. change run: pnpm
--filter @wesley/core test:coverage || pnpm --filter @wesley/core test to run:
"pnpm --filter @wesley/core test:coverage || pnpm --filter @wesley/core test").
@flyingrobots	Reply...

##############################################

.github/workflows/pkg-host-bun.yml
Comment on lines +3 to +22
on:
  push:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'
  pull_request:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'

jobs:
  bun-host:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Bun host smoke
        run: bun run packages/wesley-host-bun/examples/smoke.mjs | tee bun-host.out && grep -q '^BUN_HOST_OK:' bun-host.out

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟠 Major

Missing concurrency guard and timeout protection.

This workflow lacks both a concurrency block and timeout-minutes on the job, which creates two hazards:

Duplicate jobs: Parallel pushes to the same branch spawn concurrent bun-host runs, wasting CI resources.
Infinite hangs: If the Bun runtime stalls, this job runs indefinitely, burning minutes.
Align with pkg-host-deno.yml and pkg-core.yml patterns by adding both guards.

Apply this diff:

 on:
   push:
     branches: ["**"]
     paths:
       - 'packages/wesley-host-bun/**'
   pull_request:
     branches: ["**"]
     paths:
       - 'packages/wesley-host-bun/**'
+
+concurrency:
+  group: pkg-host-bun-${{ github.ref }}-${{ github.workflow }}
+  cancel-in-progress: true

 jobs:
   bun-host:
+    timeout-minutes: 10
     runs-on: ubuntu-latest
BunBun.

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
on:
  push:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'
  pull_request:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'
jobs:
  bun-host:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Bun host smoke
        run: bun run packages/wesley-host-bun/examples/smoke.mjs | tee bun-host.out && grep -q '^BUN_HOST_OK:' bun-host.out
on:
  push:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'
  pull_request:
    branches: ["**"]
    paths:
      - 'packages/wesley-host-bun/**'
concurrency:
  group: pkg-host-bun-${{ github.ref }}-${{ github.workflow }}
  cancel-in-progress: true
jobs:
  bun-host:
    timeout-minutes: 10
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Bun host smoke
        run: bun run packages/wesley-host-bun/examples/smoke.mjs | tee bun-host.out && grep -q '^BUN_HOST_OK:' bun-host.out
🤖 Prompt for AI Agents
.github/workflows/pkg-host-bun.yml lines 3-22: add a workflow-level concurrency
block and a job-level timeout to prevent duplicate concurrent runs and infinite
hangs; specifically add a top-level concurrency: group: ${{ github.workflow
}}-${{ github.ref }} (or use ${{ github.workflow }}-${{ github.head_ref ||
github.ref }}) with cancel-in-progress: true, and under the bun-host job add
timeout-minutes: 10 (or 30 if you prefer longer) so the job will be cancelled
after the timeout; keep the rest of the steps unchanged.
@flyingrobots	Reply...

##############################################

.github/workflows/runtime-smokes.yml
Comment on lines +37 to +39
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🔴 Critical

🧩 Analysis chain
Pin Bun to a known stable version across all workflows.

Line 39: bun-version: latest is unpinned and violates CI reproducibility best practices. Pin an exact Bun version (e.g., 1.2.20) to ensure deterministic builds. The suggested version in the original comment (1.1.38) is outdated; the current stable release is v1.2.20 (August 10, 2025).

This issue exists in two files:

.github/workflows/runtime-smokes.yml (line 39)
.github/workflows/pkg-host-bun.yml (same unpinned version)
       - uses: oven-sh/setup-bun@v1
         with:
-          bun-version: latest
+          bun-version: 1.2.20
Apply this fix to both workflow files. No centralized version file exists in the repo, so inline pinning is the correct approach here.

BunBun.

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.20
🤖 Prompt for AI Agents
In .github/workflows/runtime-smokes.yml around lines 37 to 39 and the same
change in .github/workflows/pkg-host-bun.yml, replace the unpinned bun-version:
latest with a fixed, known stable Bun version (e.g., bun-version: 1.2.20) to
ensure CI reproducibility; update both workflow files inline (no central file)
so each uses the exact version string instead of "latest".
@flyingrobots	Reply...

##############################################

packages/wesley-host-bun/src/index.mjs
Comment on lines +26 to +29
  const parsers = { graphql: { async parse(sdl){
    const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{/g; const tables=[]; let m;
    while((m=re.exec(sdl))!==null){ if(/@wes_table\b|@wesley_table\b|\b@table\b/.test(m[2]||'')) tables.push({ name:m[1] }); }
    return { tables, toJSON(){ return { tables } } };

##############################################

@coderabbitai coderabbitai bot yesterday
🧹 Nitpick | 🔵 Trivial

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Regex parser is a brittle smoke-test shim—acceptable but document the limits.

This pattern won't survive multi-line directives, inline comments between type and {, or any non-trivial GraphQL. For a smoke harness that's fine, but if anyone copy-pastes this into production parsing you'll have a bad time. Consider a one-liner comment explaining it's intentionally minimal.

BunBun

🤖 Prompt for AI Agents
In packages/wesley-host-bun/src/index.mjs around lines 26 to 29, the inline
regex-based GraphQL parser is a brittle smoke-test shim that fails on multi-line
directives, inline comments between the type name and the opening brace, and any
non-trivial GraphQL syntax; add a single-line comment immediately above this
parser explaining it is intentionally minimal/for smoke-testing only, list its
main limitations (multi-line directives, comments between tokens, not a full
GraphQL parser), and advise using a real GraphQL parser in production if more
than a quick check is required.
@flyingrobots	Reply...

##############################################

packages/wesley-host-deno/mod.ts
Comment on lines +17 to +22
async function sha256Hex(input:unknown){
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟠 Major

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Missing crypto.subtle guard here too.

Line 20: You're directly calling crypto.subtle.digest without checking if it exists. If Deno ever runs in a context without WebCrypto (unlikely but possible), this will throw an obscure error. Add a guard like you should have done in host-contracts.mjs.

 async function sha256Hex(input:unknown){
+  if (!globalThis.crypto?.subtle) {
+    throw new Error('WebCrypto API (crypto.subtle) is not available');
+  }
   const enc = new TextEncoder();
   const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
   const digest = await crypto.subtle.digest('SHA-256', data);
   return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
BunBun.

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
async function sha256Hex(input:unknown){
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(input:unknown){
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API (crypto.subtle) is not available');
  }
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0').join('');
}
🤖 Prompt for AI Agents
In packages/wesley-host-deno/mod.ts around lines 17 to 22, the sha256Hex
function calls crypto.subtle.digest directly without checking for WebCrypto
availability; add a guard that verifies crypto and crypto.subtle exist before
calling digest, and if absent throw a clear, descriptive error (or return a
documented fallback) so the function fails fast with an understandable message
instead of throwing an obscure exception; keep the existing encoding/digest
logic intact and only add the presence check and error handling immediately
before invoking crypto.subtle.digest.
@flyingrobots	Reply...

##############################################

scripts/compute-progress.mjs
Comment on lines +135 to +139
    let coverage = null;
    try {
      const sum = JSON.parse(readFileSync(resolve('packages/wesley-core/coverage/coverage-summary.json'), 'utf8'));
      coverage = sum.total?.lines?.pct ?? null;
    } catch {}

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟠 Major

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Hardcoded coverage path only works for wesley-core.

You're inside a loop over cfg.packages (line 126) but reading coverage from a hardcoded 'packages/wesley-core/coverage/coverage-summary.json' path (line 137). This means coverage will only ever populate for wesley-core, and every other package in the loop will get null even if they have coverage summaries at different paths. Either parameterize the path using p.name or remove the coverage read from the loop and handle it separately.

-    try {
-      const sum = JSON.parse(readFileSync(resolve('packages/wesley-core/coverage/coverage-summary.json'), 'utf8'));
-      coverage = sum.total?.lines?.pct ?? null;
-    } catch {}
+    try {
+      const covPath = resolve(`packages/${p.name}/coverage/coverage-summary.json`);
+      const sum = JSON.parse(readFileSync(covPath, 'utf8'));
+      coverage = sum.total?.lines?.pct ?? null;
+    } catch {}
BunBun

📝 Committable suggestion
‼️ IMPORTANT
Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

Suggested change
    let coverage = null;
    try {
      const sum = JSON.parse(readFileSync(resolve('packages/wesley-core/coverage/coverage-summary.json'), 'utf8'));
      coverage = sum.total?.lines?.pct ?? null;
    } catch {}
    let coverage = null;
    try {
      const covPath = resolve(`packages/${p.name}/coverage/coverage-summary.json`);
      const sum = JSON.parse(readFileSync(covPath, 'utf8'));
      coverage = sum.total?.lines?.pct ?? null;
    } catch {}
🤖 Prompt for AI Agents
In scripts/compute-progress.mjs around lines 135 to 139, the code reads coverage
from a hardcoded 'packages/wesley-core/coverage/coverage-summary.json' inside a
loop over cfg.packages so every other package gets null; update the path to be
parameterized using the current package name (e.g. use p.name to build
'packages/${p.name}/coverage/coverage-summary.json') or, if coverage should be
aggregated once, remove the read from the loop and perform it separately outside
the loop; ensure you handle missing files with try/catch and set coverage =
sum.total?.lines?.pct ?? null as before.
@flyingrobots	Reply...

##############################################

scripts/compute-progress.mjs
Comment on lines +222 to +235
  const s1 = readme.indexOf(pkgStart), e1 = readme.indexOf(pkgEnd);
  const s2 = readme.indexOf(ovStart), e2 = readme.indexOf(ovEnd);
  if (s1 === -1 || e1 === -1 || e1 < s1 || s2 === -1 || e2 === -1 || e2 < s2) {
    console.error('Markers not found in README.md');
    process.exit(2);
  }
  const matrixBefore = readme.slice(0, s1 + pkgStart.length);
  const matrixAfter = readme.slice(e1);
  const matrixBody = '\n' + rows.join('\n') + '\n';

  const overallBefore = (matrixBefore + matrixBody + matrixAfter).slice(0, s2 + ovStart.length);
  const overallAfterPre = (matrixBefore + matrixBody + matrixAfter).slice(e2);
  const overallBody = `\nStage: ${overallStage}  \
Progress: ${overallProgress}% → ${overallNext}\n`;
  const nextReadme = overallBefore + overallBody + overallAfterPre;

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🔴 Critical

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

You're using stale indices after the first replacement—this WILL corrupt the README.

Lines 222-223 find s1, e1, s2, e2 in the original readme. Lines 228-230 construct a new string with the matrix replaced. Then lines 232-233 use s2 and e2 (from the original readme) to slice the modified string. If the matrix content changes size—which it will—the overall marker positions shift, but you're still using the old indices. You'll slice at the wrong offsets and mangle the README.

Fix: either do both replacements based on sorted original indices without re-concatenating intermediate results, or (simpler) do the matrix replacement, re-find the overall markers in the result, then do the overall replacement.

  const s1 = readme.indexOf(pkgStart), e1 = readme.indexOf(pkgEnd);
- const s2 = readme.indexOf(ovStart), e2 = readme.indexOf(ovEnd);
- if (s1 === -1 || e1 === -1 || e1 < s1 || s2 === -1 || e2 === -1 || e2 < s2) {
+ if (s1 === -1 || e1 === -1 || e1 < s1) {
    console.error('Markers not found in README.md');
    process.exit(2);
  }
  const matrixBefore = readme.slice(0, s1 + pkgStart.length);
  const matrixAfter = readme.slice(e1);
  const matrixBody = '\n' + rows.join('\n') + '\n';
+ const readmeAfterMatrix = matrixBefore + matrixBody + matrixAfter;

- const overallBefore = (matrixBefore + matrixBody + matrixAfter).slice(0, s2 + ovStart.length);
- const overallAfterPre = (matrixBefore + matrixBody + matrixAfter).slice(e2);
+ const s2 = readmeAfterMatrix.indexOf(ovStart), e2 = readmeAfterMatrix.indexOf(ovEnd);
+ if (s2 === -1 || e2 === -1 || e2 < s2) {
+   console.error('Overall markers not found in README.md after matrix replacement');
+   process.exit(2);
+ }
+ const overallBefore = readmeAfterMatrix.slice(0, s2 + ovStart.length);
+ const overallAfterPre = readmeAfterMatrix.slice(e2);
  const overallBody = `\nStage: ${overallStage}  \
Progress: ${overallProgress}% → ${overallNext}\n`;
  const nextReadme = overallBefore + overallBody + overallAfterPre;
BunBun

@flyingrobots	Reply...

##############################################

scripts/host_contracts_browser.mjs
Comment on lines +63 to +65
  srv.on('error', (e) => { throw new Error(`serve-static failed to spawn: ${e?.message || e}`); });
  srv.stderr?.on('data', (d) => { srvErr += d.toString(); if (srvErr.length > 2000) srvErr = srvErr.slice(-2000); });
  srv.on('error', (err) => { srvErr += `
[spawn-error] ${err?.message || err}`; });

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟠 Major

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Duplicate error handler on line 65.

Line 63 already registers an error handler that throws. Line 65 registers another one that appends to srvErr. Pick one strategy: either throw immediately or buffer the error for inclusion in the waitFor failure message. Don't do both—it's confusing and the first throw will prevent the second handler from ever being useful.

   const srv = spawn(process.execPath, ['scripts/serve-static.mjs', '--dir=test/browser/contracts/dist', `--port=${port}`], { stdio: ['ignore','pipe','pipe'] });
-  srv.on('error', (e) => { throw new Error(`serve-static failed to spawn: ${e?.message || e}`); });
+  srv.on('error', (err) => { srvErr += `
[spawn-error] ${err?.message || err}`; });
   srv.stderr?.on('data', (d) => { srvErr += d.toString(); if (srvErr.length > 2000) srvErr = srvErr.slice(-2000); });
-  srv.on('error', (err) => { srvErr += `
[spawn-error] ${err?.message || err}`; });
BunBun.

🤖 Prompt for AI Agents
In scripts/host_contracts_browser.mjs around lines 63-65 there are two duplicate
'srv.on("error")' handlers: one immediately throws an Error and the other
appends the message to srvErr; remove the duplication by choosing one
strategy—prefer buffering the error for the waitFor failure message—so delete
the throwing handler (line 63) and keep/ensure the handler that appends to
srvErr (line 65) so errors are recorded and surfaced later; alternatively, if
you want immediate failure, keep the throwing handler and remove the srvErr
append handler, but do not register both.
@flyingrobots	Reply...

##############################################

scripts/serve-static.mjs
Comment on lines +32 to +33
  if (!filePath.startsWith(root + '/') && filePath !== root && !filePath.startsWith(root + '\')) {
    res.writeHead(403); res.end('Forbidden'); return;

##############################################

@coderabbitai coderabbitai bot yesterday
⚠️ Potential issue | 🟠 Major

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Path traversal check is amateur string hacking.

String-concatenating root + '/' and then checking startsWith is fragile garbage that will break on edge cases. Use path.relative() and check if the result starts with .. to properly detect escapes from the root.

+import { relative } from 'node:path';
+
 const server = http.createServer((req, res) => {
   // Parse path and normalize relative to root to prevent path traversal
   let reqPath = (req.url || '/').split('?')[0] || '/';
   // Remove any leading slashes so join/resolve do not discard root
   reqPath = reqPath.replace(/^\/+/, '');
   if (reqPath === '') reqPath = 'index.html';
   const filePath = resolve(root, reqPath);
   // Ensure resolved path is within root
-  if (!filePath.startsWith(root + '/') && filePath !== root && !filePath.startsWith(root + '\')) {
+  const rel = relative(root, filePath);
+  if (rel.startsWith('..') || path.isAbsolute(rel)) {
     res.writeHead(403); res.end('Forbidden'); return;
   }
BunBun.

Committable suggestion skipped: line range outside the PR's diff.

🤖 Prompt for AI Agents
In scripts/serve-static.mjs around lines 32-33, the path traversal check uses
fragile string concatenation with root + '/' and startsWith, which fails on edge
cases and different path separators; replace it by resolving both root and
filePath with path.resolve(), then compute const rel =
path.relative(rootResolved, filePathResolved) and treat any rel that equals ''
or does not start with '..' and does not include path.sep + '..' as inside the
root, otherwise respond 403; also ensure to normalize input (e.g., decode URI
components) before resolving to avoid encoded traversal.
@flyingrobots	Reply...

##############################################

test/browser/contracts/main.js
Comment on lines +4 to +13
async function verifyIr() {
  const { createBrowserRuntime } = await import('../../../packages/wesley-host-browser/src/createBrowserRuntime.mjs');
  const rt = await createBrowserRuntime();
  const sdl = `type Org @wes_table { id: ID! @wes_pk }
`+
              `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
  const ir = await rt.parsers.graphql.parse(sdl);
  if (!Array.isArray(ir.tables) || ir.tables.length !== 2) return false;
  const u = ir.tables.find(t => t.name === 'User');
  return !!(u && Array.isArray(u.columns) && u.columns.some(c => c.name === 'id'));
}

##############################################

@coderabbitai coderabbitai bot yesterday
🧹 Nitpick | 🔵 Trivial

From: Linus Torvalds torvalds@linux-foundation.org
To: flyingrobots flyingrobots@users.noreply.github.com
Cc: code-rabbit@vger.kernel.org

Silent false return makes debugging impossible.

Your verifyIr function returns a boolean. That's it. When it returns false, the test result says "browser-ir-shape failed" with zero context. Was it the wrong table count? Missing columns? Wrong column names? Who the hell knows - you threw away all the diagnostic information.

This is test infrastructure. When it breaks, you want to know WHY it broke, not just that it broke.

Consider returning an object with details instead of a bare boolean:

 async function verifyIr() {
   const { createBrowserRuntime } = await import('../../../packages/wesley-host-browser/src/createBrowserRuntime.mjs');
   const rt = await createBrowserRuntime();
   const sdl = `type Org @wes_table { id: ID! @wes_pk }
`+
               `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
   const ir = await rt.parsers.graphql.parse(sdl);
-  if (!Array.isArray(ir.tables) || ir.tables.length !== 2) return false;
+  if (!Array.isArray(ir.tables)) return { ok: false, reason: 'ir.tables not an array' };
+  if (ir.tables.length !== 2) return { ok: false, reason: `expected 2 tables, got ${ir.tables.length}` };
   const u = ir.tables.find(t => t.name === 'User');
-  return !!(u && Array.isArray(u.columns) && u.columns.some(c => c.name === 'id'));
+  if (!u) return { ok: false, reason: 'User table not found' };
+  if (!Array.isArray(u.columns)) return { ok: false, reason: 'User.columns not an array' };
+  if (!u.columns.some(c => c.name === 'id')) return { ok: false, reason: 'User.id column not found' };
+  return { ok: true };
 }
Then update the caller to use the details:

   const res = await runAll();
-  const irOk = await verifyIr();
-  if (!irOk) {
+  const irResult = await verifyIr();
+  if (!irResult.ok) {
     res.failed += 1;
-    res.cases.push({ name: 'browser-ir-shape', ok: false });
+    res.cases.push({ name: 'browser-ir-shape', ok: false, details: { reason: irResult.reason } });
   } else {
BunBun

Committable suggestion skipped: line range outside the PR's diff.

🤖 Prompt for AI Agents
In test/browser/contracts/main.js around lines 4 to 13, the verifyIr function
currently returns only a boolean which loses all diagnostic context; change it
to return a detailed result object (e.g., { ok: boolean, errors: string[],
details?: {...} }) that records each check (parse success, table count, missing
table names, missing columns, etc.) and include descriptive messages for
failures; update any caller to treat the result object (use result.ok to keep
boolean semantics) and surface result.errors or details in test failure output
so callers can log why the check failed.
@flyingrobots	Reply...