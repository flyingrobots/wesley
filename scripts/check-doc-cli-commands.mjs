#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve('.');
const docs = ['README.md', 'docs/GUIDE.md', 'docs/ENTRYPOINTS.md', 'docs/END_TO_END.md'];

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
  const result = spawnSync('cargo', ['run', '--bin', 'wesley', '--', '--help'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  if (result.status !== 0) {
    fail(`failed to read native Wesley CLI help: ${result.stderr || result.stdout}`);
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
    const match = line.match(/^\s{2}([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)?)/);
    if (match) {
      commands.add(normalizeCommandToken(match[1]));
    }
  }
  return commands;
}

function extractDocumentedCommands(content) {
  const documented = [];
  for (const snippet of extractCommandSnippets(content)) {
    if (snippet.includes('pnpm wesley') || snippet.includes('...')) continue;
    const match = snippet.match(/^\$?\s*(?:cargo\s+wesley|wesley)(?![-/])(?:\s+(.+))?$/);
    if (!match) continue;
    const tail = String(match[1] || '').trim();
    const parts = tail.split(/\s+/).map(normalizeCommandToken).filter(Boolean);
    if (parts.length === 0 || parts[0].startsWith('-')) continue;
    if (
      ['schema', 'emit', 'operation'].includes(parts[0]) &&
      parts[1] &&
      !parts[1].startsWith('-')
    ) {
      documented.push(`${parts[0]} ${parts[1]}`);
      continue;
    }
    documented.push(parts[0]);
  }
  return documented;
}

function extractCommandSnippets(content) {
  const snippets = [];
  let inFence = false;
  let commandFence = false;

  for (const line of content.split(/\r?\n/)) {
    const fence = line.match(/^```([A-Za-z0-9_-]*)/);
    if (fence) {
      if (inFence) {
        inFence = false;
        commandFence = false;
      } else {
        inFence = true;
        commandFence = ['', 'bash', 'sh', 'shell', 'console'].includes(fence[1]);
      }
      continue;
    }

    if (inFence) {
      if (commandFence) snippets.push(line.trim());
      continue;
    }

    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      snippets.push(match[1].trim());
    }
  }

  return snippets;
}

const commands = loadWesleyCommands();
for (const doc of docs) {
  const content = readFileSync(resolve(root, doc), 'utf8');
  for (const command of extractDocumentedCommands(content)) {
    if (!commands.has(command)) {
      fail(
        `${doc} documents "wesley ${command}", but the native Wesley CLI does not expose that command`
      );
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ Native front-door Wesley CLI examples match registered commands');
