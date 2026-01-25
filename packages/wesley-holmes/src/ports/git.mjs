/**
 * Git Port - Abstraction for git operations
 * Allows injection of fake implementations for testing
 */

import { execSync } from 'node:child_process';

/**
 * Default git adapter using real git commands
 */
export const realGitAdapter = {
  isInsideWorkTree() {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },

  fetch(ref) {
    try {
      execSync(`git fetch --prune origin ${ref}:refs/remotes/origin/${ref}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },

  mergeBase(head, base) {
    try {
      return execSync(`git merge-base ${head} ${base}`, { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  },

  log(options = {}) {
    const { since, range, format = '--%ct', numstat = true, noMerges = true } = options;
    const args = ['git', 'log'];

    if (since) args.push(`--since='${since}'`);
    if (range) args.push(range);
    if (format) args.push(`--pretty=format:'${format}'`);
    if (numstat) args.push('--numstat');
    if (noMerges) args.push('--no-merges');

    try {
      return execSync(args.join(' '), { encoding: 'utf8' });
    } catch {
      return '';
    }
  }
};

/**
 * Null git adapter - returns empty/null for all operations
 * Use when git is not available or not needed
 */
export const nullGitAdapter = {
  isInsideWorkTree: () => false,
  fetch: () => false,
  mergeBase: () => null,
  log: () => ''
};

/**
 * Create a fake git adapter for testing
 * @param {Object} overrides - Methods to override
 */
export function createFakeGitAdapter(overrides = {}) {
  return {
    ...nullGitAdapter,
    ...overrides
  };
}
