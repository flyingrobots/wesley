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

// .gitignore contains generated-output ignores.
try {
  const gi = readFileSync(resolve('.gitignore'), 'utf8');
  if (!gi.match(/^\.wesley-cache\//m)) fail('Missing .wesley-cache/ in .gitignore');
  if (!gi.match(/^test\/fixtures\/examples\/\.wesley-cache\//m))
    fail('Missing test/fixtures/examples/.wesley-cache/ in .gitignore');
  if (!gi.match(/^wesley\.holmes-policy\.local\.json$/m))
    fail('Missing wesley.holmes-policy.local.json in .gitignore');
  if (!gi.match(/^out\//m)) fail('Missing out/ in .gitignore (covers generated outputs)');
  if (!gi.match(/^test\/fixtures\/examples\/out\//m))
    fail('Missing test/fixtures/examples/out/ in .gitignore');
  if (!gi.match(/^test\/fixtures\/blade\/out\//m))
    fail('Missing test/fixtures/blade/out/ in .gitignore');
} catch {
  fail('Missing .gitignore');
}

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

// pnpm version consistency.
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
      fail(
        `pnpm version mismatch: required ${required} from packageManager, found ${have}. Hint: corepack prepare pnpm@${required} --activate`
      );
    }
  }
} catch (e) {
  fail(`pnpm version check failed: ${e?.message || e}`);
}

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

// Progress weights completeness: required packages must have explicit weights.
try {
  const cfg = JSON.parse(readFileSync(resolve('meta/progress.config.json'), 'utf8'));
  const weights = (cfg.project && cfg.project.weights) || {};
  const req = new Set(
    [].concat(
      cfg.project?.requiredForAlpha || [],
      cfg.project?.requiredForBeta || [],
      cfg.project?.requiredForV1 || []
    )
  );
  const missing = [];
  for (const name of req) {
    if (!(name in weights) || !Number.isFinite(Number(weights[name]))) {
      missing.push(name);
    }
  }
  if (missing.length) {
    fail(`Progress weights missing for required packages: ${missing.join(', ')}`);
  }
} catch (e) {
  fail(`Progress weights completeness check failed: ${e?.message || e}`);
}

// Docs whitespace rule: avoid trailing double-space line breaks on Status lines.
try {
  const cfg = JSON.parse(readFileSync(resolve('meta/progress.config.json'), 'utf8'));
  const offenders = [];
  for (const p of cfg.packages || []) {
    const rp = p.readme;
    if (!rp) continue;
    let content = '';
    try {
      content = readFileSync(resolve(rp), 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Status:\s.*\s\s$/.test(line)) {
        offenders.push(`${rp}:${i + 1}`);
      }
    }
  }
  if (offenders.length) {
    fail(
      `Docs whitespace: trailing double-spaces after Status lines found at: ${offenders.join(', ')}`
    );
  }
} catch (e) {
  fail(`Docs whitespace check failed: ${e?.message || e}`);
}

if (!ok) {
  console.error('\n❌ Preflight failed with the following issues:');
  for (const m of failures) console.error(' -', m);
  console.error('\nSet SKIP_PREFLIGHT=1 to bypass (not recommended).');
  process.exit(1);
}

console.log('✅ Preflight OK');
