#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve('.');
const docs = ['README.md', 'docs/GUIDE.md'];

function fail(message) {
  console.error(`docs-cli: ${message}`);
  process.exitCode = 1;
}

function normalizeCommandToken(token) {
  return String(token || '')
    .trim()
    .replace(/\\$/, '')
    .split('|')[0]
    .trim();
}

function loadWesleyCommands() {
  const result = spawnSync(
    process.execPath,
    ['packages/wesley-host-node/bin/wesley.mjs', '--help'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        WESLEY_DISABLE_MODULES: '1',
        WESLEY_MODULES: '',
        WESLEY_CONFIG: '',
        WESLEY_MODULE_ALLOWLIST: ''
      }
    }
  );
  if (result.status !== 0) {
    fail(`failed to read Wesley CLI help: ${result.stderr || result.stdout}`);
    return new Set();
  }

  const commands = new Set();
  let inCommands = false;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.trim() === 'Commands:') {
      inCommands = true;
      continue;
    }
    if (!inCommands) continue;
    const match = line.match(/^\s{2}([a-z][a-z0-9-]*(?:\|[a-z][a-z0-9-]*)?)/);
    if (match) {
      for (const token of match[1].split('|')) {
        commands.add(normalizeCommandToken(token));
      }
    }
  }
  return commands;
}

function extractDocumentedCommands(content) {
  const documented = [];
  const commandRe = /\bpnpm\s+wesley(?:\s+([^\n`]+))?/g;
  let match;
  while ((match = commandRe.exec(content)) !== null) {
    const tail = String(match[1] || '').trim();
    const token = normalizeCommandToken(tail.split(/\s+/)[0]);
    if (!token || token.startsWith('-')) continue;
    documented.push(token);
  }
  return documented;
}

const commands = loadWesleyCommands();
for (const doc of docs) {
  const content = readFileSync(resolve(root, doc), 'utf8');
  for (const command of extractDocumentedCommands(content)) {
    if (!commands.has(command)) {
      fail(`${doc} documents "pnpm wesley ${command}", but the Wesley CLI does not expose that command`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ Front-door Wesley CLI examples match registered commands');
