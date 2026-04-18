#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildGitDiscoveryEnv } from '../packages/wesley-cli/src/utils/git-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const ZERO_SHA = '0000000000000000000000000000000000000000';

function main() {
  process.chdir(ROOT_DIR);

  if (process.env.CI === 'true' || process.env.SKIP_PREPUSH_SANITY === '1') {
    process.exit(0);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || process.env.WESLEY_PREPUSH_DRY_RUN === '1';
  const filesArgIndex = args.indexOf('--files');
  const explicitFiles = filesArgIndex === -1 ? null : args.slice(filesArgIndex + 1).filter(Boolean);

  const changedFiles = explicitFiles && explicitFiles.length > 0
    ? explicitFiles
    : collectChangedFiles(readStdin());

  if (changedFiles.length === 0) {
    console.log('[pre-push] No changed files detected; skipping sanity checks.');
    return;
  }

  const commands = buildCommands(changedFiles);
  if (commands.length === 0) {
    console.log('[pre-push] No matching sanity checks for changed files.');
    return;
  }

  console.log(`[pre-push] Changed files (${changedFiles.length}):`);
  for (const file of changedFiles) {
    console.log(`  - ${file}`);
  }

  console.log('[pre-push] Selected checks:');
  for (const command of commands) {
    console.log(`  - ${command.label}`);
    if (dryRun) {
      console.log(`    $ ${command.command}`);
    }
  }

  if (dryRun) return;

  for (const command of commands) {
    runCommand(command.label, command.command);
  }
}

function buildCommands(changedFiles) {
  const commands = [];
  const seen = new Set();
  const packages = loadPackageTests();
  const touchedPackages = new Set();

  const addCommand = (key, label, command) => {
    if (seen.has(key)) return;
    seen.add(key);
    commands.push({ key, label, command });
  };

  for (const file of changedFiles) {
    const packageName = packageForFile(file, packages);
    if (packageName) touchedPackages.add(packageName);
  }

  if (needsPreflight(changedFiles)) {
    addCommand('preflight', 'Repository preflight', 'pnpm run preflight');
  }

  if (needsRepoBats(changedFiles)) {
    addCommand('repo-bats', 'Repo Bats smoke suite', 'bash scripts/smoke/repo-bats-prepush.sh');
  }

  if (needsHolmesOpsSmoke(changedFiles)) {
    addCommand('holmes-ops', 'HOLMES ops/Postgres smoke', 'bash scripts/smoke/holmes-ops-pgtap.sh');
  }

  for (const packageName of [...touchedPackages].sort()) {
    addCommand(
      `package:${packageName}`,
      `${packageName} tests`,
      `pnpm --filter ${shellQuote(packageName)} test`
    );
  }

  return commands;
}

function loadPackageTests() {
  const packagesDir = join(ROOT_DIR, 'packages');
  const entries = readdirSync(packagesDir, { withFileTypes: true });
  const byDir = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(packagesDir, entry.name, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson?.scripts?.test) {
      byDir.set(`packages/${entry.name}/`, packageJson.name);
    }
  }

  return byDir;
}

function packageForFile(file, packages) {
  for (const [prefix, packageName] of packages.entries()) {
    if (file.startsWith(prefix)) return packageName;
  }
  return null;
}

function needsPreflight(changedFiles) {
  return changedFiles.some((file) =>
    file === 'package.json' ||
    file === 'pnpm-lock.yaml' ||
    file === 'pnpm-workspace.yaml' ||
    file.startsWith('.github/') ||
    file.startsWith('.githooks/') ||
    file.startsWith('docs/') ||
    file.startsWith('schemas/') ||
    file.startsWith('scripts/') ||
    file.endsWith('/package.json')
  );
}

function needsRepoBats(changedFiles) {
  return changedFiles.some((file) =>
    file.startsWith('.github/') ||
    file.startsWith('.githooks/') ||
    file.startsWith('scripts/') ||
    file.startsWith('test/') ||
    file.startsWith('packages/wesley-host-browser/') ||
    file.startsWith('packages/wesley-host-bun/') ||
    file.startsWith('packages/wesley-host-deno/') ||
    file.startsWith('packages/wesley-host-node/') ||
    file.startsWith('packages/wesley-cli/src/commands/watch') ||
    file.startsWith('packages/wesley-core/src/cli/') ||
    file === 'packages/wesley-core/src/util/EventEmitter.mjs'
  );
}

function needsHolmesOpsSmoke(changedFiles) {
  return changedFiles.some((file) =>
    file === '.github/workflows/wesley-holmes.yml' ||
    file.startsWith('.github/actions/holmes-setup/') ||
    file.startsWith('packages/wesley-holmes/') ||
    file.startsWith('packages/wesley-runtime-node/') ||
    file.startsWith('packages/wesley-generator-supabase/') ||
    file.startsWith('packages/wesley-core/src/domain/qir/') ||
    file.startsWith('packages/wesley-core/src/application/CounterfactualSurface') ||
    file.startsWith('packages/wesley-core/src/application/GeneratedBundle') ||
    file.startsWith('packages/wesley-core/src/application/TransmutationRunner') ||
    file.startsWith('packages/wesley-core/src/application/Scoring') ||
    file.startsWith('packages/wesley-cli/src/commands/generate') ||
    file.startsWith('packages/wesley-cli/src/transmutations/') ||
    file.startsWith('test/fixtures/examples/') ||
    file.startsWith('test/fixtures/postgres/')
  );
}

function collectChangedFiles(stdinText) {
  const lines = stdinText.split('\n').map((line) => line.trim()).filter(Boolean);
  const files = new Set();

  for (const line of lines) {
    const [localRef, localSha, _remoteRef, remoteSha] = line.split(/\s+/);
    if (!localRef || !localSha || localSha === ZERO_SHA) continue;
    const diffFiles = diffFilesForUpdate(localRef, localSha, remoteSha);
    for (const file of diffFiles) {
      if (file) files.add(file);
    }
  }

  return [...files].sort();
}

function diffFilesForUpdate(localRef, localSha, remoteSha) {
  if (remoteSha && remoteSha !== ZERO_SHA) {
    return gitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', remoteSha, localSha]);
  }

  const upstream = gitText(['for-each-ref', '--format=%(upstream:short)', localRef]).trim();
  if (upstream) {
    return gitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', upstream, localSha]);
  }

  const mainBase = gitText(['merge-base', localSha, 'origin/main'], { allowFailure: true }).trim();
  if (mainBase) {
    return gitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', mainBase, localSha]);
  }

  const parent = gitText(['rev-parse', `${localSha}^`], { allowFailure: true }).trim();
  if (parent) {
    return gitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', parent, localSha]);
  }

  return gitLines(['diff-tree', '--no-commit-id', '--name-only', '-r', localSha]);
}

function gitLines(args) {
  return gitText(args).split('\n').map((line) => line.trim()).filter(Boolean);
}

function gitText(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) {
    if (options.allowFailure) return '';
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function runCommand(label, command) {
  console.log(`[pre-push] Running ${label}`);
  const result = spawnSync('/bin/bash', ['-lc', command], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: buildGitDiscoveryEnv(process.env)
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

main();
