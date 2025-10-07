#!/usr/bin/env node
import { execSync } from 'node:child_process';

try {
  // Ensure we're in a Git repo
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch {
  console.log('Not a git repository; skipping hook installation.');
  process.exit(0);
}

try {
  const current = execSync('git config --local core.hooksPath', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim();
  if (current === '.githooks') {
    console.log('Git hooks path already set to .githooks');
    process.exit(0);
  }
} catch {
  // No hooksPath configured; proceed
}

try {
  execSync('git config --local core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('Configured git core.hooksPath to .githooks');
} catch (e) {
  console.log('Could not set git hooks path (non-fatal):', e?.message || e);
}

