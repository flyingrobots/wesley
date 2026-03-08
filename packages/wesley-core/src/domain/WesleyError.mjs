/**
 * WesleyError - Structured error base class for the Wesley ecosystem.
 *
 * All Wesley errors carry a machine-readable `code` and optional `meta`
 * object. This replaces the ad-hoc patterns of mutating `.code` and `.meta`
 * onto vanilla Error instances after construction.
 */
export class WesleyError extends Error {
  /**
   * @param {string} code  - Machine-readable error code (e.g. 'GENERATION_FAILED')
   * @param {string} message - Human-readable description
   * @param {Record<string, unknown>} [meta] - Structured metadata for logging/evidence
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'WesleyError';
    this.code = code;
    this.meta = meta;
  }
}

/**
 * OpsError - Errors originating from the ops compilation pipeline.
 */
export class OpsError extends WesleyError {
  constructor(code, message, meta = {}) {
    super(code, message, meta);
    this.name = 'OpsError';
  }
}

/**
 * PluginError - Errors thrown during plugin lifecycle (init/plan/generate).
 */
export class PluginError extends WesleyError {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ plugin?: string, phase?: string }} [meta]
   */
  constructor(code, message, meta = {}) {
    super(code, message, meta);
    this.name = 'PluginError';
  }
}
