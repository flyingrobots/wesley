#!/usr/bin/env node
// Programmatic Playwright smoke to keep deps light
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import http from 'node:http';

async function sh(cmd, args, opts = {}) {
  return await new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', (err) => reject(err));
    p.on('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} ${args.join(' ')} exited ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`));
    });
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
  const port = process.env.TEST_SERVER_PORT || '8787';
  const srv = spawn(process.execPath, ['scripts/serve-static.mjs', `--port=${port}`], { stdio: 'inherit' });
  try {
    await waitForHttp(`http://127.0.0.1:${port}`);
  } catch (e) {
    try {
      srv.kill('SIGTERM');
      await sleep(1000);
      if (!srv.killed) srv.kill('SIGKILL');
    } catch {}
    throw e;
  }

  // Install Playwright Chromium (ephemeral) and run the spec via pnpm dlx
  const PWV = process.env.PLAYWRIGHT_VERSION || '1.43.0';
  await sh('pnpm', ['dlx', `playwright@${PWV}`, 'install', 'chromium']);
  try {
    await sh('pnpm', ['dlx', `playwright@${PWV}`, 'test', 'test/browser/smoke/smoke.spec.mjs', '--reporter=line']);
    console.log('✅ Browser smoke OK');
  } finally {
    try {
      srv.kill('SIGTERM');
      await sleep(1000);
      if (!srv.killed) srv.kill('SIGKILL');
    } catch {}
  }
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
