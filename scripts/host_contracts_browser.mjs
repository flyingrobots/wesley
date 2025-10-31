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
    p.on('error', (err) => reject(err));
    p.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} ${args.join(' ')} exited ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`))
    );
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
  const port = process.env.TEST_SERVER_PORT || '8787';
  let srvErr = '';
  const srv = spawn(process.execPath, ['scripts/serve-static.mjs', '--dir=test/browser/contracts/dist', `--port=${port}`], { stdio: ['ignore','pipe','pipe'] });
  srv.on('error', (e) => { srvErr += `\n[spawn-error] ${e?.message || e}`; throw new Error(`serve-static failed to spawn: ${e?.message || e}`); });
  srv.stderr?.on('data', (d) => { srvErr += d.toString(); if (srvErr.length > 2000) srvErr = srvErr.slice(-2000); });
  try {
    await waitFor(`http://127.0.0.1:${port}`);
  } catch (e) {
    try { srv.kill('SIGTERM'); await sleep(1000); if (!srv.killed) srv.kill('SIGKILL'); } catch {}
    const err = new Error(`Static server failed to start: ${e?.message || e}\n${srvErr}`);
    throw err;
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
    const PWV = process.env.PLAYWRIGHT_VERSION || '1.43.0';
    if (!haveChromium) {
      await sh('pnpm', ['dlx', `playwright@${PWV}`, 'install', 'chromium']);
    }
    const provided = (process.env.OUT_JSON || '').trim();
    let outFile = provided;
    if (!outFile) {
      const outDir = mkdtempSync(join(tmpdir(), 'hc-'));
      outFile = join(outDir, 'browser.json');
    }
    await sh('pnpm', ['dlx', `playwright@${PWV}`, 'test', 'test/browser/contracts/host-contracts.spec.mjs', '--reporter=line'], { env: { ...process.env, OUT_JSON: outFile } });
    const json = readFileSync(outFile, 'utf8');
    try {
      const res = JSON.parse(json);
      if (res && typeof res.failed === 'number' && res.failed > 0) {
        const fail = Array.isArray(res.cases) && res.cases.find((c) => c && c.name === 'browser-ir-shape' && c.ok === false);
        if (fail && fail.details) {
          const { summary, missingTables, missingColumns, actualTableCount, expectedTableCount } = fail.details;
          console.error('[host-contracts][diagnostics] verifyIr failed');
          if (typeof expectedTableCount === 'number' && typeof actualTableCount === 'number') {
            console.error(` - tables: expected=${expectedTableCount} actual=${actualTableCount}`);
          }
          if (Array.isArray(missingTables) && missingTables.length) {
            console.error(` - missing tables: ${missingTables.join(', ')}`);
          }
          if (missingColumns && typeof missingColumns === 'object') {
            for (const [t, cols] of Object.entries(missingColumns)) {
              if (Array.isArray(cols) && cols.length) console.error(` - ${t} missing columns: ${cols.join(', ')}`);
            }
          }
          if (summary) console.error(` - summary: ${summary}`);
        }
      }
    } catch (e) {
      console.error('[host-contracts][diagnostics] failed to parse OUT_JSON:', e?.message || e);
      // Surface the problem to CI while still emitting whatever was read
      process.exitCode = 1;
    }
    process.stdout.write(json + '\n');
  } finally {
    try { srv.kill('SIGTERM'); await sleep(1000); if (!srv.killed) srv.kill('SIGKILL'); } catch {}
  }
}

main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
