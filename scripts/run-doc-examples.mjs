#!/usr/bin/env node
// Replays the shell sessions shown in the documentation and compares what the
// CLI really does with what the page says it does.
//
// Annotations, written in the Markdown directly before a fenced block:
//   <!-- file: NAME -->          write the block to NAME in the scratch directory;
//                                a fixture is never run or compared
//   <!-- exit: N -->             bash only: its wesley commands exit N
//   <!-- norun: WHY -->          bash only: shown, not run; names still checked
//   <!-- shows: NAME -->         the block is a contiguous excerpt of the file
//                                NAME, which a replayed command created or
//                                changed; a `file:` fixture does not count
//   <!-- stdout: json-subset --> json only, directly after a bash block: every
//                                key and value shown is in the real output
//   a ```text block directly after a ```bash block is that block's exact stdout
//
// A block takes one annotation, so that none can switch another's check off.
//
// The runner fails closed. Each of these is a failure, not something skipped:
// an annotation it does not know, given twice, or attached to nothing; two
// annotations on one block; a command or a leading option that `wesley --help`
// does not list, even in a block that is not run; a fence left
// open; a `wesley` line that is indented and so would not run, or that uses
// shell syntax, which no shell is here to interpret; an output block
// with no command before it; a comparison that compares nothing; a JSON block
// that repeats a key, since only the last would be compared; a file outside
// the scratch directory; a process that does not finish; and any output, on
// either stream, that the page does not show.
//
//   node scripts/run-doc-examples.mjs --wesley <binary> [--timeout-ms N] <doc.md>...
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { duplicateKey } from './json-duplicate-key.mjs';
import { parseHelp } from './wesley-help.mjs';

const args = process.argv.slice(2);
const flag = args.indexOf('--wesley');
if (flag === -1 || !args[flag + 1]) {
  console.error('usage: run-doc-examples.mjs --wesley <binary> [--timeout-ms N] <doc.md>...');
  process.exit(2);
}
const wesley = resolve(args[flag + 1]);

// A documented command that hangs must fail the replay, not stall the gate.
const timeoutFlag = args.indexOf('--timeout-ms');
const COMMAND_TIMEOUT_MS = timeoutFlag === -1 ? 10_000 : Number(args[timeoutFlag + 1]);
if (!Number.isInteger(COMMAND_TIMEOUT_MS) || COMMAND_TIMEOUT_MS <= 0) {
  console.error('--timeout-ms takes a positive whole number of milliseconds');
  process.exit(2);
}
const consumed = new Set([flag, flag + 1]);
if (timeoutFlag !== -1) consumed.add(timeoutFlag).add(timeoutFlag + 1);
const docs = args.filter((_, i) => !consumed.has(i));

const FENCE_OPEN = /^```([a-z]*)\s*$/;
// Anything shaped like `<!-- word: value -->` is taken to be meant for this
// runner, so a misspelled annotation is an error rather than a dropped check.
const ANNOTATION = /^<!--\s*([A-Za-z][A-Za-z-]*):\s*(.*?)\s*-->$/;
const SHELL_SYNTAX = /[|&;<>$"'\\#`(){}*?~]/;
const KNOWN = {
  file: { langs: null, value: /\S/ },
  shows: { langs: null, value: /\S/ },
  exit: { langs: ['bash'], value: /^\d+$/ },
  norun: { langs: ['bash'], value: /\S/ },
  stdout: { langs: ['json'], value: /^json-subset$/ }
};

// `--timeout-ms` is the wait for a documented command. The runner's own help
// probe keeps a fixed limit, so a short one cannot stop the replay before any
// documented command has been judged.
const HELP_TIMEOUT_MS = 10_000;

function run(argv, cwd, timeout = COMMAND_TIMEOUT_MS) {
  const result = spawnSync(wesley, argv, { cwd, encoding: 'utf8', timeout });
  return result.error ? { failed: result.error.message } : result;
}

// Parses one document into fenced blocks with their annotations, plus every
// reason the document could not be parsed faithfully.
function parse(markdown) {
  const blocks = [];
  const problems = [];
  let pending = {};
  let pendingLine = 0;
  let open = null;
  markdown.split('\n').forEach((line, index) => {
    const lineNo = index + 1;
    if (open) {
      if (line.trim() === '```') {
        blocks.push(open);
        open = null;
      } else {
        open.lines.push(line);
      }
      return;
    }
    const fence = line.trim().match(FENCE_OPEN);
    if (fence) {
      open = { lang: fence[1], lines: [], line: lineNo, ...pending };
      for (const name of Object.keys(pending)) {
        const allowed = KNOWN[name].langs;
        if (allowed && !allowed.includes(open.lang)) {
          problems.push(
            `line ${lineNo}: \`${name}\` applies to ${allowed.join(' or ')} blocks, not \`${open.lang}\``
          );
        }
      }
      // One annotation per block, so that no check can switch another off.
      const names = Object.keys(pending);
      if (names.length > 1) {
        problems.push(`line ${lineNo}: \`${names.join('` and `')}\` cannot be combined`);
      }
      if (open.shows && open.lang === 'bash') {
        problems.push(`line ${lineNo}: a bash block cannot be \`shows\``);
      }
      pending = {};
      return;
    }
    const annotation = line.trim().match(ANNOTATION);
    if (annotation) {
      const [, name, value] = annotation;
      if (!(name in KNOWN)) problems.push(`line ${lineNo}: unknown annotation \`${name}\``);
      else if (!KNOWN[name].value.test(value)) {
        problems.push(`line ${lineNo}: \`${name}: ${value}\` is not a valid value`);
      } else if (name in pending) {
        // Keeping the last would silently drop the check the first one asked for.
        problems.push(`line ${lineNo}: \`${name}\` is given twice for one block`);
      } else {
        pending[name] = value;
        pendingLine = lineNo;
      }
      return;
    }
    if (line.trim() !== '' && Object.keys(pending).length > 0) {
      problems.push(`line ${pendingLine}: annotation is not directly before a fenced block`);
      pending = {};
    }
  });
  if (open) problems.push(`line ${open.line}: the fenced block opened here is never closed`);
  if (Object.keys(pending).length > 0) {
    problems.push(`line ${pendingLine}: annotation is not before any block`);
  }
  return { blocks, problems };
}

// The commands the binary says it has, read from its own help.
function registeredCommands() {
  const help = run(['--help'], undefined, HELP_TIMEOUT_MS);
  if (help.failed || help.status !== 0) {
    const why = help.failed ?? `exit ${help.status}\n${help.stderr}`;
    console.error(`\`wesley --help\` did not succeed: ${why}`);
    process.exit(2);
  }
  const { commands, options } = parseHelp(help.stdout);
  if (commands.size === 0) {
    console.error('`wesley --help` listed no commands');
    process.exit(2);
  }
  return { commands, options };
}

// Why `wesley <argv>` is not something the binary's help lists, or null.
function unlisted(argv, { commands, options }) {
  const [first, second] = argv;
  if (first === undefined) return null;
  if (first.startsWith('-')) {
    return options.has(first) ? null : 'is not an option `wesley --help` lists';
  }
  if (commands.has(`${first} ${second}`) || commands.has(first)) return null;
  // `wesley schema` with nothing after it prints that family's help.
  const bare = second === undefined || second.startsWith('-');
  const family = [...commands].some((command) => command.startsWith(`${first} `));
  return bare && family ? null : 'is not a command `wesley --help` lists';
}

// Compares `shown` against `actual` as a subset. Arrays match by position, so a
// shortened array is a prefix of the real one. Returns the first mismatch, and
// counts the leaf values it compared so that `{}` cannot pass as a comparison.
function subset(shown, actual, path, counter) {
  if (Array.isArray(shown)) {
    if (!Array.isArray(actual)) return `${path}: the page shows an array`;
    for (let i = 0; i < shown.length; i += 1) {
      if (i >= actual.length) return `${path}[${i}]: not in the real output`;
      const inner = subset(shown[i], actual[i], `${path}[${i}]`, counter);
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
      const inner = subset(shown[key], actual[key], `${path}.${key}`, counter);
      if (inner) return inner;
    }
    return null;
  }
  counter.leaves += 1;
  return shown === actual
    ? null
    : `${path}: the page shows ${JSON.stringify(shown)}, the CLI printed ${JSON.stringify(actual)}`;
}

// The content of every file in the scratch directory, to tell what a command
// created or changed from what the page put there itself.
function snapshot(dir) {
  const files = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    files.set(relative(dir, path), readFileSync(path, 'utf8'));
  }
  return files;
}

// A path named by an annotation, confined to the scratch directory.
function inside(dir, name) {
  if (isAbsolute(name)) return null;
  const target = resolve(dir, name);
  const rel = relative(dir, target);
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? null : target;
}

function replay(doc, registered) {
  const failures = [];
  const fail = (message) => {
    failures.push(`${doc}: ${message}`);
  };
  const { blocks, problems } = parse(readFileSync(doc, 'utf8'));
  problems.forEach(fail);

  const dir = mkdtempSync(join(tmpdir(), 'wesley-docs-'));
  const witness = { ran: 0, compared: 0 };
  // The stdout of the bash block at `index`, for the block at `index + 1` only.
  let produced = null;
  // Files a replayed command created or changed. A fixture the page wrote with
  // `file:` is not evidence of anything a command did.
  const written = new Set();
  try {
    blocks.forEach((block, index) => {
      const follows = produced !== null && produced.index === index - 1;

      if (block.file) {
        const target = inside(dir, block.file);
        if (!target) return fail(`\`file: ${block.file}\` is outside the scratch directory`);
        mkdirSync(dirname(target), { recursive: true });
        // Whatever a command wrote here, these bytes are now the page's own.
        written.delete(relative(dir, target));
        writeFileSync(target, `${block.lines.join('\n')}\n`);
        // A fixture is only a fixture: never a command to run or output to compare.
        return undefined;
      }

      if (block.shows) {
        const target = inside(dir, block.shows);
        if (!target) return fail(`\`shows: ${block.shows}\` is outside the scratch directory`);
        const excerpt = block.lines.join('\n');
        if (excerpt.trim() === '') return fail(`the block that shows \`${block.shows}\` is empty`);
        if (!written.has(relative(dir, target))) {
          return fail(`the page shows \`${block.shows}\`, but no replayed command wrote it`);
        }
        const content = readFileSync(target, 'utf8');
        witness.compared += 1;
        if (!content.includes(excerpt)) {
          fail(
            `the \`${block.lang}\` block is not an excerpt of \`${block.shows}\` as written\n--- page\n${excerpt}\n--- ${block.shows}\n${content}`
          );
        }
        return undefined;
      }

      if (block.stdout === 'json-subset') {
        if (!follows) {
          return fail('a json-subset block must directly follow the bash block it checks');
        }
        const counter = { leaves: 0 };
        let mismatch;
        try {
          const text = block.lines.join('\n');
          const shown = JSON.parse(text);
          const repeated = duplicateKey(text);
          if (repeated !== null) {
            return fail(
              `the JSON shown repeats the key \`${repeated}\`; only the last is compared`
            );
          }
          mismatch = subset(shown, JSON.parse(produced.stdout), '$', counter);
        } catch (error) {
          mismatch = `not valid JSON: ${error.message}`;
        }
        if (mismatch) return fail(`the JSON shown differs from the real output at ${mismatch}`);
        if (counter.leaves === 0) {
          return fail('a json-subset block shows no values, so it compares nothing');
        }
        witness.compared += 1;
        return undefined;
      }

      if (block.lang === 'text') {
        // Compared below, as the output of the bash block before it.
        if (!follows) {
          fail(
            `line ${block.line}: a \`text\` block shows output, but no command ran directly before it`
          );
        }
        return undefined;
      }

      if (block.lang !== 'bash') return undefined;

      for (const line of block.lines) {
        if (/^\s+wesley(\s|$)/.test(line)) {
          fail(
            `line ${block.line}: \`${line.trim()}\` is indented, so it would not be run or checked`
          );
        }
      }
      const commands = block.lines.filter((line) => /^wesley(\s|$)/.test(line));
      for (const command of commands) {
        const why = unlisted(command.split(/\s+/).slice(1), registered);
        if (why) fail(`\`${command}\` ${why}`);
      }
      if (block.norun || commands.length === 0) return undefined;

      const expectedExit = Number(block.exit ?? 0);
      let stdout = '';
      let stderr = '';
      const before = snapshot(dir);
      for (const command of commands) {
        // No shell runs these lines: they are split on spaces and handed to the
        // binary. A pipe, a redirect or a quote would become an argument, and
        // the page would only fail if the CLI happened to reject it.
        if (SHELL_SYNTAX.test(command)) {
          fail(`\`${command}\` uses shell syntax the replay does not interpret`);
          continue;
        }
        const result = run(command.split(/\s+/).slice(1), dir);
        if (result.failed) {
          fail(`\`${command}\` did not finish: ${result.failed}`);
          continue;
        }
        witness.ran += 1;
        stdout += result.stdout;
        stderr += result.stderr;
        if (result.status !== expectedExit) {
          fail(
            `\`${command}\` exited ${result.status}, the page says ${expectedExit}\n${result.stderr}`
          );
        }
      }
      produced = { index, stdout };
      for (const [name, content] of snapshot(dir)) {
        if (before.get(name) !== content) written.add(name);
      }
      const session = commands.join(' && ');
      if (stderr !== '') {
        fail(`\`${session}\` wrote to stderr, which the page does not show\n${stderr}`);
      }

      const next = blocks[index + 1];
      const isText = next && next.lang === 'text' && !next.shows && !next.file;
      const isJson = next && next.stdout === 'json-subset';
      if (isText) {
        witness.compared += 1;
        const expected = `${next.lines.join('\n')}\n`;
        if (stdout !== expected) {
          fail(
            `output of \`${session}\` differs from the page\n--- page\n${expected}--- actual\n${stdout}`
          );
        }
      } else if (!isJson && stdout !== '') {
        fail(`\`${session}\` printed output the page does not show\n${stdout}`);
      }
      return undefined;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // A page that contributed nothing was not checked, whatever the others did.
  if (witness.ran === 0) fail('no wesley commands were found to run');
  if (witness.compared === 0) fail('no output was compared');
  return { failures, line: `${doc}: ran ${witness.ran}, compared ${witness.compared}` };
}

const registered = registeredCommands();
const results = docs.map((doc) => replay(doc, registered));
const failures = results.flatMap((result) => result.failures);
if (docs.length === 0) failures.push('no documents were given');
if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(results.map((result) => result.line).join('\n'));
