import { Kind, parse } from 'graphql';

const ROOT_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);
const ROOT_TYPE_METADATA = [
  { rootTypeName: 'Query', collectionName: 'queries', interfaceName: 'QueryOperationMap' },
  { rootTypeName: 'Mutation', collectionName: 'mutations', interfaceName: 'MutationOperationMap' },
  { rootTypeName: 'Subscription', collectionName: 'subscriptions', interfaceName: 'SubscriptionOperationMap' }
];
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
    sections.push('');
  }

  const operationSections = renderTypeScriptOperationDefinitions(family.operations);
  if (operationSections.length > 0) {
    sections.push('// Operations');
    sections.push(...operationSections);
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
    lines.push('');
  }

  const operationSchemas = renderZodOperationDefinitions(family.operations, context);
  if (operationSchemas.length > 0) {
    lines.push('// Operations');
    lines.push(...operationSchemas);
  }

  return lines.join('\n').trim();
}

function collectFamilyDefinitions(sdl) {
  const document = parse(sdl, { noLocation: true });
  const scalars = [];
  const enums = [];
  const objects = [];
  const inputs = [];
  const operations = {
    queries: [],
    mutations: [],
    subscriptions: []
  };

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
      if (ROOT_TYPE_NAMES.has(definition.name.value)) {
        collectRootOperations(definition.name.value, definition.fields ?? [], operations);
        break;
      }
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

  return { scalars, enums, objects, inputs, operations };
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

function renderTypeScriptOperationDefinitions(operations) {
  return ROOT_TYPE_METADATA.flatMap((metadata) => {
    const definitions = operations[metadata.collectionName];
    if (definitions.length === 0) {
      return [];
    }

    const sections = [];
    for (const definition of definitions) {
      sections.push(...renderTypeScriptOperationDefinition(metadata, definition));
      sections.push('');
    }

    sections.push(...renderTypeScriptOperationMap(metadata, definitions));
    return trimTrailingBlankLine(sections);
  }).filter((line) => line != null);
}

function renderTypeScriptOperationDefinition(metadata, definition) {
  const baseName = operationBaseName(metadata.rootTypeName, definition.name);
  const argsInterfaceName = `${baseName}Args`;
  const operationInterfaceName = `${baseName}Operation`;
  const resultType = renderTypeScriptOutputType(definition.type);
  const lines = [];

  lines.push(`export interface ${argsInterfaceName} {`);
  if (definition.args.length === 0) {
    lines.push('}');
  } else {
    for (const argument of definition.args) {
      const rendered = renderTypeScriptField(argument.type);
      const propertyName = rendered.required ? argument.name : `${argument.name}?`;
      const propertyType = rendered.required
        ? rendered.type
        : `${rendered.type} | null`;
      lines.push(`  ${propertyName}: ${propertyType};`);
    }
    lines.push('}');
  }

  lines.push(`export interface ${operationInterfaceName} {`);
  lines.push(`  operationName: ${JSON.stringify(definition.name)};`);
  lines.push(`  args: ${argsInterfaceName};`);
  if (hasSingleInputArgument(definition)) {
    lines.push(`  input: ${renderTypeScriptOutputType(definition.args[0].type)};`);
  }
  lines.push(`  result: ${resultType};`);
  lines.push('}');

  return lines;
}

function renderTypeScriptOperationMap(metadata, definitions) {
  const lines = [`export interface ${metadata.interfaceName} {`];

  for (const definition of definitions) {
    const operationInterfaceName = `${operationBaseName(metadata.rootTypeName, definition.name)}Operation`;
    lines.push(`  ${definition.name}: ${operationInterfaceName};`);
  }

  lines.push('}');
  lines.push(`export type ${metadata.rootTypeName}OperationName = keyof ${metadata.interfaceName};`);
  lines.push(`export type ${metadata.rootTypeName}Operation = ${metadata.interfaceName}[${metadata.rootTypeName}OperationName];`);
  return lines;
}

function renderZodOperationDefinitions(operations, context) {
  return ROOT_TYPE_METADATA.flatMap((metadata) => {
    const definitions = operations[metadata.collectionName];
    if (definitions.length === 0) {
      return [];
    }

    const sections = [];
    for (const definition of definitions) {
      sections.push(...renderZodOperationDefinition(metadata, definition, context));
      sections.push('');
    }

    sections.push(...renderZodOperationMap(metadata, definitions, context));
    return trimTrailingBlankLine(sections);
  }).filter((line) => line != null);
}

function renderZodOperationDefinition(metadata, definition, context) {
  const baseName = operationBaseName(metadata.rootTypeName, definition.name);
  const argsSchemaName = `${baseName}ArgsSchema`;
  const operationSchemaName = `${baseName}OperationSchema`;
  const operationTypeName = `${baseName}Operation`;
  const resultExpr = renderZodOutputType(definition.type, context);
  const lines = [];

  lines.push(`export const ${argsSchemaName} = z.object({`);
  if (definition.args.length === 0) {
    lines.push('});');
  } else {
    const args = definition.args.map((argument) => {
      const rendered = renderZodField(argument.type, context);
      const propertyType = rendered.required
        ? rendered.expr
        : `${rendered.expr}.nullable().optional()`;
      return `  ${argument.name}: ${propertyType}`;
    });
    lines.push(args.join(',\n'));
    lines.push('});');
  }
  lines.push(`export type ${baseName}Args = z.infer<typeof ${argsSchemaName}>;`);
  lines.push(`export const ${operationSchemaName} = z.object({`);
  lines.push(`  operationName: z.literal(${JSON.stringify(definition.name)}),`);
  lines.push(`  args: z.lazy(() => ${argsSchemaName}),`);
  lines.push(`  result: ${resultExpr}`);
  lines.push('});');
  lines.push(`export type ${operationTypeName} = z.infer<typeof ${operationSchemaName}>;`);

  return lines;
}

function renderZodOperationMap(metadata, definitions, context) {
  const schemaName = `${metadata.rootTypeName}OperationSchemas`;
  const lines = [`export const ${schemaName} = {`];

  for (const definition of definitions) {
    const baseName = operationBaseName(metadata.rootTypeName, definition.name);
    const argsSchemaName = `${baseName}ArgsSchema`;
    const operationSchemaName = `${baseName}OperationSchema`;
    const resultExpr = renderZodOutputType(definition.type, context);
    lines.push(`  ${definition.name}: {`);
    lines.push(`    args: ${argsSchemaName},`);
    if (hasSingleInputArgument(definition)) {
      lines.push(`    input: ${renderZodOutputType(definition.args[0].type, context)},`);
    }
    lines.push(`    result: ${resultExpr},`);
    lines.push(`    operation: ${operationSchemaName}`);
    lines.push('  },');
  }

  lines.push('} as const;');
  return lines;
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

function renderTypeScriptOutputType(typeNode) {
  const rendered = renderTypeScriptField(typeNode);
  return rendered.required ? rendered.type : `${rendered.type} | null`;
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

function renderZodOutputType(typeNode, context) {
  const rendered = renderZodField(typeNode, context);
  return rendered.required ? rendered.expr : `${rendered.expr}.nullable()`;
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

function collectRootOperations(rootTypeName, fields, operations) {
  const metadata = ROOT_TYPE_METADATA.find((entry) => entry.rootTypeName === rootTypeName);
  if (metadata == null) {
    return;
  }

  operations[metadata.collectionName] = fields.map((field) => ({
    name: field.name.value,
    type: field.type,
    args: (field.arguments ?? []).map((argument) => ({
      name: argument.name.value,
      type: argument.type
    }))
  }));
}

function operationBaseName(rootTypeName, fieldName) {
  return `${toPascalCase(fieldName)}${rootTypeName}`;
}

function toPascalCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function hasSingleInputArgument(definition) {
  return definition.args.length === 1 && definition.args[0].name === 'input';
}

function trimTrailingBlankLine(lines) {
  if (lines[lines.length - 1] === '') {
    return lines.slice(0, -1);
  }
  return lines;
}
