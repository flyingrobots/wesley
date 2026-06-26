#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.argv[2] || '.');
const failures = [];

function fail(message) {
  failures.push(message);
}

function readPackageManager() {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  } catch (error) {
    fail(`package-manager policy: failed to read package.json: ${error?.message || error}`);
    return null;
  }

  const packageManager = String(pkg.packageManager || '');
  const match = packageManager.match(/^pnpm@(.+)$/);
  if (!match) {
    fail(
      `package-manager policy: package.json packageManager must be pnpm@<version>; found ${packageManager || '<missing>'}`
    );
    return null;
  }

  return { packageManager, requiredVersion: match[1] };
}

function checkPnpmVersion(requiredVersion) {
  const result = spawnSync('pnpm', ['--version'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    fail(
      `package-manager policy: pnpm is required. Run: corepack enable && corepack prepare pnpm@${requiredVersion} --activate`
    );
    return;
  }

  const actualVersion = String(result.stdout || '').trim();
  if (actualVersion !== requiredVersion) {
    fail(
      `package-manager policy: pnpm version mismatch: required ${requiredVersion} from packageManager, found ${actualVersion}. Run: corepack prepare pnpm@${requiredVersion} --activate`
    );
  }
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    fail(`package-manager policy: git ls-files failed: ${result.stderr.trim()}`);
    return [];
  }

  return result.stdout.split('\0').filter(Boolean);
}

function checkLockfiles(files) {
  if (!files.includes('pnpm-lock.yaml')) {
    fail('package-manager policy: root pnpm-lock.yaml must be tracked');
  }

  const forbiddenBasenames = new Set([
    'bun.lock',
    'bun.lockb',
    'deno.lock',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'yarn.lock'
  ]);

  for (const file of files) {
    const basename = file.split('/').pop();
    if (forbiddenBasenames.has(basename)) {
      fail(`package-manager policy: forbidden lockfile is tracked: ${file}`);
    }

    if (basename === 'pnpm-lock.yaml' && file !== 'pnpm-lock.yaml') {
      fail(`package-manager policy: nested pnpm lockfile is not allowed: ${file}`);
    }
  }
}

const policy = readPackageManager();
if (policy) {
  checkPnpmVersion(policy.requiredVersion);
}
checkLockfiles(trackedFiles());

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('package-manager policy: OK');
