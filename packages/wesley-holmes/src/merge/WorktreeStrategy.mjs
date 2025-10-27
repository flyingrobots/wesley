/**
 * WorktreeStrategy (stub)
 * Fallback strategy using ephemeral worktrees + `git merge --no-commit`.
 */

export class WorktreeStrategy {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  /**
   * Placeholder execute method; returns a stub result for now.
   */
  execute(plan) {
    return {
      status: 'unsupported',
      reason: 'Not implemented yet (MP-05 will execute worktree fallback)',
      plan,
    };
  }
}

