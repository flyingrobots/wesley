/**
 * MergeTreeStrategy (stub)
 * Preferred strategy using `git merge-tree --write-tree` (implemented in MP-04).
 */

export class MergeTreeStrategy {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  /**
   * Placeholder execute method; returns a stub result for now.
   */
  execute(plan) {
    return {
      status: 'unsupported',
      reason: 'Not implemented yet (MP-04 will execute merge-tree)',
      plan,
    };
  }
}

