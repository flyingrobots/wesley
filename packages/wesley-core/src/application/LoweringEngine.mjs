import { irToSchema } from './irToSchema.mjs';

/**
 * LoweringEngine - canonical schema lowering seam for transmutations.
 *
 * Accepts raw SDL, Wesley IR, or a domain Schema and returns the normalized
 * views that plugins and orchestrators need without forcing callers to stitch
 * those shapes together ad hoc.
 */
export class LoweringEngine {
  /**
   * @param {{ parseIr?: ((sdl: string, options?: object) => object|Promise<object>) }} [deps]
   */
  constructor({ parseIr } = {}) {
    this._parseIr = typeof parseIr === 'function' ? parseIr : null;
  }

  /**
   * @param {object} input
   * @param {{ parseOptions?: object }} [options]
   * @returns {Promise<{ sdl: string|null, ir: object|null, domain: object|null, pluginSchema: object }>}
   */
  async lower(input, options = {}) {
    if (input == null || typeof input !== 'object') {
      throw new TypeError('LoweringEngine.lower: input must be an object');
    }

    const sdl = typeof input.sdl === 'string' ? input.sdl : null;
    let ir = extractIr(input);
    if (!ir && sdl && this._parseIr) {
      ir = await this._parseIr(sdl, options.parseOptions);
    }

    let domain = extractDomain(input);
    if (!domain && ir) {
      domain = irToSchema(ir);
    }

    const pluginSchema = createLoweredSchemaEnvelope({
      domain,
      ir,
      sdl
    });

    return { sdl, ir, domain, pluginSchema };
  }
}

/**
 * Build the canonical plugin-facing schema envelope. When a domain Schema is
 * available we preserve its prototype so generator code can still call
 * getTables() while also reading ir/sdl metadata when needed.
 *
 * @param {{ domain?: object|null, ir?: object|null, sdl?: string|null }} [input]
 * @returns {object}
 */
export function createLoweredSchemaEnvelope({ domain = null, ir = null, sdl = null } = {}) {
  const envelope =
    domain && typeof domain === 'object'
      ? Object.assign(Object.create(Object.getPrototypeOf(domain)), domain)
      : {};

  if (ir) envelope.ir = ir;
  if (typeof sdl === 'string') envelope.sdl = sdl;

  return envelope;
}

function extractIr(input) {
  if (isIr(input?.ir)) return input.ir;
  if (isIr(input)) return input;
  return null;
}

function extractDomain(input) {
  if (isDomainSchema(input?.domain)) return input.domain;
  if (isDomainSchema(input)) return input;
  return null;
}

function isIr(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.tables));
}

function isDomainSchema(value) {
  return Boolean(value && typeof value.getTables === 'function');
}
