/**
 * ExitCodes — Single source of truth for error-code → exit-code mappings.
 *
 * Every Wesley error code must be registered here at definition time.
 * The CLI layers delegate to `exitCodeFor()` instead of maintaining
 * their own switch/map. Unregistered codes fall through to exit code 1.
 *
 * Exit code semantics:
 *   1 — Generic / unknown error
 *   2 — Configuration / input error (bad args, missing files, usage)
 *   3 — Parsing / schema resolution error
 *   4 — Generation / plugin execution error
 *   5 — Validation / certification error
 *   6 — Pipeline execution error
 */

/** @type {Readonly<Record<string, number>>} */
const EXIT_CODE_MAP = Object.freeze({
  // 2 — Configuration / input
  'ENOENT': 2,
  'EEMPTYSCHEMA': 2,
  'EEXIST': 2,
  'EARGS': 2,
  'EUSAGE': 2,
  'ERR_MISSING_ARGUMENT': 2,
  'DIRTY_WORKTREE': 2,
  'NO_DSN': 2,
  'INVALID_TARGET': 2,
  'UNSUPPORTED_OPTION': 2,
  'INVALID_LOG_FORMAT': 2,
  'UNKNOWN_TRANSMUTATION': 2,
  'NO_EVENT_STORE': 2,
  'RUN_NOT_FOUND': 2,
  'RUN_AMBIGUOUS': 2,
  'OPS_ALLOW_ERRORS_FORBIDDEN': 2,
  'OPS_INVALID_SECURITY': 2,

  // 3 — Parsing / schema resolution
  'PARSE_FAILED': 3,
  'SCHEMA_RESOLUTION_FAILED': 3,
  'OPS_COLLISION': 3,
  'OPS_IDENTIFIER_TOO_LONG': 3,

  // 4 — Generation / plugin execution
  'GENERATION_FAILED': 4,
  'REALM_FAILED': 4,
  'TTD_COMPILE_FAILED': 4,
  'OPS_EMPTY_SET': 4,
  'WPLY001': 4,
  'WPLY002': 4,
  'WPLY003': 4,
  'WPLY004': 4,

  // 5 — Validation / certification
  'VALIDATION_FAILED': 5,
  'CERT_INVALID': 5,
  'COUNTERFACTUAL_GATE_FAILED': 5,
  'OPS_MANIFEST_INVALID': 5,
  'OPS_COMPILE_FAILED': 5,
  'DIFF_FAILED': 5,

  // 6 — Pipeline execution
  'PIPELINE_EXEC_FAILED': 6
});

/**
 * Look up the exit code for a given error code.
 * Returns 1 (generic error) for unregistered codes.
 *
 * @param {string} errorCode - Machine-readable error code (e.g. 'PARSE_FAILED')
 * @returns {number} Process exit code
 */
export function exitCodeFor(errorCode) {
  return EXIT_CODE_MAP[errorCode] ?? 1;
}

/**
 * Check whether an error code has a registered exit code mapping.
 *
 * @param {string} errorCode
 * @returns {boolean}
 */
export function isRegistered(errorCode) {
  return Object.hasOwn(EXIT_CODE_MAP, errorCode);
}

/**
 * Return all registered error codes and their exit codes.
 * Useful for documentation generation and diagnostics.
 *
 * @returns {Readonly<Record<string, number>>}
 */
export function getRegistry() {
  return EXIT_CODE_MAP;
}
