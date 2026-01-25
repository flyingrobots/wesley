import { z } from 'zod';

function zLiteralEnum(values) {
  return z.enum(values);
}

function zTypeForField(t, enumMap) {
  if (enumMap.has(t)) return enumMap.get(t);
  switch (t) {
    case 'Boolean': return z.boolean();
    case 'String': return z.string();
    case 'Int': return z.number().int();
    case 'Float': return z.number();
    case 'ID': return z.string();
    default: return z.any();
  }
}

export function emitSchemas(ir) {
  const enums = new Map();
  const enumValues = new Map(); // Store raw enum values for emission
  for (const t of ir.types ?? []) {
    if (t.kind === 'ENUM') {
      const values = t.values ?? [];
      enums.set(t.name, zLiteralEnum(values));
      enumValues.set(t.name, values);
    }
  }

  const objects = new Map();
  for (const t of ir.types ?? []) {
    if (t.kind === 'OBJECT') {
      const shape = {};
      for (const f of t.fields ?? []) {
        let zt = zTypeForField(f.type, enums);
        if (f.list) zt = z.array(zt);
        if (!f.required) zt = zt.optional();
        shape[f.name] = zt;
      }
      objects.set(t.name, z.object(shape).strict());
    }
  }

  const lines = [];
  lines.push('// AUTO-GENERATED. DO NOT EDIT.');
  lines.push('import { z } from "zod";');

  // Enums
  for (const [name] of enums) {
    lines.push(`export const ${name}Enum = z.enum(${JSON.stringify(enumValues.get(name))});`);
  }

  // Objects
  for (const [name, _schema] of objects) {
    const t = (ir.types ?? []).find((x) => x.name === name);
    const fields = t?.fields ?? [];
    const body = fields.map((f) => {
      let zref = zTypeForField(f.type, enums);
      if (f.list) zref = z.array(zref);
      if (!f.required) zref = zref.optional();
      return `  ${JSON.stringify(f.name)}: ${zref.toString()}`;
    });
    // Fallback: if z.toString() is not helpful, emit simple JSON string placeholders.
    const props = fields.map((f) => {
      let ref = f.type;
      // Build the inner type schema
      let innerSchema = ref === 'String' ? 'z.string()' : ref === 'Boolean' ? 'z.boolean()' : ref === 'Int' ? 'z.number().int()' : ref === 'Float' ? 'z.number()' : enums.has(ref) ? `${ref}Enum` : 'z.any()';
      // Wrap with z.array() only for list fields
      let zcall = f.list ? `z.array(${innerSchema})` : innerSchema;
      // Append .optional() if not required
      if (!f.required) zcall += '.optional()';
      return `  ${f.name}: ${zcall}`;
    }).join(',\n');
    lines.push(`export const ${name}Schema = z.object({\n${props}\n}).strict();`);
  }

  // Exports of op var/result schemas (wired later when ops know var/result types)
  lines.push('// TODO: per-op var/result schemas wired from ops.catalog');

  return lines.join('\n');
}
