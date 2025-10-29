/**
 * MergePlanner (stub for MP-01..03)
 *
 * Responsibility: determine how to simulate a PR merge against a base ref
 * and return a structured plan. Later phases (MP-04+) will execute the plan
 * and produce a materialized merged tree for analysis.
 */

export class MergePlanner {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  /**
   * Plan a merge simulation.
   * @param {object} opts
   * @param {string} [opts.baseRef]
   * @returns {object} plan
   */
  plan(opts = {}) {
    const baseRef = opts.baseRef || process.env.GITHUB_BASE_REF || process.env.MORIARTY_BASE_REF || 'main';
    return {
      status: 'planned',
      baseRef,
      strategy: 'deferred',
      notes: 'MP-01..03 stub: strategy execution deferred to MP-04+',
    };
  }
}

