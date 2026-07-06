import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCommands, formatCommand } from './pre-push-sanity.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), '..');

test('pre-push sanity builds argv commands for selected checks', () => {
  const commands = buildCommands([
    'crates/wesley-cli/src/main.rs',
    'scripts/pre-push-sanity.mjs',
    'packages/wesley-holmes/src/cli.mjs'
  ]);

  assert.deepEqual(commandByKey(commands, 'preflight'), {
    key: 'preflight',
    label: 'Rust product preflight',
    cmd: 'cargo',
    args: ['xtask', 'preflight']
  });
  assert.deepEqual(commandByKey(commands, 'legacy-preflight'), {
    key: 'legacy-preflight',
    label: 'JavaScript package preflight',
    cmd: 'cargo',
    args: ['xtask', 'legacy-preflight']
  });
  assert.deepEqual(commandByKey(commands, 'repo-bats'), {
    key: 'repo-bats',
    label: 'Repo Bats smoke suite',
    cmd: 'bash',
    args: ['scripts/smoke/repo-bats-prepush.sh']
  });
  assert.deepEqual(commandByKey(commands, 'package:@wesley/holmes'), {
    key: 'package:@wesley/holmes',
    label: '@wesley/holmes tests',
    cmd: 'pnpm',
    args: ['--filter', '@wesley/holmes', 'test']
  });
});

test('pre-push sanity formats dry-run commands without making them executable input', () => {
  assert.equal(
    formatCommand({
      cmd: 'pnpm',
      args: ['--filter', '@wesley/holmes', 'test']
    }),
    'pnpm --filter @wesley/holmes test'
  );
  assert.equal(
    formatCommand({
      cmd: 'tool',
      args: ['value with spaces', "quote'value"]
    }),
    "tool 'value with spaces' 'quote'\"'\"'value'"
  );
});

test('pre-push sanity does not execute selected checks through a shell', () => {
  const source = readFileSync(resolve(repoRoot, 'scripts/pre-push-sanity.mjs'), 'utf8');

  assert.doesNotMatch(source, /spawnSync\(['"]\/bin\/bash['"],\s*\[\s*['"]-lc['"]/);
  assert.doesNotMatch(source, /function shellQuote\b/);
});

function commandByKey(commands, key) {
  return commands.find((command) => command.key === key);
}
