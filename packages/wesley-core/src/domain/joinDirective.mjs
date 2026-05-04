/**
 * Generic @wes_join directive validation.
 *
 * The join directive remains part of Wesley's generic lowering surface. TTD
 * protocol parsing moved out to the Continuum-owned module.
 */

export const VALID_JOIN_STRATEGIES = ['union', 'max', 'lww'];

/**
 * Validate @wes_join directive metadata against a field's type information.
 *
 * @param {{ strategy: string }} joinMeta - Parsed join directive metadata
 * @param {{ list: boolean, base: string }} fieldType - Field type info
 * @param {string} fieldName - Field name for error messages
 * @returns {string|null} Error message string, or null if valid
 */
export function validateJoinDirective(joinMeta, fieldType, fieldName) {
  const { strategy } = joinMeta;

  if (!VALID_JOIN_STRATEGIES.includes(strategy)) {
    return `Unknown @wes_join strategy "${strategy}". Valid: ${VALID_JOIN_STRATEGIES.join(', ')}`;
  }

  if (strategy === 'union' && !fieldType.list) {
    return `@wes_join(strategy: "union") requires a list field, but "${fieldName}" is ${fieldType.base}`;
  }

  if (strategy === 'max') {
    const numericTypes = new Set(['Int', 'Float']);
    if (!numericTypes.has(fieldType.base)) {
      return `@wes_join(strategy: "max") requires Int or Float, but "${fieldName}" is ${fieldType.base}`;
    }
  }

  return null;
}
