// wesley-core/src/application/ConfigValidator.mjs

/**
 * Known experimental flags. Unknown flags produce a warning, not an error.
 * @type {ReadonlyArray<string>}
 */
export const KNOWN_EXPERIMENTAL_FLAGS = Object.freeze(['irV2', 'rawLe', 'join']);

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * Validate a wesley config object's `generators` and `experimental` shape.
 *
 * - `generators` must be an array of objects with `package` (string).
 * - Each entry may have `config` (object) and `enabled` (boolean).
 * - `experimental` must be an object of boolean flags if present.
 * - Unknown experimental flags produce warnings.
 *
 * @param {unknown} config
 * @returns {ValidationResult}
 */
export function validateConfig(config) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (config == null || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('Config must be a non-null object');
    return { valid: false, errors, warnings };
  }

  // --- generators ---
  if ('generators' in config) {
    const gens = config.generators;
    if (!Array.isArray(gens)) {
      errors.push('Config "generators" must be an array');
    } else {
      for (let i = 0; i < gens.length; i++) {
        const entry = gens[i];
        if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
          errors.push(`generators[${i}] must be a non-null object`);
          continue;
        }
        if (typeof entry.package !== 'string' || entry.package.trim().length === 0) {
          errors.push(`generators[${i}] must have a non-empty "package" string`);
        }
        if (
          entry.config !== undefined &&
          (typeof entry.config !== 'object' || entry.config === null || Array.isArray(entry.config))
        ) {
          errors.push(`generators[${i}].config must be a plain object if provided`);
        }
        if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
          errors.push(`generators[${i}].enabled must be a boolean if provided`);
        }
      }
    }
  }

  // --- experimental ---
  if ('experimental' in config) {
    const exp = config.experimental;
    if (exp == null || typeof exp !== 'object' || Array.isArray(exp)) {
      errors.push('Config "experimental" must be a plain object');
    } else {
      for (const [key, value] of Object.entries(exp)) {
        if (typeof value !== 'boolean') {
          errors.push(`experimental.${key} must be a boolean (got ${typeof value})`);
        }
        if (!KNOWN_EXPERIMENTAL_FLAGS.includes(key)) {
          warnings.push(`Unknown experimental flag "${key}" — it will be ignored`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
