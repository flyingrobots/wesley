/**
 * Git Port - Abstraction for git operations
 * Allows injection of fake implementations for testing
 */

import { execFileSync } from 'node:child_process';

/**
 * Validate git ref name to prevent command injection.
 * Allows: alphanumerics, dots, slashes, dashes, underscores, and colons (for refspecs).
 * Rejects: shell metacharacters, spaces, quotes, backticks, etc.
 * @param {string} ref - The ref name to validate
 * @returns {boolean} - True if valid
 */
function isValidGitRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 256) {
    return false;
  }
  // Strict pattern: alphanumerics, dots, slashes, dashes, underscores, colons, tildes, carets
  // Must not start with dash (to avoid being interpreted as flag)
  // Must not contain .. (path traversal) or end with .lock
  const validRefPattern = /^[a-zA-Z0-9][a-zA-Z0-9._\-/~^:]*$/;
  if (!validRefPattern.test(ref)) {
    return false;
  }
  // Additional git ref restrictions
  if (ref.includes('..') || ref.endsWith('.lock') || ref.includes('@{')) {
    return false;
  }
  return true;
}

/**
 * Default git adapter using real git commands
 */
export const realGitAdapter = {
  isInsideWorkTree() {
    try {
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },

  fetch(ref) {
    if (!isValidGitRef(ref)) {
      return false;
    }
    try {
      execFileSync('git', ['fetch', '--prune', 'origin', `${ref}:refs/remotes/origin/${ref}`], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },

  mergeBase(head, base) {
    if (!isValidGitRef(head) || !isValidGitRef(base)) {
      return null;
    }
    try {
      return execFileSync('git', ['merge-base', head, base], { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  },

  log(options = {}) {
    const { since, range, format = '--%ct', numstat = true, noMerges = true } = options;
    const args = ['log'];

    if (since) {
      // Validate since is an ISO date string
      if (typeof since === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/.test(since)) {
        args.push(`--since=${since}`);
      }
    }
    if (range) {
      // Validate range contains only valid ref characters and ..
      if (typeof range === 'string' && /^[a-zA-Z0-9._\-/~^:]+\.\.[a-zA-Z0-9._\-/~^:]+$/.test(range)) {
        args.push(range);
      }
    }
    if (format && typeof format === 'string' && /^[a-zA-Z0-9%\-_]+$/.test(format)) {
      args.push(`--pretty=format:${format}`);
    }
    if (numstat) args.push('--numstat');
    if (noMerges) args.push('--no-merges');

    try {
      return execFileSync('git', args, { encoding: 'utf8' });
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
