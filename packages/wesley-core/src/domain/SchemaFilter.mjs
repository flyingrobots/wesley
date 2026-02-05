/**
 * SchemaFilter - Filter Wesley IR by compilation unit IDs.
 *
 * Used with `--unit` flag to scope code generation to specific files.
 */

/**
 * Filter IR to only include items whose `sourceUnit` is in the given set.
 *
 * @param {object} ir - Wesley IR object
 * @param {string[]} unitIds - Unit IDs to keep
 * @returns {object} Filtered IR (shallow copy with filtered collections)
 */
export function filterIRByUnits(ir, unitIds) {
  if (ir == null) {
    throw new TypeError('ir must not be null or undefined');
  }
  if (unitIds == null || typeof unitIds[Symbol.iterator] !== 'function') {
    throw new TypeError('unitIds must be iterable');
  }

  const unitSet = new Set(unitIds);
  // Preserve items where sourceUnit is undefined (they belong to no specific unit)
  const pred = item => item.sourceUnit === undefined || unitSet.has(item.sourceUnit);

  return {
    ...ir,
    tables: (ir.tables || []).filter(pred),
    enums: (ir.enums || []).filter(pred),
    scalars: (ir.scalars || []).filter(pred),
    // TODO: When new top-level IR collections are added, update this filter in the same commit.
  };
}
