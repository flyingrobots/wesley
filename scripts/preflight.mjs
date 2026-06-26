#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.env.SKIP_PREFLIGHT === '1') {
  console.log('SKIP_PREFLIGHT=1 set — skipping preflight checks');
  process.exit(0);
}

let ok = true;
const failures = [];

function fail(msg) {
  ok = false;
  failures.push(msg);
}

const gitIdentityChk = spawnSync(process.execPath, ['scripts/check-git-identity.mjs'], {
  stdio: 'inherit'
});
if (gitIdentityChk.status !== 0) fail('Git identity guard failed');

const scriptUnitTests = readdirSync(resolve('scripts'))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => `scripts/${file}`);
if (scriptUnitTests.length) {
  const scriptUnitChk = spawnSync(process.execPath, ['--test', ...scriptUnitTests], {
    stdio: 'inherit'
  });
  if (scriptUnitChk.status !== 0) fail('Script unit tests failed');
}

// .gitignore files contain generated-output ignores.
function requireIgnorePatterns(path, patterns) {
  let gi;
  try {
    gi = readFileSync(resolve(path), 'utf8');
  } catch {
    fail(`Missing ${path}`);
    return;
  }

  for (const [pattern, message] of patterns) {
    if (!gi.match(pattern)) fail(message);
  }
}

requireIgnorePatterns('.gitignore', [
  [/^\.wesley-cache\//m, 'Missing .wesley-cache/ in .gitignore'],
  [
    /^test\/fixtures\/examples\/\.wesley-cache\//m,
    'Missing test/fixtures/examples/.wesley-cache/ in .gitignore'
  ],
  [
    /^wesley\.holmes-policy\.local\.json$/m,
    'Missing wesley.holmes-policy.local.json in .gitignore'
  ],
  [/^out\//m, 'Missing out/ in .gitignore (covers generated outputs)']
]);
requireIgnorePatterns('test/fixtures/examples/.gitignore', [
  [/^\/out\/$/m, 'Missing /out/ in test/fixtures/examples/.gitignore'],
  [/^\/\.wesley-cache\/$/m, 'Missing /.wesley-cache/ in test/fixtures/examples/.gitignore']
]);
requireIgnorePatterns('test/fixtures/blade/.gitignore', [
  [/^\/out\/$/m, 'Missing /out/ in test/fixtures/blade/.gitignore'],
  [/^\/\.wesley-cache\/$/m, 'Missing /.wesley-cache/ in test/fixtures/blade/.gitignore']
]);

// No macOS runners in workflows.
try {
  const dir = resolve('.github/workflows');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const f of files) {
    const c = readFileSync(resolve(dir, f), 'utf8');
    if (/macos-latest/.test(c)) fail(`macOS runner referenced in ${f}`);
  }
} catch {
  // Intentionally ignored: workflows dir may not exist in some environments
  // (forks, minimal clones). This check is best-effort only.
}

// No Claude code workflows.
try {
  const dir = resolve('.github/workflows');
  const files = readdirSync(dir).filter((f) => f.includes('claude'));
  if (files.length) fail(`Claude workflows present: ${files.join(', ')}`);
} catch {
  // Intentionally ignored: workflows dir may not exist
}

// Docs link check.
const linkChk = spawnSync(process.execPath, ['scripts/check-doc-links.mjs'], { stdio: 'inherit' });
if (linkChk.status !== 0) fail('Docs link check failed');

// Docs truth check.
const truthChk = spawnSync(process.execPath, ['scripts/check-doc-truth.mjs'], { stdio: 'inherit' });
if (truthChk.status !== 0) fail('Docs truth check failed');

// Forbidden machine-local path literals.
const privatePathChk = spawnSync(process.execPath, ['scripts/check-forbidden-literals.mjs'], {
  stdio: 'inherit'
});
if (privatePathChk.status !== 0) fail('Forbidden machine-local path literal check failed');

// Front-door CLI examples should name registered Wesley commands.
const docCliChk = spawnSync(process.execPath, ['scripts/check-doc-cli-commands.mjs'], {
  stdio: 'inherit'
});
if (docCliChk.status !== 0) fail('Docs CLI command check failed');

const packageManagerPolicyChk = spawnSync(
  process.execPath,
  ['scripts/check-package-manager-policy.mjs'],
  { stdio: 'inherit' }
);
if (packageManagerPolicyChk.status !== 0) fail('Package manager policy check failed');

// Architecture boundaries via dependency-cruiser.
function runOrFail(cmd, args, msg) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) fail(msg);
}

// Enforce pnpm-only to match workspace policy (version already checked above)

runOrFail(
  'pnpm',
  ['exec', 'depcruise', '--config', '.dependency-cruiser.mjs', 'packages/'],
  'dependency-cruiser boundary check failed'
);

// License audit: ensure all packages use Apache-2.0 (dynamic discovery).
try {
  const ls = spawnSync('pnpm', ['ls', '-r', '--json', '--depth=-1'], { encoding: 'utf8' });
  if (ls.status !== 0) throw new Error(`pnpm ls failed with code ${ls.status}`);
  const list = JSON.parse(ls.stdout || '[]');
  // Include all workspace packages returned by pnpm ls
  const packageJsonPaths = new Set();
  for (const entry of list) {
    if (!entry.path) continue;
    packageJsonPaths.add(resolve(entry.path, 'package.json'));
  }
  for (const p of packageJsonPaths) {
    let content;
    try {
      content = JSON.parse(readFileSync(p, 'utf8'));
    } catch (err) {
      fail(`License audit: failed to read ${p}: ${err?.message || err}`);
      continue;
    }
    if (content.license !== 'Apache-2.0') {
      fail(`License mismatch in ${p}: ${content.license}`);
    }
  }
} catch (e) {
  fail(`License audit failed: ${e?.message || e}`);
}

if (!ok) {
  console.error('\n❌ Preflight failed with the following issues:');
  for (const m of failures) console.error(' -', m);
  console.error('\nSet SKIP_PREFLIGHT=1 to bypass (not recommended).');
  process.exit(1);
}

console.log('✅ Preflight OK');
