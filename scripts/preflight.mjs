#!/usr/bin/env node
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

if (process.env.SKIP_PREFLIGHT === '1') {
  console.log('SKIP_PREFLIGHT=1 set — skipping preflight checks');
  process.exit(0);
}

let ok = true;
const failures = [];

function fail(msg) { ok = false; failures.push(msg); }

// 1) .gitignore contains .wesley/ and out/
try {
  const gi = readFileSync(resolve('.gitignore'), 'utf8');
  if (!gi.match(/^\.wesley\//m)) fail('Missing .wesley/ in .gitignore');
  if (!gi.match(/^test\/fixtures\/examples\/\.wesley\//m)) fail('Missing test/fixtures/examples/.wesley/ in .gitignore');
  if (!gi.match(/^out\//m)) fail('Missing out/ in .gitignore (covers generated outputs)');
  if (!gi.match(/^test\/fixtures\/examples\/out\//m)) fail('Missing test/fixtures/examples/out/ in .gitignore');
  if (!gi.match(/^test\/fixtures\/blade\/out\//m)) fail('Missing test/fixtures/blade/out/ in .gitignore');
} catch {
  fail('Missing .gitignore');
}

// 2) No macOS runners in workflows
try {
  const dir = resolve('.github/workflows');
  const files = readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const f of files) {
    const c = readFileSync(resolve(dir, f), 'utf8');
    if (/macos-latest/.test(c)) fail(`macOS runner referenced in ${f}`);
  }
} catch {
  // Intentionally ignored: workflows dir may not exist in some environments
  // (forks, minimal clones). This check is best-effort only.
}

// 3) No Claude code workflows
try {
  const dir = resolve('.github/workflows');
  const files = readdirSync(dir).filter(f => f.includes('claude'));
  if (files.length) fail(`Claude workflows present: ${files.join(', ')}`);
} catch {
  // Intentionally ignored: workflows dir may not exist
}

// 4) Core purity: disallow node:* imports and common node modules in core
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(resolve(dir, e.name)));
    else if (e.isFile() && e.name.endsWith('.mjs')) out.push(resolve(dir, e.name));
  }
  return out;
}

try {
  const coreDir = resolve('packages/wesley-core/src');
  const files = walk(coreDir);
  for (const f of files) {
    const c = readFileSync(f, 'utf8');
    if (/from\s+['"]node:/.test(c) || /require\(['"]node:/.test(c)) fail(`node:* import in core: ${f}`);
    if (/\bfrom\s+['"](fs|path)(?:\/[^'"]*)?['"]/ .test(c) || /\brequire\(['"](fs|path)(?:\/[^'"]*)?['"]\)/ .test(c)) fail(`platform import in core: ${f}`);
    if (/\bprocess\./.test(c)) fail(`process.* used in core: ${f}`);
  }
} catch {
  // ignore if core missing
}

// 5) Docs link check
const linkChk = spawnSync(process.execPath, ['scripts/check-doc-links.mjs'], { stdio: 'inherit' });
if (linkChk.status !== 0) fail('Docs link check failed');

// 6) pnpm version consistency
try {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  const pm = pkg.packageManager || '';
  const required = pm.startsWith('pnpm@') ? pm.split('@')[1] : '';
  const res = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  if (res.status !== 0) {
    fail('pnpm is required for preflight');
  } else {
    const have = (res.stdout || '').trim();
    if (required && have !== required) {
      fail(`pnpm version mismatch: required ${required} from packageManager, found ${have}. Hint: corepack prepare pnpm@${required} --activate`);
    }
  }
} catch (e) {
  fail(`pnpm version check failed: ${e?.message || e}`);
}

// 7) Architecture boundaries via dependency-cruiser
function runOrFail(cmd, args, msg) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) fail(msg);
}

// Enforce pnpm-only to match workspace policy (version already checked above)

runOrFail(
  'pnpm', ['exec', 'depcruise', '--config', '.dependency-cruiser.mjs', 'packages/'],
  'dependency-cruiser boundary check failed'
);

// 7) ESLint core purity (use repo's ESLint version, flat-config compatible)
try {
  const flatConfigPath = resolve(tmpdir(), `eslint.core-purity.${Date.now()}.config.mjs`);
  const cfg = `export default [{\n    files: [\"packages/wesley-core/src/**/*.mjs\"],\n    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },\n    rules: {\n      'no-restricted-imports': [\n        'error',\n        {\n          patterns: [ { group: ['node:*'], message: 'Do not use Node built-ins in core (keep it pure).' } ],\n          paths: [\n            { name: 'fs', message: 'Use ports/adapters; no fs in core.' },\n            { name: 'path', message: 'Use ports/adapters; no path in core.' },\n            { name: 'process', message: 'Do not use process in core.' },\n            { name: 'child_process', message: 'No child_process in core.' },\n            { name: 'os', message: 'No os in core.' },\n            { name: 'buffer', message: 'No Buffer usage in core.' }\n          ]\n        }\n      ]\n    }\n  }];\n`;
  writeFileSync(flatConfigPath, cfg, 'utf8');
  runOrFail('pnpm', ['exec', 'eslint', '--config', flatConfigPath, 'packages/wesley-core/src/**/*.mjs', '--max-warnings=0'], 'ESLint core purity check failed');
} catch (e) {
  fail(`ESLint core purity check failed to run: ${e?.message || e}`);
}

// 8) License audit — ensure all packages use MIND-UCAL (dynamic discovery)
try {
  const ls = spawnSync('pnpm', ['ls', '-r', '--json', '--depth=-1'], { encoding: 'utf8' });
  if (ls.status !== 0) throw new Error(`pnpm ls failed with code ${ls.status}`);
  const list = JSON.parse(ls.stdout || '[]');
  // Include root and all workspace packages
  const packageJsonPaths = new Set();
  for (const entry of list) {
    if (!entry.path) continue;
    packageJsonPaths.add(resolve(entry.path, 'package.json'));
  }
  // Ensure root package.json is included
  packageJsonPaths.add(resolve('package.json'));
  for (const p of packageJsonPaths) {
    let content;
    try {
      content = JSON.parse(readFileSync(p, 'utf8'));
    } catch (err) {
      fail(`License audit: failed to read ${p}: ${err?.message || err}`);
      continue;
    }
    if (content.license !== 'LicenseRef-MIND-UCAL-1.0') {
      fail(`License mismatch in ${p}: ${content.license}`);
    }
  }
} catch (e) {
  fail(`License audit failed: ${e?.message || e}`);
}

// 9) Validate changed QIR/Envelope/Manifest files via CLI validators
try {
  const base = process.env.WESLEY_BASE_REF || process.env.GITHUB_BASE_REF || 'origin/main';
  let baseSha = '';
  try {
    const mb = spawnSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' });
    if (mb.status === 0) baseSha = (mb.stdout || '').trim();
  } catch {}
  const diffArgs = baseSha ? ['diff', '--name-only', '--diff-filter=ACMRTUXB', baseSha] : ['ls-files'];
  const df = spawnSync('git', diffArgs, { encoding: 'utf8' });
  const files = (df.stdout || '').split(/\r?\n/).filter(Boolean);
  const qirFiles = files.filter(f => f.endsWith('.qir.json'));
  const envFiles = files.filter(f => /(^|\/)ir-?envelope(\.json)?$/.test(f) || f.endsWith('sample-envelope.json'));
  const manFiles = files.filter(f => /ops\.manifest\.json$|ops-manifest\.json$/.test(f));
  // Also validate any emitted ops registry if present in out/**/ops/registry.json
  const cli = existsSync('packages/wesley-host-node/bin/wesley.mjs') ? 'packages/wesley-host-node/bin/wesley.mjs' : 'node_modules/.bin/wesley';
  for (const f of qirFiles) {
    const r = spawnSync(process.execPath, [cli, 'qir', 'validate', f], { stdio: 'inherit' });
    if (r.status !== 0) fail(`QIR validation failed for ${f}`);
  }
  for (const f of envFiles) {
    const r = spawnSync(process.execPath, [cli, 'qir', 'envelope-validate', f], { stdio: 'inherit' });
    if (r.status !== 0) fail(`IR envelope validation failed for ${f}`);
  }
  for (const f of manFiles) {
    const r = spawnSync(process.execPath, [cli, 'qir', 'manifest-validate', f], { stdio: 'inherit' });
    if (r.status !== 0) fail(`Ops manifest validation failed for ${f}`);
  }
  // Discover and validate registries under out/**/ops/registry.json if present (best-effort)
  try {
    const findRegistries = (dir) => {
      const out = [];
      const walk = (p) => {
        let ents = [];
        try { ents = readdirSync(p, { withFileTypes: true }); } catch { return; }
        for (const e of ents) {
          const full = resolve(p, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.isFile() && /\bops\/registry\.json$/.test(full)) out.push(full);
        }
      };
      walk(dir);
      return out;
    };
    const outDir = resolve('out');
    if (existsSync(outDir)) {
      for (const reg of findRegistries(outDir)) {
        const r = spawnSync(process.execPath, [cli, 'qir', 'registry-validate', reg], { stdio: 'inherit' });
        if (r.status !== 0) fail(`Ops registry validation failed for ${reg}`);
      }
    }
  } catch (e) {
    // Non-fatal: registry may not exist in all runs
  }
} catch (e) {
  fail(`QIR/Envelope/Manifest validation step failed to run: ${e?.message || e}`);
}

if (!ok) {
  console.error('\n❌ Preflight failed with the following issues:');
  for (const m of failures) console.error(' -', m);
  console.error('\nSet SKIP_PREFLIGHT=1 to bypass (not recommended).');
  process.exit(1);
}

console.log('✅ Preflight OK');
