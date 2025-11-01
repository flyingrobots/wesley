#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = JSON.parse(readFileSync(resolve('meta/progress.config.json'), 'utf8'));
const offenders = [];
for (const p of cfg.packages || []) {
  const rp = p.readme;
  if (!rp) continue;
  let content = '';
  try { content = readFileSync(resolve(rp), 'utf8'); } catch { continue; }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^Status:\s.*\s\s$/.test(line)) {
      offenders.push(`${rp}:${i + 1}`);
    }
  }
}
if (offenders.length) {
  console.error('Docs whitespace errors at:\n - ' + offenders.join('\n - '));
  process.exit(1);
}
console.log('Docs whitespace OK');

