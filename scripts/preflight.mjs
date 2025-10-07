#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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
  if (!gi.match(/^out\//m)) fail('Missing out/ in .gitignore (covers example/out)');
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
  // ignore if workflows folder missing
}

// 3) No Claude code workflows
try {
  const dir = resolve('.github/workflows');
  const files = readdirSync(dir).filter(f => f.includes('claude'));
  if (files.length) fail(`Claude workflows present: ${files.join(', ')}`);
} catch {}

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
    if (/from\s+['"]fs['"]/.test(c) || /from\s+['"]path['"]/.test(c)) fail(`platform import in core: ${f}`);
    if (/\bprocess\./.test(c)) fail(`process.* used in core: ${f}`);
  }
} catch {
  // ignore if core missing
}

// 5) Docs link check
const linkChk = spawnSync(process.execPath, ['scripts/check-doc-links.mjs'], { stdio: 'inherit' });
if (linkChk.status !== 0) fail('Docs link check failed');

if (!ok) {
  console.error('\n❌ Preflight failed with the following issues:');
  for (const m of failures) console.error(' -', m);
  console.error('\nSet SKIP_PREFLIGHT=1 to bypass (not recommended).');
  process.exit(1);
}

console.log('✅ Preflight OK');

