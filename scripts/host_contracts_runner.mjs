// Shared host-contracts runner for Node, Bun, and Deno
// - Runs the test harness and emits a single JSON object to stdout
// - Sets an appropriate exit code across runtimes (0 when failed==0)
// - Avoids any Node/Deno-specific imports so it can run everywhere

import { runAll } from '../test/contracts/host-contracts.mjs';

function exitWithCode(code) {
  // Prefer process.exit when available (Node/Bun)
  if (globalThis.process && typeof globalThis.process.exit === 'function') {
    globalThis.process.exit(code);
    return; // for completeness in case the runtime doesn't exit immediately
  }
  // Deno support
  if (globalThis.Deno && typeof globalThis.Deno.exit === 'function') {
    globalThis.Deno.exit(code);
    return;
  }
}

export async function runAndReport() {
  try {
    const res = await runAll();
    // Always emit machine-readable JSON to stdout
    // Consumers (bats, CI) rely on this shape
    console.log(JSON.stringify(res));
    const code = res && typeof res.failed === 'number' ? (res.failed > 0 ? 1 : 0) : 1;
    exitWithCode(code);
    return res;
  } catch (err) {
    const payload = {
      passed: 0,
      failed: 1,
      error: String(err && err.message ? err.message : err)
    };
    // Emit failure payload to stderr to avoid confusing stdout parsers
    try { console.error(JSON.stringify(payload)); } catch { /* ignore */ }
    exitWithCode(1);
    throw err; // allow callers to observe error if they import this function
  }
}

// If executed directly via a runtime entry script that simply imports this file,
// run immediately
if (import.meta.main) {
  // Some runtimes do not support import.meta.main; the entry scripts will call runAndReport()
  // directly. We keep this for completeness when supported.
  runAndReport();
}

