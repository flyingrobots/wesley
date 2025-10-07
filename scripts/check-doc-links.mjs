#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve('.');
const ignoreDirs = new Set(['.git', 'node_modules', '.wesley', 'out']);

const mdFiles = [];
function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.DS_Store')) continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue;
      walk(p);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      mdFiles.push(p);
    }
  }
}

walk(root);

const linkRe = /(?<!\!)\[[^\]]+\]\(([^)]+)\)/g; // [text](link), not images
const issues = [];

for (const file of mdFiles) {
  const content = readFileSync(file, 'utf8');
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    let link = m[1].trim();
    if (!link || link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) continue;
    // Strip anchors
    const hashIdx = link.indexOf('#');
    if (hashIdx >= 0) link = link.slice(0, hashIdx);
    if (!link) continue; // anchor-only
    // Resolve relative to file
    const base = dirname(file);
    const target = resolve(base, link);
    let exists = false;
    try { exists = statSync(target).isFile() || statSync(target).isDirectory(); } catch { exists = false; }
    if (!exists) {
      issues.push({ file, link: m[1], position: m.index });
    }
  }
}

if (issues.length) {
  console.error('Broken doc links found:');
  for (const i of issues) {
    console.error(`- ${i.file}: ${i.link}`);
  }
  process.exit(1);
} else {
  console.log('✅ No broken relative links found in markdown docs');
}

