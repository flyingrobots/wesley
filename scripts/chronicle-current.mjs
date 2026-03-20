#!/usr/bin/env node

import { readdirSync } from 'node:fs';

const pattern = /^CHRONICLES_OF_THE_MACHINE-KIND_VOL_[01]{8}\.jsonl$/;

const chronicleFiles = readdirSync(process.cwd())
  .filter(name => pattern.test(name))
  .sort((a, b) => a.localeCompare(b));

if (chronicleFiles.length === 0) {
  console.error('No Chronicle volumes found in the current working directory.');
  process.exit(1);
}

process.stdout.write(`${chronicleFiles.at(-1)}\n`);
