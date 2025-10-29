import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function makeTempDir(prefix = 'moriarty-') {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function writeHistory(dir, points) {
  const wes = path.join(dir, '.wesley');
  mkdirSync(wes, { recursive: true });
  writeFileSync(path.join(wes, 'history.json'), JSON.stringify({ points }, null, 2));
}

export function writeContext(dir, ctx) {
  const wes = path.join(dir, '.wesley');
  mkdirSync(wes, { recursive: true });
  writeFileSync(path.join(wes, 'moriarty-context.json'), JSON.stringify(ctx, null, 2));
}

export function withFakeGit(config, fn) {
  const stubDir = makeTempDir('gitstub-');
  const gitPath = path.join(stubDir, 'git');
  const cfgPath = path.join(stubDir, 'config.json');
  const script = `#!/usr/bin/env node\n` +
`const fs = require('fs');\n` +
`const path = require('path');\n` +
`const cfgPath = path.join(path.dirname(process.argv[1]), 'config.json');\n` +
`let cfg = {};\n` +
`try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}\n` +
`const args = process.argv.slice(2);\n` +
`function out(s){ if (s) process.stdout.write(String(s)); }\n` +
`if (args[0] === 'rev-parse' && args.includes('--is-inside-work-tree')) { out('true\\n'); process.exit(0); }\n` +
`if (args[0] === 'merge-base') { out((cfg.mergeBase || 'deadbeef') + '\\n'); process.exit(0); }\n` +
`if (args[0] === 'fetch') { process.exit(0); }\n` +
`if (args[0] === 'log') {\n` +
`  const sinceArg = args.find(a => a.startsWith('--since='));\n` +
`  if (sinceArg) { out(cfg.sinceLog || ''); process.exit(0); }\n` +
`  const range = args.find(a => a.includes('..HEAD'));\n` +
`  if (range) { out(cfg.prLog || ''); process.exit(0); }\n` +
`}\n` +
`process.exit(0);\n`;
  writeFileSync(gitPath, script, { mode: 0o755 });
  writeFileSync(cfgPath, JSON.stringify(config || {}, null, 2));
  const oldPath = process.env.PATH;
  process.env.PATH = `${stubDir}${path.delimiter}${oldPath}`;
  try {
    const update = (next) => writeFileSync(cfgPath, JSON.stringify(next, null, 2));
    return fn({ stubDir, update });
  } finally {
    process.env.PATH = oldPath;
    try { rmSync(stubDir, { recursive: true, force: true }); } catch {}
  }
}

export function buildLog(commits) {
  // commits: [{ ts: epochSeconds, files: [{a,d,file}] }]
  if (!Array.isArray(commits)) return '';
  let out = '';
  for (const c of commits) {
    out += `--${Math.trunc(c.ts || 0)}\n`;
    for (const f of (c.files || [])) {
      const a = Number.isFinite(f.a) ? f.a : 0;
      const d = Number.isFinite(f.d) ? f.d : 0;
      out += `${a} ${d} ${f.file || 'unknown.txt'}\n`;
    }
  }
  return out;
}

// Convenience: build a simple series of commits spaced by `intervalSec`.
// opts: { count, startTs=nowSecs(), intervalSec=300, makeFiles(i) => [{a,d,file}] }
export function buildLogSeries(opts = {}) {
  const count = Math.max(0, Math.trunc(opts.count ?? 0));
  const intervalSec = Math.max(1, Math.trunc(opts.intervalSec ?? 300));
  const startTs = Math.trunc(opts.startTs ?? nowSecs());
  const makeFiles = typeof opts.makeFiles === 'function'
    ? opts.makeFiles
    : () => ([{ a: 1, d: 0, file: 'schema.graphql' }]);
  const commits = [];
  for (let i = 0; i < count; i++) {
    commits.push({ ts: startTs - (i * intervalSec), files: makeFiles(i) });
  }
  return buildLog(commits);
}

export function runPredict(repoRoot, bundleDirAbs, extraEnv = {}) {
  const cliPath = path.join(repoRoot, 'packages', 'wesley-holmes', 'src', 'cli.mjs');
  const jsonOut = path.join(bundleDirAbs, 'moriarty-report.json');
  const historyPath = path.join(bundleDirAbs, '.wesley', 'history.json');
  const args = [cliPath, 'predict', '--bundle-dir', bundleDirAbs, '--history-file', historyPath, '--json', jsonOut];
  const env = { ...process.env, ...extraEnv };
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', env });
  if (result.status !== 0) {
    throw new Error(`predict failed: ${result.status}\nSTDERR:\n${result.stderr}`);
  }
  const text = readFileSync(jsonOut, 'utf8');
  return JSON.parse(text);
}

export function day(n) {
  return Math.trunc(n);
}

export function nowSecs() { return Math.trunc(Date.now()/1000); }
