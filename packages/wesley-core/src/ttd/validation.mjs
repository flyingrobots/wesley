/**
 * TTD Validation Rules
 *
 * Implements validation for TTD schemas including channels, ops,
 * rules, invariants, emissions, footprints, and registries.
 */

export const ValidationSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Create a validation error
 */
function error(code, message, details = {}) {
  return {
    severity: ValidationSeverity.ERROR,
    code,
    message,
    details
  };
}

/**
 * Create a validation warning
 */
function warning(code, message, details = {}) {
  return {
    severity: ValidationSeverity.WARNING,
    code,
    message,
    details
  };
}

/**
 * Validate a channel
 */
export function validateChannel(channel) {
  const errors = [];

  if (!channel.name || channel.name.trim() === '') {
    errors.push(error('CHANNEL_NAME_EMPTY', 'Channel name cannot be empty'));
  }

  if (channel.version < 1) {
    errors.push(error('CHANNEL_VERSION_INVALID', 'Channel version must be >= 1'));
  }

  if (!channel.eventTypes || channel.eventTypes.length === 0) {
    errors.push(warning('CHANNEL_NO_EVENTS', 'Channel has no event types'));
  }

  return errors;
}

/**
 * Validate an operation
 */
export function validateOp(op) {
  const errors = [];

  if (!op.name || op.name.trim() === '') {
    errors.push(error('OP_NAME_EMPTY', 'Operation name cannot be empty'));
  }

  const reservedNames = ['__typename', '__schema', '__type'];
  if (reservedNames.includes(op.name)) {
    errors.push(error('OP_NAME_RESERVED', `Operation name "${op.name}" is reserved`));
  }

  if (op.op_id < 0) {
    errors.push(error('OP_ID_INVALID', 'Operation ID must be >= 0'));
  }

  // Check for duplicate argument names
  const argNames = new Set();
  for (const arg of op.args || []) {
    if (argNames.has(arg.name)) {
      errors.push(error('OP_DUPLICATE_ARG', `Duplicate argument name: ${arg.name}`));
    }
    argNames.add(arg.name);
  }

  return errors;
}

/**
 * Validate a transition rule
 */
export function validateRule(rule, validStates = []) {
  const errors = [];

  if (!rule.from || rule.from.length === 0) {
    errors.push(error('RULE_NO_FROM_STATES', 'Rule must have at least one from state'));
  }

  for (const state of rule.from || []) {
    if (validStates.length > 0 && !validStates.includes(state)) {
      errors.push(error('RULE_UNKNOWN_FROM_STATE', `Unknown from state: ${state}`, { state }));
    }
  }

  if (validStates.length > 0 && !validStates.includes(rule.to)) {
    errors.push(error('RULE_UNKNOWN_TO_STATE', `Unknown to state: ${rule.to}`, { state: rule.to }));
  }

  // Warn on self-transition without guard
  if (rule.from?.includes(rule.to) && !rule.guard) {
    errors.push(warning('RULE_SELF_TRANSITION_NO_GUARD', 'Self-transition without guard expression'));
  }

  return errors;
}

/**
 * Validate an invariant
 */
export function validateInvariant(inv) {
  const errors = [];

  if (!inv.expr || inv.expr.trim() === '') {
    errors.push(error('INVARIANT_EMPTY_EXPR', 'Invariant expression cannot be empty'));
  }

  const validSeverities = ['error', 'warning'];
  if (!validSeverities.includes(inv.severity)) {
    errors.push(error('INVARIANT_INVALID_SEVERITY', `Invalid severity: ${inv.severity}`));
  }

  // Basic syntax check for expression
  if (inv.expr) {
    try {
      // Check for obviously malformed expressions
      if (inv.expr.includes('forall') && !inv.expr.includes(' in ')) {
        errors.push(error('INVARIANT_PARSE_ERROR', 'forall expression missing "in" keyword'));
      }
      if (inv.expr.includes(' in :')) {
        errors.push(error('INVARIANT_PARSE_ERROR', 'Invalid forall expression: empty collection'));
      }
    } catch (e) {
      errors.push(error('INVARIANT_PARSE_ERROR', `Failed to parse expression: ${e.message}`));
    }
  }

  return errors;
}

/**
 * Validate an emission contract
 */
export function validateEmission(emission, channels = []) {
  const errors = [];

  const channel = channels.find(c => c.name === emission.channel);

  if (!channel) {
    errors.push(error('EMISSION_UNKNOWN_CHANNEL', `Unknown channel: ${emission.channel}`));
  }

  if (channel && emission.event && !channel.eventTypes?.includes(emission.event)) {
    errors.push(error('EMISSION_UNKNOWN_EVENT', `Event "${emission.event}" not in channel "${emission.channel}"`));
  }

  // Only warn about missing timing for emissions in channels with a single event type
  // (channels with multiple event types have less stringent timing requirements)
  if (emission.withinMs === undefined && channel && channel.eventTypes?.length === 1) {
    errors.push(warning('EMISSION_NO_TIMING', 'Emission has no timing constraint'));
  }

  if (emission.withinMs !== undefined && emission.withinMs < 0) {
    errors.push(error('EMISSION_INVALID_TIMING', 'Emission timing must be >= 0'));
  }

  return errors;
}

/**
 * Validate a footprint
 */
export function validateFootprint(fp, knownTypes = []) {
  const errors = [];

  const slotTypes = (fp.slots || []).map((slot) => slot.kind).filter(Boolean);
  const closureTypes = (fp.closures || []).flatMap((closure) => closure.reads || []);
  const createSlotTypes = (fp.createSlots || []).map((slot) => slot.kind).filter(Boolean);

  const allTypes = [
    ...(fp.reads || []),
    ...(fp.writes || []),
    ...(fp.creates || []),
    ...(fp.deletes || []),
    ...slotTypes,
    ...closureTypes,
    ...createSlotTypes
  ];

  for (const type of allTypes) {
    if (knownTypes.length > 0 && !knownTypes.includes(type)) {
      errors.push(error('FOOTPRINT_UNKNOWN_TYPE', `Unknown type in footprint: ${type}`, { type }));
    }
  }

  const structuredSurfaceCount =
    (fp.slots?.length ?? 0) +
    (fp.closures?.length ?? 0) +
    (fp.createSlots?.length ?? 0) +
    (fp.updates?.length ?? 0) +
    (fp.forbids?.length ?? 0);

  if (allTypes.length === 0 && structuredSurfaceCount === 0) {
    errors.push(warning('FOOTPRINT_EMPTY', 'Footprint has no reads, writes, creates, or deletes'));
  }

  for (const slot of fp.slots || []) {
    if (!slot.slot) {
      errors.push(error('FOOTPRINT_SLOT_NAME_EMPTY', 'Footprint slot must have a name'));
    }
    if (!slot.kind) {
      errors.push(error('FOOTPRINT_SLOT_KIND_EMPTY', 'Footprint slot must declare a kind'));
    }
    if (!Array.isArray(slot.access) || slot.access.length === 0) {
      errors.push(error('FOOTPRINT_SLOT_ACCESS_EMPTY', `Footprint slot "${slot.slot || '<unnamed>'}" must declare at least one access mode`));
    }
  }

  for (const closure of fp.closures || []) {
    if (!closure.slot) {
      errors.push(error('FOOTPRINT_CLOSURE_SLOT_EMPTY', 'Footprint closure must have a slot name'));
    }
    if (!closure.fromSlot) {
      errors.push(error('FOOTPRINT_CLOSURE_FROM_SLOT_EMPTY', `Footprint closure "${closure.slot || '<unnamed>'}" must declare fromSlot`));
    }
    if (!closure.operator) {
      errors.push(error('FOOTPRINT_CLOSURE_OPERATOR_EMPTY', `Footprint closure "${closure.slot || '<unnamed>'}" must declare an operator`));
    }
    if (!Array.isArray(closure.reads) || closure.reads.length === 0) {
      errors.push(error('FOOTPRINT_CLOSURE_READS_EMPTY', `Footprint closure "${closure.slot || '<unnamed>'}" must declare reads`));
    }
  }

  for (const slot of fp.createSlots || []) {
    if (!slot.slot) {
      errors.push(error('FOOTPRINT_CREATE_SLOT_NAME_EMPTY', 'Footprint createSlot must have a slot name'));
    }
    if (!slot.kind) {
      errors.push(error('FOOTPRINT_CREATE_KIND_EMPTY', `Footprint createSlot "${slot.slot || '<unnamed>'}" must declare a kind`));
    }
  }

  for (const update of fp.updates || []) {
    if (!update.slot) {
      errors.push(error('FOOTPRINT_UPDATE_SLOT_EMPTY', 'Footprint update must declare a slot'));
    }
    if (!Array.isArray(update.fields) || update.fields.length === 0) {
      errors.push(error('FOOTPRINT_UPDATE_FIELDS_EMPTY', `Footprint update "${update.slot || '<unnamed>'}" must declare at least one field`));
    }
  }

  // Warn if creates without writes
  for (const created of fp.creates || []) {
    if (!fp.writes?.includes(created)) {
      errors.push(warning('FOOTPRINT_CREATE_NO_WRITE', `Creating ${created} without write permission`));
    }
  }

  return errors;
}

/**
 * Validate registry entries
 */
export function validateRegistry(entries) {
  const errors = [];
  const seenIds = new Set();
  const seenTypes = new Set();

  for (const entry of entries) {
    if (entry.id < 0) {
      errors.push(error('REGISTRY_INVALID_ID', `Invalid registry ID: ${entry.id}`));
    }

    if (seenIds.has(entry.id)) {
      errors.push(error('REGISTRY_DUPLICATE_ID', `Duplicate registry ID: ${entry.id}`));
    }
    seenIds.add(entry.id);

    if (seenTypes.has(entry.typeName)) {
      errors.push(error('REGISTRY_DUPLICATE_TYPE', `Duplicate type in registry: ${entry.typeName}`));
    }
    seenTypes.add(entry.typeName);

    if (entry.deprecated && !entry.deprecatedBy) {
      errors.push(warning('REGISTRY_DEPRECATED_NO_REPLACEMENT', `Deprecated type ${entry.typeName} has no replacement`));
    }
  }

  return errors;
}

/**
 * Validate a state machine (set of rules)
 */
export function validateStateMachine(rules, states) {
  const errors = [];

  // Find all states that appear in rules
  const reachableFrom = new Set();
  const reachableTo = new Set();

  for (const rule of rules) {
    for (const from of rule.from || []) {
      reachableFrom.add(from);
    }
    reachableTo.add(rule.to);
  }

  // Check for unreachable states
  for (const state of states) {
    // A state is reachable if it's a source state or a target state
    if (!reachableFrom.has(state) && !reachableTo.has(state)) {
      errors.push(warning('SM_UNREACHABLE_STATE', `State "${state}" is not reachable`, { state }));
    }
  }

  // Check for terminal states (states with no outgoing transitions)
  // Don't warn for states with clearly terminal-sounding names
  const terminalNames = ['COMPLETED', 'FINISHED', 'STOPPED', 'ENDED', 'CLOSED', 'TERMINATED', 'FAILED', 'CANCELLED', 'ARCHIVED'];

  for (const state of states) {
    const hasOutgoing = rules.some(r => r.from?.includes(state));
    const isTarget = reachableTo.has(state);
    const hasTerminalName = terminalNames.includes(state) || state.startsWith('DONE_') || state.startsWith('COMPLETED_');

    if (!hasOutgoing && isTarget && !hasTerminalName) {
      errors.push(warning('SM_IMPLICIT_TERMINAL', `State "${state}" appears to be terminal`, { state }));
    }
  }

  return errors;
}

/**
 * Validate a complete TTD schema
 */
export function validateTtdSchema(schema) {
  const allErrors = [];

  // Validate channels
  for (const channel of schema.channels || []) {
    allErrors.push(...validateChannel(channel));
  }

  // Validate ops
  for (const op of schema.ops || []) {
    allErrors.push(...validateOp(op));
  }

  // Collect valid states from enums
  const validStates = [];
  for (const enumDef of schema.enums || []) {
    validStates.push(...enumDef.values);
  }

  // Validate rules
  for (const rule of schema.rules || []) {
    allErrors.push(...validateRule(rule, validStates));
  }

  // Validate invariants
  for (const inv of schema.invariants || []) {
    allErrors.push(...validateInvariant(inv));
  }

  // Validate emissions
  for (const emission of schema.emissions || []) {
    allErrors.push(...validateEmission(emission, schema.channels));
  }

  // Collect known types
  const knownTypes = (schema.types || []).map(t => t.name);

  // Validate footprints
  for (const fp of schema.footprints || []) {
    allErrors.push(...validateFootprint(fp, knownTypes));
  }

  // Validate registry
  allErrors.push(...validateRegistry(schema.registry || []));

  // Validate state machine rules
  if (schema.rules && schema.rules.length > 0) {
    allErrors.push(...validateStateMachine(schema.rules, validStates));
  }

  // Separate errors and warnings
  const errors = allErrors.filter(e => e.severity === ValidationSeverity.ERROR);
  const warnings = allErrors.filter(e => e.severity === ValidationSeverity.WARNING);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
