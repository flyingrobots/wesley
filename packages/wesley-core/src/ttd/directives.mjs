/**
 * TTD Directive Parser
 *
 * Parses TTD-specific directives from GraphQL AST nodes.
 */

/**
 * List of all TTD directive names
 */
const TTD_DIRECTIVES = new Set([
  'wes_channel',
  'wes_op',
  'wes_rule',
  'wes_invariant',
  'wes_emission',
  'wes_footprint',
  'wes_requires',
  'wes_produces',
  'wes_emitsTo',
  'wes_mustEmit',
  'wes_codec',
  'wes_registry',
  'wes_stateField',
  'wes_constraint',
  'wes_version',
  'wes_tick',
  'wes_effect',
  'wes_join'
]);

/**
 * Check if a directive name is a TTD directive
 */
export function isTtdDirective(name) {
  return TTD_DIRECTIVES.has(name);
}

/**
 * Extract argument value from a GraphQL directive argument node
 */
function getArgValue(arg) {
  if (!arg || !arg.value) return undefined;

  const val = arg.value;
  switch (val.kind) {
  case 'StringValue':
    return val.value;
  case 'IntValue':
    return parseInt(val.value, 10);
  case 'FloatValue':
    return parseFloat(val.value);
  case 'BooleanValue':
    return val.value;
  case 'NullValue':
    return null;
  case 'ListValue':
    return val.values.map(v => getArgValue({ value: v }));
  case 'EnumValue':
    return val.value;
  case 'ObjectValue': {
    const obj = {};
    for (const field of val.fields) {
      obj[field.name.value] = getArgValue({ value: field.value });
    }
    return obj;
  }
  default:
    return val.value;
  }
}

/**
 * Get argument by name from directive
 */
function getArg(directive, name) {
  const arg = directive.arguments?.find(a => a.name.value === name);
  return getArgValue(arg);
}

/**
 * Parse @wes_channel directive
 */
export function parseChannelDirective(directive, defaultName = '') {
  return {
    name: getArg(directive, 'name') ?? defaultName,
    version: getArg(directive, 'version') ?? 1,
    ordered: getArg(directive, 'ordered') ?? true,
    persistent: getArg(directive, 'persistent') ?? false
  };
}

/**
 * Parse @wes_op directive
 */
export function parseOpDirective(directive, defaultName = '') {
  return {
    name: getArg(directive, 'name') ?? defaultName,
    idempotent: getArg(directive, 'idempotent') ?? false,
    readonly: getArg(directive, 'readonly') ?? false,
    timeout: getArg(directive, 'timeout')
  };
}

/**
 * Parse @wes_rule directive
 */
export function parseRuleDirective(directive) {
  return {
    name: getArg(directive, 'name'),
    from: getArg(directive, 'from'),
    to: getArg(directive, 'to'),
    guard: getArg(directive, 'guard')
  };
}

/**
 * Parse @wes_invariant directive
 */
export function parseInvariantDirective(directive) {
  return {
    name: getArg(directive, 'name'),
    expr: getArg(directive, 'expr'),
    severity: getArg(directive, 'severity') ?? 'error'
  };
}

/**
 * Parse @wes_emission directive
 */
export function parseEmissionDirective(directive) {
  return {
    channel: getArg(directive, 'channel'),
    event: getArg(directive, 'event'),
    condition: getArg(directive, 'condition')
  };
}

/**
 * Parse @wes_footprint directive
 */
export function parseFootprintDirective(directive) {
  return {
    reads: getArg(directive, 'reads') ?? [],
    writes: getArg(directive, 'writes') ?? [],
    creates: getArg(directive, 'creates') ?? [],
    deletes: getArg(directive, 'deletes') ?? [],
    slots: getArg(directive, 'slots') ?? [],
    closures: getArg(directive, 'closures') ?? [],
    createSlots: getArg(directive, 'createSlots') ?? [],
    updates: getArg(directive, 'updates') ?? [],
    forbids: getArg(directive, 'forbids') ?? []
  };
}

/**
 * Parse @wes_codec directive
 */
export function parseCodecDirective(directive) {
  const format = getArg(directive, 'format');
  const canonical = getArg(directive, 'canonical');
  return {
    format,
    canonical: canonical ?? (format === 'cbor')
  };
}

/**
 * Parse @wes_registry directive
 */
export function parseRegistryDirective(directive) {
  return {
    id: getArg(directive, 'id'),
    deprecated: getArg(directive, 'deprecated') ?? false,
    deprecatedBy: getArg(directive, 'deprecatedBy')
  };
}

/**
 * Parse @wes_constraint directive
 */
export function parseConstraintDirective(directive) {
  return {
    min: getArg(directive, 'min'),
    max: getArg(directive, 'max'),
    minLength: getArg(directive, 'minLength'),
    maxLength: getArg(directive, 'maxLength'),
    pattern: getArg(directive, 'pattern'),
    oneOf: getArg(directive, 'oneOf')
  };
}

/**
 * Parse @wes_stateField directive
 */
export function parseStateFieldDirective(directive) {
  return {
    key: getArg(directive, 'key') ?? false,
    derived: getArg(directive, 'derived') ?? false,
    derivation: getArg(directive, 'derivation')
  };
}

/**
 * Parse @wes_requires directive
 */
export function parseRequiresDirective(directive) {
  return {
    ops: getArg(directive, 'ops'),
    state: getArg(directive, 'state'),
    permissions: getArg(directive, 'permissions')
  };
}

/**
 * Parse @wes_produces directive
 */
export function parseProducesDirective(directive) {
  return {
    events: getArg(directive, 'events'),
    state: getArg(directive, 'state')
  };
}

/**
 * Parse @wes_emitsTo directive
 */
export function parseEmitsToDirective(directive) {
  return {
    channel: getArg(directive, 'channel'),
    within: getArg(directive, 'within')
  };
}

/**
 * Parse @wes_mustEmit directive
 */
export function parseMustEmitDirective(directive) {
  return {
    event: getArg(directive, 'event'),
    within: getArg(directive, 'within')
  };
}

/**
 * Parse @wes_version directive
 */
export function parseVersionDirective(directive) {
  return {
    major: getArg(directive, 'major'),
    minor: getArg(directive, 'minor'),
    patch: getArg(directive, 'patch') ?? 0
  };
}

/**
 * Parse @wes_tick directive
 */
export function parseTickDirective(directive) {
  return {
    interval: getArg(directive, 'interval'),
    jitter: getArg(directive, 'jitter')
  };
}

/**
 * Parse @wes_effect directive
 */
export function parseEffectDirective(directive) {
  return {
    type: getArg(directive, 'type'),
    description: getArg(directive, 'description')
  };
}

/**
 * Valid @wes_join strategies
 */
export const VALID_JOIN_STRATEGIES = ['union', 'max', 'lww'];

/**
 * Parse @wes_join directive
 */
export function parseJoinDirective(directive) {
  return {
    strategy: getArg(directive, 'strategy')
  };
}

/**
 * Validate @wes_join directive against a field's type information.
 *
 * @param {{ strategy: string }} joinMeta - Parsed join directive metadata
 * @param {{ list: boolean, base: string }} fieldType - Field type info (list flag and base type name)
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

  // "lww" is valid on any field type
  return null;
}

/**
 * Extract all TTD directives from a list of directives
 */
export function extractTtdDirectives(directives) {
  const result = {
    channel: undefined,
    op: undefined,
    rules: [],
    invariants: [],
    emissions: [],
    footprint: undefined,
    codec: undefined,
    registry: undefined,
    constraint: undefined,
    stateField: undefined,
    requires: undefined,
    produces: undefined,
    emitsTo: undefined,
    mustEmit: undefined,
    version: undefined,
    tick: undefined,
    effects: [],
    join: undefined
  };

  if (!directives) return result;

  for (const d of directives) {
    const name = d.name.value;

    switch (name) {
    case 'wes_channel':
      result.channel = parseChannelDirective(d);
      break;
    case 'wes_op':
      result.op = parseOpDirective(d);
      break;
    case 'wes_rule':
      result.rules.push(parseRuleDirective(d));
      break;
    case 'wes_invariant':
      result.invariants.push(parseInvariantDirective(d));
      break;
    case 'wes_emission':
      result.emissions.push(parseEmissionDirective(d));
      break;
    case 'wes_footprint':
      result.footprint = parseFootprintDirective(d);
      break;
    case 'wes_codec':
      result.codec = parseCodecDirective(d);
      break;
    case 'wes_registry':
      result.registry = parseRegistryDirective(d);
      break;
    case 'wes_constraint':
      result.constraint = parseConstraintDirective(d);
      break;
    case 'wes_stateField':
      result.stateField = parseStateFieldDirective(d);
      break;
    case 'wes_requires':
      result.requires = parseRequiresDirective(d);
      break;
    case 'wes_produces':
      result.produces = parseProducesDirective(d);
      break;
    case 'wes_emitsTo':
      result.emitsTo = parseEmitsToDirective(d);
      break;
    case 'wes_mustEmit':
      result.mustEmit = parseMustEmitDirective(d);
      break;
    case 'wes_version':
      result.version = parseVersionDirective(d);
      break;
    case 'wes_tick':
      result.tick = parseTickDirective(d);
      break;
    case 'wes_effect':
      result.effects.push(parseEffectDirective(d));
      break;
    case 'wes_join':
      result.join = parseJoinDirective(d);
      break;
    }
  }

  return result;
}
