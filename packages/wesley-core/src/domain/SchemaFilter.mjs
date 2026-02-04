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
  const unitSet = new Set(unitIds);
  const pred = item => unitSet.has(item.sourceUnit);

  return {
    ...ir,
    tables: (ir.tables || []).filter(pred),
    enums: (ir.enums || []).filter(pred),
    scalars: (ir.scalars || []).filter(pred),
    // Extend as IR grows: inputs, interfaces, unions, channels, ops, etc.
  };
}
