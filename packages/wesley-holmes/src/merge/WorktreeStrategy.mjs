/**
 * WorktreeStrategy (MP-05)
 * Fallback strategy: create an ephemeral worktree at baseRef and attempt
 * `git merge --no-commit --no-ff <HEAD>` inside it to detect conflicts
 * and, on success, compute a merged tree id via `git write-tree`.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export class WorktreeStrategy {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  execute(plan) {
    const baseRef = plan?.baseRef || 'main';
    const remoteBase = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;

    function safe(cmd, opts) {
      try { return execSync(cmd, { encoding: 'utf8', ...opts }); } catch (e) { return null; }
    }

    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore', cwd: this.repoRoot });
    } catch {
      return { status: 'error', reason: 'Not a git work tree', merge: { baseRef, strategy: 'worktree' } };
    }

    // Ensure base fetched and merge-base available
    safe(`git fetch --prune origin ${baseRef}:${'refs/remotes/origin/' + baseRef}`, { cwd: this.repoRoot });
    const mergeBase = safe(`git merge-base HEAD ${remoteBase}`, { cwd: this.repoRoot })?.trim() || null;
    const headCommit = safe('git rev-parse HEAD', { cwd: this.repoRoot })?.trim();
    if (!headCommit) {
      return { status: 'error', reason: 'HEAD not resolved', merge: { baseRef, strategy: 'worktree' } };
    }

    // Create ephemeral worktree at base
    const wtDir = mkdtempSync(path.join(tmpdir(), 'wesley-wt-'));
    let wroteTree = null;
    try {
      // Add detached worktree at base
      const addOut = safe(`git worktree add --detach "${wtDir}" ${remoteBase}`, { cwd: this.repoRoot });
      if (addOut === null) {
        throw new Error('git worktree add failed');
      }
      // Attempt merge without committing
      let status = 'clean';
      let conflicts = [];
      try {
        execSync(`git merge --no-commit --no-ff ${headCommit}`, { cwd: wtDir, stdio: 'ignore' });
      } catch {
        // Non-zero likely indicates conflicts
        status = 'conflicts';
      }
      if (status === 'conflicts') {
        const out = safe('git diff --name-only --diff-filter=U', { cwd: wtDir }) || '';
        conflicts = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        // Abort merge to leave worktree clean before remove
        safe('git merge --abort', { cwd: wtDir });
        return {
          status: 'conflicts',
          merge: { baseRef, mergeBase, strategy: 'worktree' },
          conflicts
        };
      }
      // Clean merge path: compute merged tree via write-tree
      wroteTree = safe('git write-tree', { cwd: wtDir })?.trim() || null;
      // No commit was created (no-commit), so we can abort to reset index
      safe('git merge --abort', { cwd: wtDir });
      return {
        status: 'clean',
        merge: { baseRef, mergeBase, strategy: 'worktree' },
        mergedTree: wroteTree,
        materialization: 'deferred'
      };
    } catch (e) {
      return { status: 'error', reason: e?.message || String(e), merge: { baseRef, mergeBase, strategy: 'worktree' } };
    } finally {
      try { execSync(`git worktree remove --force "${wtDir}"`, { cwd: this.repoRoot, stdio: 'ignore' }); } catch {}
      try { rmSync(wtDir, { recursive: true, force: true }); } catch {}
    }
  }
}

