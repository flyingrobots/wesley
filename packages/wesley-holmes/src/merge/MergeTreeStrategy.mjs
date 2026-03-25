/**
 * MergeTreeStrategy (MP-04)
 * Preferred strategy using `git merge-tree --write-tree` to compute a merged tree id
 * without modifying the working tree. Materialization of the tree is deferred to MP-06.
 */

import { execFileSync } from 'node:child_process';

export class MergeTreeStrategy {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  execute(plan) {
    try {
      // Ensure we are inside a git repo
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore', cwd: this.repoRoot });
    } catch {
      return { status: 'error', reason: 'Not a git work tree', plan };
    }

    const baseRef = plan?.baseRef || 'main';
    const remoteBase = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;

    // Make a best effort to fetch the base ref
    try {
      execFileSync('git', ['fetch', '--prune', 'origin', `${baseRef}:refs/remotes/origin/${baseRef}`], {
        stdio: 'ignore',
        cwd: this.repoRoot
      });
    } catch { /* empty */ }

    let mergeBase = null;
    try {
      mergeBase = execFileSync('git', ['merge-base', 'HEAD', remoteBase], {
        encoding: 'utf8',
        cwd: this.repoRoot
      }).trim();
      if (!mergeBase) return { status: 'error', reason: 'merge-base not found', plan };
    } catch (e) {
      return { status: 'error', reason: 'merge-base failed', error: String(e?.message || e), plan };
    }

    // Compute merged tree id
    let mergedTree = null;
    try {
      const out = execFileSync('git', ['merge-tree', '--write-tree', mergeBase, 'HEAD', remoteBase], {
        encoding: 'utf8',
        cwd: this.repoRoot
      }).trim();
      mergedTree = out.split(/\s+/)[0];
    } catch (e) {
      return { status: 'error', reason: 'merge-tree failed', error: String(e?.message || e), plan, mergeBase };
    }

    // Collect comparison info
    let headTree = null;
    let baseTree = null;
    try { headTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8', cwd: this.repoRoot }).trim(); } catch { /* empty */ }
    try { baseTree = execFileSync('git', ['rev-parse', `${remoteBase}^{tree}`], { encoding: 'utf8', cwd: this.repoRoot }).trim(); } catch { /* empty */ }

    const equalToHead = headTree && mergedTree && headTree === mergedTree;
    const equalToBase = baseTree && mergedTree && baseTree === mergedTree;

    return {
      status: 'clean',
      merge: { baseRef, mergeBase, strategy: 'merge-tree' },
      mergedTree,
      equalToHead: Boolean(equalToHead),
      equalToBase: Boolean(equalToBase),
      materialization: 'deferred'
    };
  }
}
