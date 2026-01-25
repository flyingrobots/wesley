/**
 * TTD Obligation Spec Compiler
 *
 * Compiles schema invariants into verifiable obligation specs.
 * Each obligation includes:
 * - The original invariant definition
 * - Compiled bytecode for VM execution
 * - Metadata for verification scheduling
 */

import { parseExpr } from './parser.mjs';
import { compileToBytecode } from './golden.mjs';
import { defaultCrypto } from '../../ports/crypto.mjs';

/**
 * Obligation severity levels
 */
export const ObligationSeverity = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL',
};

/**
 * Obligation kind (when to verify)
 */
export const ObligationKind = {
  TICK: 'TICK',         // Verify every tick
  EVENTUAL: 'EVENTUAL', // Verify eventually (within N ticks)
  SAFETY: 'SAFETY',     // Verify on state transitions
  ALWAYS: 'ALWAYS',     // Verify continuously
};

/**
 * A compiled obligation spec
 * @typedef {Object} ObligationSpec
 * @property {string} id - Unique obligation ID (hash of name + expr)
 * @property {string} name - Human-readable name
 * @property {string} expr - Original expression string
 * @property {Object} ast - Parsed AST
 * @property {Object} bytecode - Compiled bytecode
 * @property {string} severity - Obligation severity
 * @property {string} kind - When to verify
 * @property {number} [withinTicks] - For EVENTUAL, max ticks to satisfy
 * @property {string[]} dependencies - Referenced channels/ops/collections
 * @property {string} hash - Content hash for caching/versioning
 */

/**
 * Extract dependencies from AST
 * Finds all identifiers that reference channels, ops, collections, etc.
 */
function extractDependencies(ast, deps = new Set()) {
  if (!ast || typeof ast !== 'object') return deps;

  switch (ast.kind) {
    case 'IDENTIFIER':
      // Subject keywords are dependencies
      if (['tick', 'op', 'channel', 'rule'].includes(ast.name)) {
        deps.add(ast.name);
      }
      break;

    case 'FORALL':
      deps.add(`collection:${ast.collection}`);
      extractDependencies(ast.body, deps);
      break;

    case 'METHOD_CALL':
      extractDependencies(ast.receiver, deps);
      for (const arg of ast.args || []) {
        extractDependencies(arg, deps);
      }
      break;

    case 'PROPERTY_ACCESS':
      extractDependencies(ast.object, deps);
      break;

    case 'BINARY':
    case 'COMPARISON':
    case 'LOGICAL':
      extractDependencies(ast.left, deps);
      extractDependencies(ast.right, deps);
      break;

    case 'UNARY':
      extractDependencies(ast.operand, deps);
      break;
  }

  return deps;
}

/**
 * Parse obligation kind from invariant definition
 */
function parseKind(invariant) {
  if (invariant.kind) {
    return invariant.kind;
  }
  // Infer from expression patterns
  const expr = invariant.expr.toLowerCase();
  if (expr.includes('within')) {
    return ObligationKind.EVENTUAL;
  }
  if (expr.includes('tick.')) {
    return ObligationKind.TICK;
  }
  return ObligationKind.ALWAYS;
}

/**
 * Extract within clause from expression if present
 */
function parseWithinTicks(expr) {
  const match = expr.match(/within\s*\(\s*(\d+)\s*\)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Compile a single invariant to an obligation spec
 *
 * @param {Object} invariant - Invariant from schema
 * @param {Object} [deps] - Dependencies
 * @param {import('../../ports/crypto.mjs').CryptoPort} [deps.crypto] - Crypto port
 * @returns {ObligationSpec}
 */
export function compileObligation(invariant, deps = {}) {
  const crypto = deps.crypto ?? defaultCrypto;

  // Parse expression to AST
  let ast;
  try {
    ast = parseExpr(invariant.expr);
  } catch (error) {
    throw new Error(`Failed to parse invariant "${invariant.name}": ${error.message}`);
  }

  // Compile to bytecode
  let bytecode;
  try {
    bytecode = compileToBytecode(ast);
  } catch (error) {
    throw new Error(`Failed to compile invariant "${invariant.name}": ${error.message}`);
  }

  // Extract dependencies
  const dependencies = Array.from(extractDependencies(ast));

  // Generate content hash
  const content = JSON.stringify({
    name: invariant.name,
    expr: invariant.expr,
    bytecode,
  });
  const hash = crypto.sha256(content);

  // Generate unique ID
  const id = `obligation:${crypto.sha256(invariant.name + ':' + invariant.expr).slice(0, 16)}`;

  return {
    id,
    name: invariant.name,
    expr: invariant.expr,
    ast,
    bytecode,
    severity: invariant.severity || ObligationSeverity.ERROR,
    kind: parseKind(invariant),
    withinTicks: parseWithinTicks(invariant.expr),
    dependencies,
    hash,
  };
}

/**
 * Compile all invariants from a schema to obligation specs
 *
 * @param {Object} schema - TTD schema with invariants array
 * @param {Object} [deps] - Dependencies
 * @returns {ObligationSpec[]}
 */
export function compileObligations(schema, deps = {}) {
  const invariants = schema.invariants || [];
  const specs = [];

  for (const invariant of invariants) {
    try {
      specs.push(compileObligation(invariant, deps));
    } catch (error) {
      // Re-throw with context
      throw new Error(`Schema obligation compilation failed: ${error.message}`);
    }
  }

  return specs;
}

/**
 * Generate a verification manifest from obligation specs
 *
 * @param {ObligationSpec[]} specs - Compiled obligation specs
 * @param {Object} [deps] - Dependencies
 * @returns {Object} Verification manifest
 */
export function generateVerificationManifest(specs, deps = {}) {
  const crypto = deps.crypto ?? defaultCrypto;

  // Group by kind for scheduling
  const byKind = {
    [ObligationKind.TICK]: [],
    [ObligationKind.EVENTUAL]: [],
    [ObligationKind.SAFETY]: [],
    [ObligationKind.ALWAYS]: [],
  };

  for (const spec of specs) {
    const kind = spec.kind || ObligationKind.ALWAYS;
    if (byKind[kind]) {
      byKind[kind].push(spec.id);
    }
  }

  // Generate manifest hash
  const manifestContent = JSON.stringify({
    specs: specs.map(s => ({ id: s.id, hash: s.hash })),
    byKind,
  });
  const manifestHash = crypto.sha256(manifestContent);

  return {
    version: 1,
    manifestHash,
    totalObligations: specs.length,
    byKind,
    bySeverity: {
      [ObligationSeverity.INFO]: specs.filter(s => s.severity === ObligationSeverity.INFO).map(s => s.id),
      [ObligationSeverity.WARN]: specs.filter(s => s.severity === ObligationSeverity.WARN).map(s => s.id),
      [ObligationSeverity.ERROR]: specs.filter(s => s.severity === ObligationSeverity.ERROR).map(s => s.id),
      [ObligationSeverity.FATAL]: specs.filter(s => s.severity === ObligationSeverity.FATAL).map(s => s.id),
    },
    obligations: specs.map(spec => ({
      id: spec.id,
      name: spec.name,
      expr: spec.expr,
      severity: spec.severity,
      kind: spec.kind,
      withinTicks: spec.withinTicks,
      dependencies: spec.dependencies,
      hash: spec.hash,
      bytecodeLength: spec.bytecode.instructions.length,
    })),
  };
}

/**
 * Serialize obligation specs to JSON for storage/transmission
 *
 * @param {ObligationSpec[]} specs - Compiled specs
 * @returns {string} JSON string
 */
export function serializeObligations(specs) {
  return JSON.stringify(specs.map(spec => ({
    id: spec.id,
    name: spec.name,
    expr: spec.expr,
    bytecode: spec.bytecode,
    severity: spec.severity,
    kind: spec.kind,
    withinTicks: spec.withinTicks,
    dependencies: spec.dependencies,
    hash: spec.hash,
  })), null, 2);
}

/**
 * Deserialize obligation specs from JSON
 *
 * @param {string} json - Serialized specs
 * @returns {ObligationSpec[]}
 */
export function deserializeObligations(json) {
  const data = JSON.parse(json);
  return data.map(spec => ({
    ...spec,
    // Re-parse AST from expression (not stored in serialized form)
    ast: parseExpr(spec.expr),
  }));
}
