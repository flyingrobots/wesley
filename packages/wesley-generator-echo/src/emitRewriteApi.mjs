function pascalCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function snakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function rustType(typeName) {
  switch (typeName) {
  case 'String':
  case 'ID':
    return 'String';
  case 'Int':
    return 'i64';
  case 'Float':
    return 'f64';
  case 'Boolean':
    return 'bool';
  default:
    return typeName;
  }
}

function capabilityTraitName(mode, resource) {
  return `${pascalCase(mode)}${pascalCase(resource)}`;
}

function capabilityMethodName(mode, resource) {
  return `${mode}_${snakeCase(resource)}`;
}

function opTraitStem(opName) {
  return pascalCase(opName);
}

function hasStructuredFootprint(footprint) {
  return ['slots', 'closures', 'createSlots', 'updates', 'forbids'].some(
    (key) => (footprint?.[key] ?? []).length > 0
  );
}

function normalizeAccess(access) {
  return String(access).trim().toLowerCase();
}

function emitArgsStruct(op) {
  const argsName = `${opTraitStem(op.name)}Args`;
  if (!op.args?.length) {
    return [
      '#[derive(Debug, Clone, PartialEq, Eq)]',
      `pub struct ${argsName};`,
      ''
    ].join('\n');
  }

  const lines = [
    '#[derive(Debug, Clone, PartialEq)]',
    `pub struct ${argsName} {`
  ];
  for (const arg of op.args) {
    const argType = rustType(arg.type);
    const baseType = arg.list ? `Vec<${argType}>` : argType;
    const fullType = arg.required ? baseType : `Option<${baseType}>`;
    lines.push(`    pub ${snakeCase(arg.name)}: ${fullType},`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function emitCapabilityTrait(mode, resource) {
  const traitName = capabilityTraitName(mode, resource);
  const methodName = capabilityMethodName(mode, resource);
  const ty = rustType(resource);

  if (mode === 'read') {
    return [
      `pub trait ${traitName} {`,
      `    fn ${methodName}(&self) -> &${ty};`,
      '}',
      ''
    ].join('\n');
  }

  if (mode === 'delete') {
    return [
      `pub trait ${traitName} {`,
      `    fn ${methodName}(&mut self);`,
      '}',
      ''
    ].join('\n');
  }

  return [
    `pub trait ${traitName} {`,
    `    fn ${methodName}(&mut self, value: ${ty});`,
    '}',
    ''
  ].join('\n');
}

function structuredSlotTraitName(op, access, slot) {
  return `${opTraitStem(op.name)}${pascalCase(access)}${pascalCase(slot.slot)}Slot`;
}

function structuredSlotMethodName(access, slot) {
  return `${normalizeAccess(access)}_${snakeCase(slot.slot)}_slot`;
}

function emitStructuredSlotTrait(op, slot, access) {
  const traitName = structuredSlotTraitName(op, access, slot);
  const methodName = structuredSlotMethodName(access, slot);
  const ty = rustType(slot.kind);
  const mode = normalizeAccess(access);

  if (mode === 'read') {
    return [
      `pub trait ${traitName} {`,
      `    fn ${methodName}(&self) -> &${ty};`,
      '}',
      ''
    ].join('\n');
  }

  if (mode === 'delete') {
    return [
      `pub trait ${traitName} {`,
      `    fn ${methodName}(&mut self);`,
      '}',
      ''
    ].join('\n');
  }

  return [
    `pub trait ${traitName} {`,
    `    fn ${methodName}(&mut self, value: ${ty});`,
    '}',
    ''
  ].join('\n');
}

function closureEnumName(op, closure) {
  return `${opTraitStem(op.name)}${pascalCase(closure.slot)}ClosureItemRef`;
}

function closureTraitName(op, closure) {
  return `${opTraitStem(op.name)}Read${pascalCase(closure.slot)}Closure`;
}

function closureMethodName(closure) {
  return `read_${snakeCase(closure.slot)}_closure`;
}

function emitStructuredClosureEnum(op, closure) {
  const enumName = closureEnumName(op, closure);
  const lines = [`pub enum ${enumName}<'a> {`];
  for (const resource of closure.reads ?? []) {
    lines.push(`    ${pascalCase(resource)}(&'a ${rustType(resource)}),`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function emitStructuredClosureTrait(op, closure) {
  const traitName = closureTraitName(op, closure);
  const methodName = closureMethodName(closure);
  const enumName = closureEnumName(op, closure);

  return [
    `pub trait ${traitName} {`,
    `    fn ${methodName}(&self) -> Vec<${enumName}<'_>>;`,
    '}',
    ''
  ].join('\n');
}

function createSlotTraitName(op, slot) {
  return `${opTraitStem(op.name)}Create${pascalCase(slot.slot)}Slot`;
}

function createSlotMethodName(slot) {
  return `create_${snakeCase(slot.slot)}_slot`;
}

function emitStructuredCreateSlotTrait(op, slot) {
  const traitName = createSlotTraitName(op, slot);
  const methodName = createSlotMethodName(slot);
  const ty = rustType(slot.kind);

  return [
    `pub trait ${traitName} {`,
    `    fn ${methodName}(&mut self, value: ${ty}) -> ${ty};`,
    '}',
    ''
  ].join('\n');
}

function updateTraitName(op, slotName, fieldName) {
  return `${opTraitStem(op.name)}Update${pascalCase(slotName)}${pascalCase(fieldName)}`;
}

function updateMethodName(slotName, fieldName) {
  return `update_${snakeCase(slotName)}_${snakeCase(fieldName)}`;
}

function resolveUpdateValueType(ir, op, slotName, fieldName) {
  const slot = (op.footprint?.slots ?? []).find((entry) => entry.slot === slotName);
  if (!slot?.kind) return 'String';

  const slotType = (ir.types ?? []).find((entry) => entry.name === slot.kind);
  const field = slotType?.fields?.find((entry) => entry.name === fieldName);
  if (field) return rustType(field.type);

  const idField = slotType?.fields?.find((entry) => entry.name === `${fieldName}Id`);
  if (idField) return rustType(idField.type);

  return 'String';
}

function emitStructuredUpdateTrait(ir, op, update, fieldName) {
  const traitName = updateTraitName(op, update.slot, fieldName);
  const methodName = updateMethodName(update.slot, fieldName);
  const valueType = resolveUpdateValueType(ir, op, update.slot, fieldName);

  return [
    `pub trait ${traitName} {`,
    `    fn ${methodName}(&mut self, value: ${valueType});`,
    '}',
    ''
  ].join('\n');
}

function flatBounds(op) {
  const bounds = [];
  for (const resource of op.footprint?.reads ?? []) bounds.push(capabilityTraitName('read', resource));
  for (const resource of op.footprint?.writes ?? []) bounds.push(capabilityTraitName('write', resource));
  for (const resource of op.footprint?.creates ?? []) bounds.push(capabilityTraitName('create', resource));
  for (const resource of op.footprint?.deletes ?? []) bounds.push(capabilityTraitName('delete', resource));
  return [...new Set(bounds)];
}

function structuredBounds(op) {
  const bounds = [];

  for (const slot of op.footprint?.slots ?? []) {
    for (const access of slot.access ?? []) {
      bounds.push(structuredSlotTraitName(op, normalizeAccess(access), slot));
    }
  }

  for (const closure of op.footprint?.closures ?? []) {
    bounds.push(closureTraitName(op, closure));
  }

  for (const slot of op.footprint?.createSlots ?? []) {
    bounds.push(createSlotTraitName(op, slot));
  }

  for (const update of op.footprint?.updates ?? []) {
    for (const fieldName of update.fields ?? []) {
      bounds.push(updateTraitName(op, update.slot, fieldName));
    }
  }

  return [...new Set(bounds)];
}

function emitContextTrait(op) {
  const stem = opTraitStem(op.name);
  const bounds = hasStructuredFootprint(op.footprint) ? structuredBounds(op) : flatBounds(op);
  const boundList = bounds.join(' + ');
  const lines = [];

  if ((op.footprint?.forbids ?? []).length) {
    lines.push(`// ${stem} forbidden surfaces: ${(op.footprint.forbids ?? []).join(', ')}`);
  }

  lines.push(
    bounds.length
      ? `pub trait ${stem}Context: ${boundList} {}`
      : `pub trait ${stem}Context {}`
  );
  lines.push(
    bounds.length
      ? `impl<T> ${stem}Context for T where T: ${boundList} {}`
      : `impl<T> ${stem}Context for T {}`
  );
  lines.push('');
  return lines.join('\n');
}

function emitRewriteTrait(op) {
  const stem = opTraitStem(op.name);
  const argsName = `${stem}Args`;
  const resultType = rustType(op.result_type);

  return [
    `pub trait ${stem}Rewrite {`,
    '    type Error;',
    '',
    `    fn apply<C>(&self, ctx: &mut C, args: ${argsName}) -> Result<${resultType}, Self::Error>`,
    `    where C: ${stem}Context;`,
    '}',
    ''
  ].join('\n');
}

function collectCapabilities(ir, mutationOps) {
  const capabilities = new Map();

  for (const op of mutationOps) {
    if (hasStructuredFootprint(op.footprint)) {
      for (const slot of op.footprint.slots ?? []) {
        for (const access of slot.access ?? []) {
          const mode = normalizeAccess(access);
          capabilities.set(
            `slot:${op.name}:${mode}:${slot.slot}`,
            { kind: 'slot', op, slot, access: mode }
          );
        }
      }

      for (const closure of op.footprint.closures ?? []) {
        capabilities.set(
          `closure:${op.name}:${closure.slot}`,
          { kind: 'closure', op, closure }
        );
      }

      for (const slot of op.footprint.createSlots ?? []) {
        capabilities.set(
          `create-slot:${op.name}:${slot.slot}`,
          { kind: 'create-slot', op, slot }
        );
      }

      for (const update of op.footprint.updates ?? []) {
        for (const fieldName of update.fields ?? []) {
          capabilities.set(
            `update:${op.name}:${update.slot}:${fieldName}`,
            { kind: 'update', op, update, fieldName, ir }
          );
        }
      }
      continue;
    }

    for (const resource of op.footprint?.reads ?? []) {
      capabilities.set(`flat:read:${resource}`, { kind: 'flat', mode: 'read', resource });
    }
    for (const resource of op.footprint?.writes ?? []) {
      capabilities.set(`flat:write:${resource}`, { kind: 'flat', mode: 'write', resource });
    }
    for (const resource of op.footprint?.creates ?? []) {
      capabilities.set(`flat:create:${resource}`, { kind: 'flat', mode: 'create', resource });
    }
    for (const resource of op.footprint?.deletes ?? []) {
      capabilities.set(`flat:delete:${resource}`, { kind: 'flat', mode: 'delete', resource });
    }
  }

  return [...capabilities.values()];
}

function emitCapability(entry) {
  switch (entry.kind) {
  case 'flat':
    return emitCapabilityTrait(entry.mode, entry.resource);
  case 'slot':
    return emitStructuredSlotTrait(entry.op, entry.slot, entry.access);
  case 'closure':
    return [
      emitStructuredClosureEnum(entry.op, entry.closure),
      emitStructuredClosureTrait(entry.op, entry.closure)
    ].join('\n');
  case 'create-slot':
    return emitStructuredCreateSlotTrait(entry.op, entry.slot);
  case 'update':
    return emitStructuredUpdateTrait(entry.ir, entry.op, entry.update, entry.fieldName);
  default:
    return '';
  }
}

export function emitRewriteApi(ir) {
  const mutationOps = (ir.ops ?? []).filter((op) => op.kind === 'MUTATION' && op.footprint);
  if (!mutationOps.length) return null;

  const lines = [
    '// Generated by @wesley/generator-echo. Do not edit.',
    '// Proof-slice rewrite API: capability-bounded Rust authoring surface.',
    ''
  ];

  for (const capability of collectCapabilities(ir, mutationOps)) {
    lines.push(emitCapability(capability));
  }

  for (const op of mutationOps) {
    lines.push(emitArgsStruct(op));
    lines.push(emitContextTrait(op));
    lines.push(emitRewriteTrait(op));
  }

  return lines.join('\n');
}
