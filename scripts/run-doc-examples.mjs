#!/usr/bin/env node
// Replays the shell sessions shown in the documentation and compares what the
// CLI really does with what the page says it does.
//
// Conventions, all in the Markdown itself:
//   <!-- file: NAME -->          before a fenced block: write the block to NAME
//   <!-- exit: N -->             before a bash block: its wesley commands exit N
//   <!-- norun: WHY -->          before a bash block: shown, not run
//   <!-- shows: NAME -->         before a fenced block: the block is a contiguous
//                                excerpt of the file NAME, which a command wrote
//   <!-- stdout: json-subset --> before a json block that follows a bash block:
//                                every key and value shown is in the real output
//   a ```text block directly after a ```bash block is that block's exact stdout
//
// A stream the page does not show must be empty: stdout when no `text` or
// json-subset block follows, and stderr always. A warning the page omits fails.
//
// Only lines that start with `wesley ` are run. Every such line, run or not,
// must name a command that `wesley --help` lists.
//
//   node scripts/run-doc-examples.mjs --wesley <path-to-binary> <doc.md>...
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = args.indexOf('--wesley');
if (flag === -1 || !args[flag + 1]) {
  console.error('usage: run-doc-examples.mjs --wesley <binary> <doc.md>...');
  process.exit(2);
}
const wesley = resolve(args[flag + 1]);
const docs = args.filter((_, i) => i !== flag && i !== flag + 1);

// A documented command that hangs must fail the replay, not stall the gate.
const COMMAND_TIMEOUT_MS = 10_000;

const FENCE = /^```([a-z]*)\s*$/;
const DIRECTIVE = /^<!--\s*(file|exit|norun|shows|stdout):\s*(.+?)\s*-->$/;

function blocksOf(markdown) {
  const blocks = [];
  let pending = {};
  let open = null;
  for (const line of markdown.split('\n')) {
    if (open) {
      if (line.trim() === '```') {
        blocks.push(open);
        open = null;
      } else {
        open.lines.push(line);
      }
      continue;
    }
    const fence = line.trim().match(FENCE);
    if (fence) {
      open = { lang: fence[1], lines: [], ...pending };
      pending = {};
      continue;
    }
    const directive = line.trim().match(DIRECTIVE);
    if (directive) pending[directive[1]] = directive[2];
    else if (line.trim() !== '') pending = {};
  }
  return blocks;
}

// The commands the binary says it has, read from its own help.
function registeredCommands() {
  const help = spawnSync(wesley, ['--help'], { encoding: 'utf8' });
  if (help.status !== 0) {
    console.error(`\`wesley --help\` exited ${help.status}\n${help.stderr}`);
    process.exit(2);
  }
  const commands = new Set();
  let inCommands = false;
  for (const line of help.stdout.split('\n')) {
    if (line.trim() === 'Commands:') inCommands = true;
    else if (inCommands && line.trim() === '') inCommands = false;
    else if (inCommands) {
      const row = line.match(/^ {2}([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?) {2,}/);
      if (row) commands.add(row[1]);
    }
  }
  if (commands.size === 0) {
    console.error('`wesley --help` listed no commands');
    process.exit(2);
  }
  return commands;
}

function namesRegisteredCommand(argv, registered) {
  const [first, second] = argv;
  if (first === undefined || first.startsWith('-')) return true;
  if (registered.has(`${first} ${second}`) || registered.has(first)) return true;
  // `wesley schema` with nothing after it prints that family's help.
  const names = second === undefined || second.startsWith('-');
  return names && [...registered].some((command) => command.startsWith(`${first} `));
}

// Every key and value in `shown` is present in `actual`. Arrays match by
// position, so a shortened array is a prefix of the real one.
function subsetMismatch(shown, actual, path = '$') {
  if (Array.isArray(shown)) {
    if (!Array.isArray(actual)) return `${path}: the page shows an array`;
    for (let i = 0; i < shown.length; i += 1) {
      if (i >= actual.length) return `${path}[${i}]: not in the real output`;
      const inner = subsetMismatch(shown[i], actual[i], `${path}[${i}]`);
      if (inner) return inner;
    }
    return null;
  }
  if (shown !== null && typeof shown === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return `${path}: the page shows an object`;
    }
    for (const key of Object.keys(shown)) {
      if (!(key in actual)) return `${path}.${key}: not in the real output`;
      const inner = subsetMismatch(shown[key], actual[key], `${path}.${key}`);
      if (inner) return inner;
    }
    return null;
  }
  return shown === actual
    ? null
    : `${path}: the page shows ${JSON.stringify(shown)}, the CLI printed ${JSON.stringify(actual)}`;
}

const registered = registeredCommands();
const failures = [];
const report = [];

for (const doc of docs) {
  const blocks = blocksOf(readFileSync(doc, 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'wesley-docs-'));
  const witness = { ran: 0, compared: 0 };
  // The stdout of the bash block at `index`, for a json-subset block at
  // `index + 1` only. Output must never be compared with a block it did not
  // directly precede.
  let produced = null;
  try {
    blocks.forEach((block, index) => {
      if (block.file) writeFileSync(join(dir, block.file), `${block.lines.join('\n')}\n`);

      if (block.shows) {
        const excerpt = block.lines.join('\n');
        if (excerpt.trim() === '') {
          failures.push(`${doc}: the block that shows \`${block.shows}\` is empty`);
          return;
        }
        witness.compared += 1;
        let written;
        try {
          written = readFileSync(join(dir, block.shows), 'utf8');
        } catch {
          failures.push(`${doc}: the page shows \`${block.shows}\`, but no command wrote it`);
          return;
        }
        if (!written.includes(excerpt)) {
          failures.push(
            `${doc}: the \`${block.lang}\` block is not an excerpt of \`${block.shows}\` as written\n--- page\n${excerpt}\n--- ${block.shows}\n${written}`
          );
        }
        return;
      }

      if (block.stdout === 'json-subset') {
        if (produced === null || produced.index !== index - 1) {
          failures.push(
            `${doc}: a json-subset block must directly follow the bash block it checks`
          );
          return;
        }
        witness.compared += 1;
        let mismatch;
        try {
          mismatch = subsetMismatch(
            JSON.parse(block.lines.join('\n')),
            JSON.parse(produced.stdout)
          );
        } catch (error) {
          mismatch = `not valid JSON: ${error.message}`;
        }
        if (mismatch)
          failures.push(`${doc}: the JSON shown differs from the real output at ${mismatch}`);
        return;
      }

      if (block.lang !== 'bash') return;
      const commands = block.lines.filter((line) => line.startsWith('wesley '));
      for (const command of commands) {
        if (!namesRegisteredCommand(command.split(/\s+/).slice(1), registered)) {
          failures.push(`${doc}: \`${command}\` is not a command \`wesley --help\` lists`);
        }
      }
      if (block.norun || commands.length === 0) return;

      const expectedExit = Number(block.exit ?? 0);
      let stdout = '';
      let stderr = '';
      for (const command of commands) {
        const result = spawnSync(wesley, command.split(/\s+/).slice(1), {
          cwd: dir,
          encoding: 'utf8',
          timeout: COMMAND_TIMEOUT_MS
        });
        if (result.error) {
          failures.push(`${doc}: \`${command}\` did not finish: ${result.error.message}`);
          continue;
        }
        witness.ran += 1;
        stdout += result.stdout;
        stderr += result.stderr;
        if (result.status !== expectedExit) {
          failures.push(
            `${doc}: \`${command}\` exited ${result.status}, the page says ${expectedExit}\n${result.stderr}`
          );
        }
      }
      produced = { index, stdout };

      if (stderr !== '') {
        failures.push(
          `${doc}: \`${commands.join(' && ')}\` wrote to stderr, which the page does not show\n${stderr}`
        );
      }

      const next = blocks[index + 1];
      const showsStdout =
        next && ((next.lang === 'text' && !next.shows) || next.stdout === 'json-subset');
      if (!showsStdout && stdout !== '') {
        failures.push(
          `${doc}: \`${commands.join(' && ')}\` printed output the page does not show\n${stdout}`
        );
      }
      if (next && next.lang === 'text' && !next.shows) {
        witness.compared += 1;
        const expected = `${next.lines.join('\n')}\n`;
        if (stdout !== expected) {
          failures.push(
            `${doc}: output of \`${commands.join(' && ')}\` differs from the page\n--- page\n${expected}--- actual\n${stdout}`
          );
        }
      }
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // A page that contributed nothing was not checked, whatever the others did.
  if (witness.ran === 0) failures.push(`${doc}: no wesley commands were found to run`);
  if (witness.compared === 0) failures.push(`${doc}: no output was compared`);
  report.push(`${doc}: ran ${witness.ran}, compared ${witness.compared}`);
}

if (docs.length === 0) failures.push('no documents were given');
if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(report.join('\n'));
