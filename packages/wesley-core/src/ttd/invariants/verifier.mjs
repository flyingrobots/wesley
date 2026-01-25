/**
 * TTD Verification Program Generator
 *
 * Generates verification harnesses for runtime invariant checking.
 * Outputs can be used to:
 * - Verify state at runtime
 * - Generate test fixtures
 * - Create verification reports
 */

import { verify, verifyAll } from './vm.mjs';
import { compileObligations, generateVerificationManifest, ObligationKind, ObligationSeverity } from './obligations.mjs';
import { systemClock } from '../../ports/clock.mjs';
import { defaultCrypto } from '../../ports/crypto.mjs';

/**
 * Verification result
 * @typedef {Object} VerificationResult
 * @property {boolean} passed - Whether all checked obligations passed
 * @property {number} totalChecked - Number of obligations checked
 * @property {number} totalPassed - Number that passed
 * @property {number} totalFailed - Number that failed
 * @property {Object[]} failures - Details of failed obligations
 * @property {string} timestamp - When verification was run
 * @property {number} durationMs - How long verification took
 */

/**
 * A runtime verifier instance
 */
export class Verifier {
  #specs;
  #manifest;
  #byId;
  #deps;

  /**
   * Create a verifier from compiled obligation specs
   *
   * @param {Object[]} specs - Compiled obligation specs
   * @param {Object} [deps] - Dependencies
   */
  constructor(specs, deps = {}) {
    this.#specs = specs;
    this.#manifest = generateVerificationManifest(specs, deps);
    this.#byId = new Map(specs.map(s => [s.id, s]));
    this.#deps = {
      clock: deps.clock ?? systemClock,
      crypto: deps.crypto ?? defaultCrypto,
    };
  }

  /**
   * Get the verification manifest
   */
  get manifest() {
    return this.#manifest;
  }

  /**
   * Get all obligation specs
   */
  get specs() {
    return [...this.#specs];
  }

  /**
   * Get obligation by ID
   */
  getObligation(id) {
    return this.#byId.get(id);
  }

  /**
   * Verify a single obligation
   *
   * @param {string} id - Obligation ID
   * @param {Object} context - Runtime context
   * @returns {Object} Verification result
   */
  verifyOne(id, context) {
    const spec = this.#byId.get(id);
    if (!spec) {
      throw new Error(`Unknown obligation: ${id}`);
    }

    const result = verify(spec.bytecode, context);
    return {
      id,
      name: spec.name,
      passed: result.ok,
      value: result.value,
      error: result.error,
      severity: spec.severity,
    };
  }

  /**
   * Verify all obligations of a specific kind
   *
   * @param {string} kind - Obligation kind (TICK, EVENTUAL, SAFETY, ALWAYS)
   * @param {Object} context - Runtime context
   * @returns {VerificationResult}
   */
  verifyByKind(kind, context) {
    const ids = this.#manifest.byKind[kind] || [];
    return this.#runVerification(ids, context);
  }

  /**
   * Verify all obligations
   *
   * @param {Object} context - Runtime context
   * @returns {VerificationResult}
   */
  verifyAll(context) {
    const ids = this.#specs.map(s => s.id);
    return this.#runVerification(ids, context);
  }

  /**
   * Verify tick obligations (should be called every tick)
   *
   * @param {Object} context - Runtime context with tick state
   * @returns {VerificationResult}
   */
  verifyTick(context) {
    return this.verifyByKind(ObligationKind.TICK, context);
  }

  /**
   * Verify safety obligations (should be called on state transitions)
   *
   * @param {Object} context - Runtime context with pre/post state
   * @returns {VerificationResult}
   */
  verifySafety(context) {
    return this.verifyByKind(ObligationKind.SAFETY, context);
  }

  /**
   * Internal: run verification for a set of obligation IDs
   */
  #runVerification(ids, context) {
    const startTime = Date.now();
    const failures = [];
    let passed = 0;

    for (const id of ids) {
      const spec = this.#byId.get(id);
      if (!spec) continue;

      const result = verify(spec.bytecode, context);

      if (result.ok) {
        passed++;
      } else {
        failures.push({
          id,
          name: spec.name,
          expr: spec.expr,
          severity: spec.severity,
          error: result.error,
          value: result.value,
        });
      }
    }

    const endTime = Date.now();

    return {
      passed: failures.length === 0,
      totalChecked: ids.length,
      totalPassed: passed,
      totalFailed: failures.length,
      failures,
      timestamp: this.#deps.clock.now(),
      durationMs: endTime - startTime,
    };
  }
}

/**
 * Create a verifier from a schema
 *
 * @param {Object} schema - TTD schema with invariants
 * @param {Object} [deps] - Dependencies
 * @returns {Verifier}
 */
export function createVerifier(schema, deps = {}) {
  const specs = compileObligations(schema, deps);
  return new Verifier(specs, deps);
}

/**
 * Generate TypeScript verification program
 *
 * @param {Object[]} specs - Compiled obligation specs
 * @returns {string} TypeScript source code
 */
export function generateTsVerifier(specs) {
  const lines = [];

  lines.push('/**');
  lines.push(' * TTD Generated Verification Program');
  lines.push(' *');
  lines.push(' * Auto-generated by @wesley/generator-ttd');
  lines.push(' * DO NOT EDIT');
  lines.push(' */');
  lines.push('');
  lines.push("import { Verifier } from '@wesley/core/ttd/invariants';");
  lines.push('');
  lines.push('// Compiled obligation specs');
  lines.push(`const specs = ${JSON.stringify(specs.map(s => ({
    id: s.id,
    name: s.name,
    expr: s.expr,
    bytecode: s.bytecode,
    severity: s.severity,
    kind: s.kind,
    withinTicks: s.withinTicks,
    dependencies: s.dependencies,
    hash: s.hash,
  })), null, 2)};`);
  lines.push('');
  lines.push('// Create verifier instance');
  lines.push('export const verifier = new Verifier(specs);');
  lines.push('');
  lines.push('// Re-export for convenience');
  lines.push('export { specs };');
  lines.push('export const manifest = verifier.manifest;');
  lines.push('');
  lines.push('// Verification functions');
  lines.push('export function verifyAll(context: Record<string, unknown>) {');
  lines.push('  return verifier.verifyAll(context);');
  lines.push('}');
  lines.push('');
  lines.push('export function verifyTick(context: Record<string, unknown>) {');
  lines.push('  return verifier.verifyTick(context);');
  lines.push('}');
  lines.push('');
  lines.push('export function verifySafety(context: Record<string, unknown>) {');
  lines.push('  return verifier.verifySafety(context);');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate verification report from results
 *
 * @param {VerificationResult} result - Verification result
 * @param {Object} [options] - Report options
 * @returns {string} Formatted report
 */
export function generateReport(result, options = {}) {
  const lines = [];
  const { verbose = false } = options;

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    VERIFICATION REPORT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push(`Duration:  ${result.durationMs}ms`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('                        SUMMARY');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`Total Checked: ${result.totalChecked}`);
  lines.push(`Passed:        ${result.totalPassed}`);
  lines.push(`Failed:        ${result.totalFailed}`);
  lines.push(`Status:        ${result.passed ? '✓ ALL PASSED' : '✗ FAILURES DETECTED'}`);
  lines.push('');

  if (result.failures.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('                       FAILURES');
    lines.push('───────────────────────────────────────────────────────────');

    for (const failure of result.failures) {
      lines.push('');
      lines.push(`[${failure.severity}] ${failure.name}`);
      lines.push(`  ID:   ${failure.id}`);
      lines.push(`  Expr: ${failure.expr}`);
      if (failure.error) {
        lines.push(`  Error: ${failure.error}`);
      }
      if (verbose && failure.value !== undefined) {
        lines.push(`  Value: ${JSON.stringify(failure.value)}`);
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}
