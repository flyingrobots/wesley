#!/usr/bin/env node
// Update the progress header in tasks-clean.md based on resolved outcomes
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.argv[2] || 'tasks-clean.md';
const path = resolve(file);
const text = readFileSync(path, 'utf8');

// Split sections by headings starting with '## [' and stop at '## Follow-ups'
const parts = text.split(/\n## \[/g);
let preamble = parts[0];
const sectionsRaw = parts.slice(1);
const sections = [];
for (const raw of sectionsRaw) {
  const titleEnd = raw.indexOf('\n');
  const title = raw.slice(0, titleEnd).trim();
  if (title.startsWith('Follow-ups')) break;
  sections.push({ title, body: raw });
}

const total = sections.length;
let resolved = 0;
for (const s of sections) {
  const body = s.body;
  const successBlock = body.includes('[!success]- **Outcome**');
  const checked = /\- \[x\] Issue resolved/i.test(body);
  if (successBlock && checked) resolved++;
}

const pct = total ? Math.round((resolved / total) * 100) : 0;

// Build a simple 10-segment bar like '████|░░░░|...'
const segs = 10;
const filled = Math.round((pct / 100) * segs);
const bar = Array.from({ length: segs }, (_, i) => (i < filled ? '████' : '░░░░')).join('|');
const ruler = '    |    |    |    |    |    |    |    |    |    |';
const ticks = '0   10   20   30   40   50   60   70   80   90  100';

const headerRe = /```[\s\S]*?```/m;
const newHeader = [
  '```',
  bar,
  ruler,
  ticks,
  '',
  `${pct} %`,
  `${resolved} of ${total} resolved`,
  '```'
].join('\n');

const updated = text.replace(headerRe, newHeader);
writeFileSync(path, updated, 'utf8');
console.log(`Updated ${file}: ${pct}% (${resolved}/${total})`);

