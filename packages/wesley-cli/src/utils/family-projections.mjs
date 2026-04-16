import { Kind, parse } from 'graphql';

const ROOT_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);
const BUILTIN_SCALARS = new Map([
  ['ID', { ts: 'string', zod: 'z.string()' }],
  ['String', { ts: 'string', zod: 'z.string()' }],
  ['Int', { ts: 'number', zod: 'z.number().int()' }],
  ['Float', { ts: 'number', zod: 'z.number()' }],
  ['Boolean', { ts: 'boolean', zod: 'z.boolean()' }],
  ['DateTime', { ts: 'string', zod: 'z.string()' }],
  ['Date', { ts: 'string', zod: 'z.string()' }],
  ['Time', { ts: 'string', zod: 'z.string()' }],
  ['Decimal', { ts: 'number', zod: 'z.number()' }],
  ['UUID', { ts: 'string', zod: 'z.string()' }],
  ['JSON', { ts: 'Record<string, unknown>', zod: 'z.unknown()' }],
  ['Hash', { ts: 'string', zod: 'z.string()' }]
]);

export function hasTableLikeIr(ir) {
  return Array.isArray(ir?.tables) && ir.tables.length > 0;
}

export function generateFamilyTypeScriptFromSDL(sdl) {
  const family = collectFamilyDefinitions(sdl);
  const sections = [];

  if (family.scalars.length > 0) {
    sections.push('// Scalars');
    for (const scalar of family.scalars) {
      sections.push(`export type ${scalar.name} = string;`);
    }
    sections.push('');
  }

  if (family.enums.length > 0) {
    sections.push('// Enums');
    for (const enumDef of family.enums) {
      const values = enumDef.values.map((value) => JSON.stringify(value)).join(' | ');
      sections.push(`export type ${enumDef.name} = ${values};`);
    }
    sections.push('');
  }

  const objectSections = renderTypeScriptObjectDefinitions(family.objects);
  if (objectSections.length > 0) {
    sections.push('// Object Types');
    sections.push(...objectSections);
    sections.push('');
  }

  const inputSections = renderTypeScriptObjectDefinitions(family.inputs);
  if (inputSections.length > 0) {
    sections.push('// Input Types');
    sections.push(...inputSections);
  }

  return sections.filter(Boolean).join('\n').trim();
}

export function generateFamilyZodFromSDL(sdl) {
  const family = collectFamilyDefinitions(sdl);
  const lines = ["import { z } from 'zod';", ''];

  if (family.scalars.length > 0) {
    lines.push('// Scalars');
    for (const scalar of family.scalars) {
      lines.push(`export const ${scalar.name}Schema = z.string();`);
      lines.push(`export type ${scalar.name} = z.infer<typeof ${scalar.name}Schema>;`);
      lines.push('');
    }
  }

  if (family.enums.length > 0) {
    lines.push('// Enums');
    for (const enumDef of family.enums) {
      const values = enumDef.values.map((value) => JSON.stringify(value)).join(', ');
      lines.push(`export const ${enumDef.name}Schema = z.enum([${values}]);`);
      lines.push(`export type ${enumDef.name} = z.infer<typeof ${enumDef.name}Schema>;`);
      lines.push('');
    }
  }

  const context = {
    scalarNames: new Set(family.scalars.map((scalar) => scalar.name)),
    enumNames: new Set(family.enums.map((enumDef) => enumDef.name)),
    objectNames: new Set(family.objects.map((object) => object.name)),
    inputNames: new Set(family.inputs.map((input) => input.name))
  };

  const objectSchemas = renderZodDefinitions(family.objects, context);
  if (objectSchemas.length > 0) {
    lines.push('// Object Types');
    lines.push(...objectSchemas);
    lines.push('');
  }

  const inputSchemas = renderZodDefinitions(family.inputs, context);
  if (inputSchemas.length > 0) {
    lines.push('// Input Types');
    lines.push(...inputSchemas);
  }

  return lines.join('\n').trim();
}

function collectFamilyDefinitions(sdl) {
  const document = parse(sdl, { noLocation: true });
  const scalars = [];
  const enums = [];
  const objects = [];
  const inputs = [];

  for (const definition of document.definitions) {
    switch (definition.kind) {
    case Kind.SCALAR_TYPE_DEFINITION:
      scalars.push({ name: definition.name.value });
      break;
    case Kind.ENUM_TYPE_DEFINITION:
      enums.push({
        name: definition.name.value,
        values: (definition.values ?? []).map((value) => value.name.value)
      });
      break;
    case Kind.OBJECT_TYPE_DEFINITION:
      if (shouldSkipObjectDefinition(definition.name.value)) {
        break;
      }
      objects.push({
        name: definition.name.value,
        fields: (definition.fields ?? []).map((field) => ({
          name: field.name.value,
          type: field.type
        }))
      });
      break;
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      inputs.push({
        name: definition.name.value,
        fields: (definition.fields ?? []).map((field) => ({
          name: field.name.value,
          type: field.type
        }))
      });
      break;
    default:
      break;
    }
  }

  return { scalars, enums, objects, inputs };
}

function renderTypeScriptObjectDefinitions(definitions) {
  return definitions.flatMap((definition) => {
    const fields = definition.fields.map((field) => {
      const rendered = renderTypeScriptField(field.type);
      const propertyName = rendered.required ? field.name : `${field.name}?`;
      const propertyType = rendered.required
        ? rendered.type
        : `${rendered.type} | null`;
      return `  ${propertyName}: ${propertyType};`;
    });
    return [
      `export interface ${definition.name} {`,
      ...fields,
      '}',
      ''
    ];
  }).slice(0, -1);
}

function renderZodDefinitions(definitions, context) {
  return definitions.flatMap((definition) => {
    const fields = definition.fields.map((field) => {
      const rendered = renderZodField(field.type, context);
      const propertyType = rendered.required
        ? rendered.expr
        : `${rendered.expr}.nullable().optional()`;
      return `  ${field.name}: ${propertyType}`;
    });
    return [
      `export const ${definition.name}Schema = z.object({`,
      fields.join(',\n'),
      '});',
      `export type ${definition.name} = z.infer<typeof ${definition.name}Schema>;`,
      ''
    ];
  }).slice(0, -1);
}

function renderTypeScriptField(typeNode) {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    const inner = renderTypeScriptField(typeNode.type);
    return { ...inner, required: true };
  }

  if (typeNode.kind === Kind.LIST_TYPE) {
    const inner = renderTypeScriptField(typeNode.type);
    const itemType = inner.required ? inner.type : `${inner.type} | null`;
    return { type: `Array<${itemType}>`, required: false };
  }

  return {
    type: mapNamedTypeToTypeScript(typeNode.name.value),
    required: false
  };
}

function renderZodField(typeNode, context) {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    const inner = renderZodField(typeNode.type, context);
    return { ...inner, required: true };
  }

  if (typeNode.kind === Kind.LIST_TYPE) {
    const inner = renderZodField(typeNode.type, context);
    const itemType = inner.required ? inner.expr : `${inner.expr}.nullable()`;
    return { expr: `z.array(${itemType})`, required: false };
  }

  return {
    expr: mapNamedTypeToZod(typeNode.name.value, context),
    required: false
  };
}

function mapNamedTypeToTypeScript(name) {
  return BUILTIN_SCALARS.get(name)?.ts ?? name;
}

function mapNamedTypeToZod(name, context) {
  const builtin = BUILTIN_SCALARS.get(name);
  if (builtin) {
    return builtin.zod;
  }
  if (context.scalarNames.has(name) || context.enumNames.has(name)) {
    return `${name}Schema`;
  }
  if (context.objectNames.has(name) || context.inputNames.has(name)) {
    return `z.lazy(() => ${name}Schema)`;
  }
  return 'z.unknown()';
}

function shouldSkipObjectDefinition(name) {
  return ROOT_TYPE_NAMES.has(name) || name.endsWith('Invariants');
}
