#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_FORBIDDEN_LITERALS = Object.freeze([['', 'Users', 'james', ''].join('/')]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runGit(args, { binary = false } = {}) {
  const result = spawnSync('git', args, {
    encoding: binary ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  if (result.status !== 0) {
    const stderr = binary ? String(result.stderr || '') : (result.stderr || '').trim();
    fail(`git ${args.join(' ')} failed: ${stderr}`);
  }

  return result.stdout;
}

function parseNullSeparatedList(stdout) {
  if (!stdout) return [];
  const raw = Buffer.isBuffer(stdout) ? stdout.toString('utf8') : String(stdout);
  return raw.split('\0').filter(Boolean);
}

function forbiddenLiterals() {
  const extra = (process.env.WESLEY_FORBIDDEN_LITERALS || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...DEFAULT_FORBIDDEN_LITERALS, ...extra];
}

function loadTargets({ staged }) {
  if (staged) {
    return parseNullSeparatedList(
      runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    );
  }
  return parseNullSeparatedList(runGit(['ls-files', '-z']));
}

function readTarget(pathname, { staged }) {
  if (staged) {
    return runGit(['show', `:${pathname}`], { binary: true });
  }
  try {
    return readFileSync(resolve(pathname));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function main() {
  const staged = process.argv.includes('--staged');
  const patterns = forbiddenLiterals().map((item) => ({
    literal: item,
    bytes: Buffer.from(item, 'utf8')
  }));

  const offenders = [];
  for (const pathname of loadTargets({ staged })) {
    const content = readTarget(pathname, { staged });
    if (content === null) {
      continue;
    }
    for (const pattern of patterns) {
      if (content.includes(pattern.bytes)) {
        offenders.push({ pathname, literal: pattern.literal });
      }
    }
  }

  if (offenders.length > 0) {
    console.error('Forbidden machine-local path literals found:');
    for (const offender of offenders) {
      console.error(`- ${offender.pathname}: ${offender.literal}`);
    }
    process.exit(1);
  }

  console.log('✅ No forbidden machine-local path literals found');
}

main();
