#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve('.');
const docs = ['README.md', 'docs/GUIDE.md', 'docs/ENTRYPOINTS.md', 'docs/END_TO_END.md'];
const cliSourcePath = 'crates/wesley-cli/src/main.rs';

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

function parseCommandsFromHelpText(helpText) {
  const commands = new Set();
  let inCommands = false;
  for (const line of helpText.split(/\r?\n/)) {
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

export function loadWesleyCommandsFromSource(source) {
  const start = source.indexOf('fn print_help()');
  if (start === -1) {
    throw new Error(`${cliSourcePath} is missing fn print_help()`);
  }

  const nextFunction = source.indexOf('\nfn print_', start + 'fn print_help()'.length);
  const helpSource = source.slice(start, nextFunction === -1 ? undefined : nextFunction);
  const commands = parseCommandsFromHelpText(helpSource);
  if (commands.size === 0) {
    throw new Error(`${cliSourcePath} print_help() did not expose any command rows`);
  }

  return commands;
}

function loadWesleyCommands() {
  const source = readFileSync(resolve(root, cliSourcePath), 'utf8');
  return loadWesleyCommandsFromSource(source);
}

export function documentedCommandFromParts(parts, commands) {
  if (parts.length > 1 && !parts[1].startsWith('-')) {
    const nested = `${parts[0]} ${parts[1]}`;
    if (commands.has(nested)) return nested;
    if (commandFamilyExists(parts[0], commands)) return nested;
  }

  return parts[0];
}

function commandFamilyExists(command, commands) {
  for (const knownCommand of commands) {
    if (knownCommand.startsWith(`${command} `)) {
      return true;
    }
  }

  return false;
}

export function commandOrFamilyExists(command, commands) {
  if (commands.has(command)) return true;
  return commandFamilyExists(command, commands);
}

export function extractDocumentedCommands(content, commands) {
  const documented = [];
  for (const snippet of extractCommandSnippets(content)) {
    if (snippet.includes('pnpm wesley') || snippet.includes('...')) continue;
    const match = snippet.match(/^\$?\s*(?:cargo\s+wesley|wesley)(?![-/])(?:\s+(.+))?$/);
    if (!match) continue;
    const tail = String(match[1] || '').trim();
    const parts = tail.split(/\s+/).map(normalizeCommandToken).filter(Boolean);
    if (parts.length === 0 || parts[0].startsWith('-')) continue;
    documented.push(documentedCommandFromParts(parts, commands));
  }
  return documented;
}

export function extractCommandSnippets(content) {
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

function main() {
  let commands;
  try {
    commands = loadWesleyCommands();
  } catch (error) {
    fail(error?.message || error);
    process.exit(process.exitCode);
  }

  for (const doc of docs) {
    const content = readFileSync(resolve(root, doc), 'utf8');
    for (const command of extractDocumentedCommands(content, commands)) {
      if (!commandOrFamilyExists(command, commands)) {
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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
