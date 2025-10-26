#!/usr/bin/env node
// Programmatic Playwright smoke to keep deps light
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import http from 'node:http';

async function sh(cmd, args, opts = {}) {
  return await new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)));
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  // Build the tiny Vite bundle for the smoke harness
  await sh('pnpm', ['exec', 'vite', 'build', '--config', 'test/browser/smoke/vite.config.mjs']);

  // Start a static server over the dist output
  const srv = spawn(process.execPath, ['scripts/serve-static.mjs'], { stdio: 'inherit' });
  try {
    await waitForHttp('http://127.0.0.1:8787');
  } catch (e) {
    srv.kill('SIGKILL');
    throw e;
  }

  // Install Playwright Chromium (ephemeral) and run the spec via pnpm dlx
  await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
  try {
    await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line']);
    console.log('✅ Browser smoke OK');
  } finally {
    srv.kill('SIGKILL');
  }
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
