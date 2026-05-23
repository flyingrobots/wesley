#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const manifestPath = resolve(root, 'docs/truth-manifest.json');
const mkdocsPath = resolve(root, 'mkdocs.yml');
const allowedStatuses = new Set(['current', 'experimental', 'proposed']);
const truthRe =
  /<!--\s*docs-truth:\s*status=(current|experimental|proposed)\s+owner=([^\s]+)\s*-->/;

function fail(message) {
  console.error(`docs-truth: ${message}`);
  process.exitCode = 1;
}

function normalize(p) {
  return String(p).replace(/\\/g, '/');
}

function extractNavDocs(mkdocsContent) {
  const docs = new Set();
  const docsDirMatch = mkdocsContent.match(/^docs_dir:\s*(.+)$/m);
  const docsDir = docsDirMatch ? docsDirMatch[1].trim() : 'docs';
  const docsDirAbs = resolve(root, docsDir);
  for (const rawLine of mkdocsContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('.md')) continue;
    const pathMatch = line.match(/:\s*([^#]+?\.md)\s*$/);
    if (!pathMatch) continue;
    const relFromDocsDir = pathMatch[1].trim();
    const abs = resolve(docsDirAbs, relFromDocsDir);
    docs.add(normalize(abs));
  }
  return docs;
}

if (!existsSync(manifestPath)) {
  fail(`missing manifest: ${normalize(manifestPath)}`);
  process.exit(process.exitCode || 1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Number.isInteger(manifest.version)) {
  fail('manifest.version must be an integer');
}
if (!Array.isArray(manifest.documents) || manifest.documents.length === 0) {
  fail('manifest.documents must be a non-empty array');
}

const seen = new Set();
for (const entry of manifest.documents) {
  if (!entry || typeof entry !== 'object') {
    fail('manifest entry must be an object');
    continue;
  }
  if (typeof entry.path !== 'string' || entry.path.length === 0) {
    fail('manifest entry is missing a non-empty "path"');
    continue;
  }
  if (typeof entry.owner !== 'string' || entry.owner.length === 0) {
    fail(`manifest entry ${entry.path} is missing a non-empty "owner"`);
  }
  if (!allowedStatuses.has(entry.status)) {
    fail(`manifest entry ${entry.path} has invalid status "${entry.status}"`);
  }

  const absPath = resolve(root, entry.path);
  const normalizedAbsPath = normalize(absPath);
  if (seen.has(normalizedAbsPath)) {
    fail(`duplicate manifest entry for ${entry.path}`);
    continue;
  }
  seen.add(normalizedAbsPath);

  if (!existsSync(absPath)) {
    fail(`manifest entry points to missing file: ${entry.path}`);
    continue;
  }

  const content = readFileSync(absPath, 'utf8');
  const match = content.match(truthRe);
  if (!match) {
    fail(`${entry.path} is missing docs-truth metadata comment`);
    continue;
  }
  const [, status, owner] = match;
  if (status !== entry.status) {
    fail(`${entry.path} status mismatch: manifest=${entry.status} file=${status}`);
  }
  if (owner !== entry.owner) {
    fail(`${entry.path} owner mismatch: manifest=${entry.owner} file=${owner}`);
  }
}

if (existsSync(mkdocsPath)) {
  const mkdocsContent = readFileSync(mkdocsPath, 'utf8');
  const navDocs = extractNavDocs(mkdocsContent);
  for (const navDocAbs of navDocs) {
    if (!seen.has(navDocAbs)) {
      const displayPath = normalize(navDocAbs).replace(`${normalize(root)}/`, '');
      fail(`public docs page is missing from truth manifest: ${displayPath}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ Docs truth manifest is consistent');
