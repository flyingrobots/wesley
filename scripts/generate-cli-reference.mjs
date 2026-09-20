#!/usr/bin/env node
// Writes docs/cli.md from the CLI's own help output, or with --check reports
// whether the committed page still matches the binary.
//
//   node scripts/generate-cli-reference.mjs --wesley <binary> [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = args.indexOf('--wesley');
if (flag === -1 || !args[flag + 1]) {
  console.error('usage: generate-cli-reference.mjs --wesley <binary> [--check]');
  process.exit(2);
}
const wesley = resolve(args[flag + 1]);
const check = args.includes('--check');
const PAGE = 'docs/cli.md';

function run(argv) {
  const result = spawnSync(wesley, argv, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\`wesley ${argv.join(' ')}\` exited ${result.status}\n${result.stderr}`);
    process.exit(2);
  }
  return result.stdout.replace(/\n+$/, '');
}

const version = run(['--version']);
const rootHelp = run(['--help']);

// The help pages are discovered from the root help, not listed here, so a new
// command family cannot be left out of the reference. Commands that share a
// first word share a help page; one of them is enough to print it.
function helpPages(help) {
  const pages = new Map();
  let inCommands = false;
  for (const line of help.split('\n')) {
    if (line.trim() === 'Commands:') inCommands = true;
    else if (inCommands && line.trim() === '') inCommands = false;
    else if (inCommands) {
      const row = line.match(/^ {2}([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?) {2,}/);
      if (!row) continue;
      const argv = row[1].split(' ');
      if (argv[0] !== 'version' && !pages.has(argv[0])) pages.set(argv[0], argv);
    }
  }
  if (pages.size === 0) {
    console.error('`wesley --help` listed no commands');
    process.exit(2);
  }
  return pages;
}
const parts = [
  '# CLI reference',
  '',
  "This page is the output of `wesley --help` and of each command group's",
  `\`--help\`, captured from version ${version}. It is generated, not written:`,
  'if it disagrees with the binary, the binary is right. Regenerate it with',
  '`node scripts/generate-cli-reference.mjs --wesley target/debug/wesley`.',
  '',
  '## wesley',
  '',
  '```text',
  rootHelp,
  '```'
];
for (const [title, argv] of helpPages(rootHelp)) {
  parts.push('', `## ${title}`, '', '```text', run([...argv, '--help']), '```');
}
parts.push(
  '',
  '## Exit status',
  '',
  'Commands exit 0 on success and non-zero on failure. `wesley schema diff',
  '--exit-code` exits 1 when the change is breaking.',
  ''
);
const generated = parts.join('\n');

if (!check) {
  writeFileSync(PAGE, generated);
  console.log(`wrote ${PAGE} from wesley ${version}`);
} else if (readFileSync(PAGE, 'utf8') === generated) {
  console.log(`${PAGE} matches wesley ${version}`);
} else {
  console.error(
    `${PAGE} does not match \`wesley --help\`. Regenerate it:\n  node scripts/generate-cli-reference.mjs --wesley ${args[flag + 1]}`
  );
  process.exit(1);
}
