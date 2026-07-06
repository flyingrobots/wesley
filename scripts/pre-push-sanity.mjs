#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

  const changedFiles =
    explicitFiles && explicitFiles.length > 0 ? explicitFiles : collectChangedFiles(readStdin());

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
      console.log(`    $ ${formatCommand(command)}`);
    }
  }

  if (dryRun) return;

  for (const command of commands) {
    runCommand(command);
  }
}

function buildCommands(changedFiles) {
  const commands = [];
  const seen = new Set();
  const packages = loadPackageTests();
  const touchedPackages = new Set();

  const addCommand = (key, label, cmd, args) => {
    if (seen.has(key)) return;
    seen.add(key);
    commands.push({ key, label, cmd, args });
  };

  for (const file of changedFiles) {
    const packageName = packageForFile(file, packages);
    if (packageName) touchedPackages.add(packageName);
  }

  if (needsPreflight(changedFiles)) {
    addCommand('preflight', 'Rust product preflight', 'cargo', ['xtask', 'preflight']);
  }

  if (needsLegacyPreflight(changedFiles)) {
    addCommand('legacy-preflight', 'JavaScript package preflight', 'cargo', [
      'xtask',
      'legacy-preflight'
    ]);
  }

  if (needsRepoBats(changedFiles)) {
    addCommand('repo-bats', 'Repo Bats smoke suite', 'bash', [
      'scripts/smoke/repo-bats-prepush.sh'
    ]);
  }

  for (const packageName of [...touchedPackages].sort()) {
    addCommand(`package:${packageName}`, `${packageName} tests`, 'pnpm', [
      '--filter',
      packageName,
      'test'
    ]);
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
    if (!existsSync(packageJsonPath)) continue;
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
  return changedFiles.some(
    (file) =>
      file === 'Cargo.lock' ||
      file === 'Cargo.toml' ||
      file === 'package.json' ||
      file.startsWith('.github/') ||
      file.startsWith('.githooks/') ||
      file.startsWith('crates/') ||
      file.startsWith('docs/') ||
      file.startsWith('schemas/') ||
      file.startsWith('scripts/') ||
      file.startsWith('xtask/') ||
      file.endsWith('/package.json')
  );
}

function needsLegacyPreflight(changedFiles) {
  return changedFiles.some(
    (file) =>
      file === 'package.json' ||
      file === 'pnpm-lock.yaml' ||
      file === 'pnpm-workspace.yaml' ||
      file.startsWith('.dependency-cruiser') ||
      file.startsWith('packages/') ||
      file === 'scripts/preflight.mjs' ||
      file === 'scripts/check-doc-cli-commands.mjs'
  );
}

function needsRepoBats(changedFiles) {
  return changedFiles.some(
    (file) =>
      file.startsWith('.github/') ||
      file.startsWith('.githooks/') ||
      file.startsWith('scripts/') ||
      file.startsWith('test/')
  );
}

function collectChangedFiles(stdinText) {
  const lines = stdinText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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
  return gitText(args)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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

function runCommand(command) {
  console.log(`[pre-push] Running ${command.label}`);
  const resolvedCommand = resolveCommand(command);
  const result = spawnSync(resolvedCommand.cmd, resolvedCommand.args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: buildGitDiscoveryEnv(process.env),
    shell: false
  });
  if (result.error) {
    console.error(formatSpawnFailure(command, result.error));
    process.exit(1);
  }
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

function formatCommand(command) {
  return [command.cmd, ...command.args].map(formatCommandArg).join(' ');
}

function resolveCommand(command, { platform = process.platform, env = process.env } = {}) {
  if (platform === 'win32' && command.cmd === 'pnpm') {
    return {
      cmd: env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', command.cmd, ...command.args]
    };
  }
  return command;
}

function formatSpawnFailure(command, error) {
  return [
    `[pre-push] Failed to start ${command.label}: ${formatCommand(command)}`,
    `[pre-push] ${error?.message ?? 'unknown spawn error'}`
  ].join('\n');
}

function formatCommandArg(value) {
  const raw = String(value);
  if (raw.length > 0 && /^[A-Za-z0-9_./:=@%+,-]+$/.test(raw)) {
    return raw;
  }
  return `'${raw.replaceAll("'", "'\"'\"'")}'`;
}

function buildGitDiscoveryEnv(env) {
  return {
    ...env,
    GIT_OPTIONAL_LOCKS: env.GIT_OPTIONAL_LOCKS || '0'
  };
}

function isDirectInvocation() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectInvocation()) {
  main();
}

export { buildCommands, formatCommand, formatSpawnFailure, resolveCommand };
