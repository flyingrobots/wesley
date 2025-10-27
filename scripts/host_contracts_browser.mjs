#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function sh(cmd, args, opts = {}) {
  return await new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)));
  });
}

async function waitFor(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await sleep(200);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  // Build contracts harness
  await sh('pnpm', ['exec', 'vite', 'build', '--config', 'test/browser/contracts/vite.config.mjs']);
  // Enforce bundle size budget (sum of JS assets)
  try {
    const maxKb = Number(process.env.BUNDLE_MAX_KB || '50');
    const { readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = 'test/browser/contracts/dist/assets';
    let total = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      total += statSync(join(dir, f)).size;
    }
    const kb = Math.round(total / 1024);
    if (kb > maxKb) {
      throw new Error(`Bundle size ${kb}KB exceeds budget ${maxKb}KB (set BUNDLE_MAX_KB to override)`);
    }
    console.log(`[bundle-budget] OK: ${kb}KB <= ${maxKb}KB`);
  } catch (e) {
    console.error('[bundle-budget] check failed:', e?.message || e);
    throw e;
  }

  // Serve dist
  const srv = spawn(process.execPath, ['scripts/serve-static.mjs', '--dir=test/browser/contracts/dist'], { stdio: 'inherit' });
  try {
    await waitFor('http://127.0.0.1:8787');
  } catch (e) {
    srv.kill('SIGKILL');
    throw e;
  }

  // Ensure playwright installed (skip if cache present) and run spec, capture JSON
  try {
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || `${process.env.HOME}/.cache/ms-playwright`;
    const { readdirSync, existsSync } = await import('node:fs');
    let haveChromium = false;
    try {
      if (existsSync(browsersPath)) {
        haveChromium = readdirSync(browsersPath).some((n) => n.startsWith('chromium'));
      }
    } catch {}
    if (!haveChromium) {
      await sh('pnpm', ['dlx', 'playwright@latest', 'install', 'chromium']);
    }
    const outDir = mkdtempSync(join(tmpdir(), 'hc-'));
    const outFile = join(outDir, 'browser.json');
    await sh('pnpm', ['dlx', 'playwright@latest', 'test', 'test/browser/contracts/host-contracts.spec.mjs', '--reporter=line'], { env: { ...process.env, OUT_JSON: outFile } });
    const json = readFileSync(outFile, 'utf8');
    process.stdout.write(json + '\n');
  } finally {
    srv.kill('SIGKILL');
  }
}

main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
