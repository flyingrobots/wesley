#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const packagesDir = path.join(root, 'packages');
const repoUrl = 'https://github.com/flyingrobots/wesley.git';
const apiIssues = 'https://github.com/flyingrobots/wesley/issues';
const author = 'Wesley Authors <oss@flyingrobots.dev>';
const engines = { node: '>=18.17' };

const packages = await fs.readdir(packagesDir, { withFileTypes: true });

function sortKeys(obj) {
  const ordered = {};
  Object.keys(obj).sort().forEach((key) => {
    ordered[key] = obj[key];
  });
  return ordered;
}

for (const entry of packages) {
  if (!entry.isDirectory()) continue;
  const pkgPath = path.join(packagesDir, entry.name, 'package.json');
  try {
    const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

    pkgData.author = author;
    pkgData.license = pkgData.license ?? 'LicenseRef-MIND-UCAL-1.0';
    pkgData.repository = {
      type: 'git',
      url: repoUrl,
      directory: `packages/${entry.name}`
    };
    pkgData.bugs = { url: apiIssues };
    pkgData.homepage = `https://github.com/flyingrobots/wesley/tree/main/packages/${entry.name}#readme`;
    pkgData.engines = engines;

    if (!pkgData.version) {
      pkgData.version = '0.1.0';
    }

    const json = JSON.stringify(pkgData, null, 2) + '\n';
    await fs.writeFile(pkgPath, json);
    console.log('Updated', pkgPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error updating', pkgPath, err);
      process.exitCode = 1;
    }
  }
}
