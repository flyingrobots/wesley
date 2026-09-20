#!/usr/bin/env node
// Replays the shell sessions shown in the documentation and compares what the
// CLI really prints with what the page says it prints.
//
// Conventions, all in the Markdown itself:
//   <!-- file: NAME -->   before a fenced block: write the block to NAME
//   <!-- exit: N -->      before a bash block: its wesley commands exit N
//   <!-- norun: WHY -->   before a bash block: shown, not run
//   a ```text block directly after a ```bash block is that block's exact stdout
//
// Only lines that start with `wesley ` are run. Usage:
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

const FENCE = /^```([a-z]*)\s*$/;
const DIRECTIVE = /^<!--\s*(file|exit|norun):\s*(.+?)\s*-->$/;

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

let ran = 0;
let compared = 0;
const failures = [];

for (const doc of docs) {
  const blocks = blocksOf(readFileSync(doc, 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'wesley-docs-'));
  try {
    blocks.forEach((block, index) => {
      if (block.file) writeFileSync(join(dir, block.file), `${block.lines.join('\n')}\n`);
      if (block.lang !== 'bash' || block.norun) return;
      const commands = block.lines.filter((line) => line.startsWith('wesley '));
      if (commands.length === 0) return;
      const expectedExit = Number(block.exit ?? 0);
      let stdout = '';
      for (const command of commands) {
        const argv = command.split(/\s+/).slice(1);
        const result = spawnSync(wesley, argv, { cwd: dir, encoding: 'utf8' });
        ran += 1;
        stdout += result.stdout;
        if (result.status !== expectedExit) {
          failures.push(
            `${doc}: \`${command}\` exited ${result.status}, the page says ${expectedExit}\n${result.stderr}`
          );
        }
      }
      const next = blocks[index + 1];
      if (next && next.lang === 'text') {
        compared += 1;
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
}

if (ran === 0) failures.push('no wesley commands were found to run');
if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(
  `ran ${ran} documented commands and compared ${compared} outputs in ${docs.length} documents`
);
