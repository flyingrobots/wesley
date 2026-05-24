const BUILTIN_TYPES = new Set([
  'ID',
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Date',
  'Time',
  'Decimal',
  'UUID',
  'JSON',
  'Inet',
  'CIDR',
  'MacAddr'
]);

const TYPESCRIPT_TYPE_MAP = Object.freeze({
  ID: 'string',
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  DateTime: 'string',
  Date: 'string',
  Time: 'string',
  Decimal: 'number',
  UUID: 'string',
  JSON: 'Record<string, any>',
  Inet: 'string',
  CIDR: 'string',
  MacAddr: 'string'
});

const ZOD_TYPE_MAP = Object.freeze({
  ID: 'z.string().uuid()',
  String: 'z.string()',
  Int: 'z.number().int()',
  Float: 'z.number()',
  Boolean: 'z.boolean()',
  DateTime: 'z.string().datetime()',
  Date: 'z.string().date()',
  Time: 'z.string().time()',
  Decimal: 'z.number()',
  UUID: 'z.string().uuid()',
  JSON: 'z.record(z.any())',
  Inet: 'z.string().ip()',
  CIDR: 'z.string()',
  MacAddr: 'z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)',
  BigInt: 'z.bigint()',
  Bytes: 'z.unknown()'
});

export function generateTableTypeScript(schema) {
  const interfaces = [];
  const types = [];

  for (const table of schema.getTables()) {
    interfaces.push(generateInterface(table));

    const createType = generateCreateType(table);
    const updateType = generateUpdateType(table);

    if (createType) types.push(createType);
    if (updateType) types.push(updateType);
  }

  const sections = [];
  if (interfaces.length > 0) {
    sections.push('// Table Interfaces', ...interfaces, '');
  }
  if (types.length > 0) {
    sections.push('// Create/Update Types', ...types);
  }

  return sections.join('\n').trim();
}

export function generateTableZod(schema) {
  const schemas = [];

  for (const table of schema.getTables()) {
    const schemaName = `${table.name}Schema`;
    const fields = table
      .getFields()
      .filter((field) => !field.isVirtual())
      .map((field) => `  ${field.name}: ${generateZodField(field)}`);

    schemas.push(`export const ${schemaName} = z.object({
${fields.join(',\n')}
});`);
    schemas.push(`export type ${table.name} = z.infer<typeof ${schemaName}>;`);

    const createSchema = generateCreateSchema(table);
    const updateSchema = generateUpdateSchema(table);

    if (createSchema) {
      schemas.push(createSchema);
      schemas.push(`export type ${table.name}Create = z.infer<typeof ${table.name}CreateSchema>;`);
    }

    if (updateSchema) {
      schemas.push(updateSchema);
      schemas.push(`export type ${table.name}Update = z.infer<typeof ${table.name}UpdateSchema>;`);
    }
  }

  return `import { z } from 'zod';

${generateZodHelpers()}

${schemas.join('\n\n')}`.trim();
}

function generateInterface(table) {
  const fields = table
    .getFields()
    .map((field) =>
      field.isVirtual() ? generateRelationField(field) : generateTypeScriptField(field)
    )
    .filter(Boolean);

  return `export interface ${table.name} {
${fields.map((field) => `  ${field}`).join('\n')}
}`;
}

function generateTypeScriptField(field) {
  let type = typeScriptTypeFor(field);

  if (field.list) {
    type = field.itemNonNull ? `${type}[]` : `(${type} | null)[]`;
  }

  const isOptional = !field.nonNull;
  const name = isOptional ? `${field.name}?` : field.name;

  if (!field.nonNull && !field.list) {
    type = `${type} | null`;
  }

  return `${name}: ${type};`;
}

function generateRelationField(field) {
  const hasMany = field.directives['@hasMany'];
  const hasOne = field.directives['@hasOne'];

  if (hasMany) {
    const targetType = hasMany.target || field.type;
    return `${field.name}?: ${targetType}[];`;
  }

  if (hasOne) {
    const targetType = hasOne.target || field.type;
    const isOptional = !field.nonNull;
    const name = isOptional ? `${field.name}?` : field.name;
    return `${name}: ${targetType}${isOptional ? ' | null' : ''};`;
  }

  return null;
}

function typeScriptTypeFor(field) {
  if (!BUILTIN_TYPES.has(field.type)) {
    return field.type;
  }
  return TYPESCRIPT_TYPE_MAP[field.type] || 'unknown';
}

function generateCreateType(table) {
  const fields = table
    .getFields()
    .filter((field) => !field.isVirtual())
    .filter((field) => !(field.isPrimaryKey() && field.directives?.['@default']))
    .filter((field) => field.name !== 'createdAt' && field.name !== 'updatedAt')
    .map(generateTypeScriptField);

  if (fields.length === 0) return null;

  return `export interface ${table.name}Create {
${fields.map((field) => `  ${field}`).join('\n')}
}`;
}

function generateUpdateType(table) {
  const fields = table
    .getFields()
    .filter((field) => !field.isVirtual())
    .filter((field) => !field.isPrimaryKey())
    .filter((field) => field.name !== 'createdAt')
    .map((field) => `  ${field.name}?: ${typeScriptUpdateTypeFor(field)};`);

  if (fields.length === 0) return null;

  return `export interface ${table.name}Update {
${fields.join('\n')}
}`;
}

function typeScriptUpdateTypeFor(field) {
  let type = typeScriptTypeFor(field);

  if (field.list) {
    type = field.itemNonNull ? `${type}[]` : `(${type} | null)[]`;
  }

  return `${type} | null`;
}

function generateZodHelpers() {
  return `// Helper functions
export const parseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

export const safeParseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): z.SafeParseReturnType<unknown, T> => {
  return schema.safeParse(data);
};

export const validateCreate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(\`Validation failed: \${result.error.message}\`);
  }
  return result.data;
};

export const validateUpdate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(\`Validation failed: \${result.error.message}\`);
  }
  return result.data;
};`;
}

function generateZodField(field) {
  let schema = baseZodTypeFor(field);

  if (field.list) {
    schema = field.itemNonNull ? `z.array(${schema})` : `z.array(${schema}.nullable())`;
  }

  schema = applyDirectiveValidators(schema, field);

  if (!field.nonNull) {
    schema = `${schema}.optional()`;
  }

  const defaultDirective = field.directives?.['@default'];
  const defaultValue = defaultDirective?.value ?? defaultDirective?.expr;
  if (defaultValue && !String(defaultValue).includes('()')) {
    schema = `${schema}.default(${JSON.stringify(defaultValue)})`;
  }

  return schema;
}

function baseZodTypeFor(field) {
  if (ZOD_TYPE_MAP[field.type]) {
    return ZOD_TYPE_MAP[field.type];
  }
  if (isEnumLikeType(field.type)) {
    return `z.enum(['${field.type}'])`;
  }
  return 'z.unknown()';
}

function isEnumLikeType(type) {
  return type && type[0] === type[0].toUpperCase() && !BUILTIN_TYPES.has(type);
}

function applyDirectiveValidators(schema, field) {
  const directives = field.directives || {};

  if (directives['@email']) {
    schema = schema.replace('z.string()', 'z.string().email()');
  }

  if (directives['@min']) {
    const min = directives['@min'].value;
    if (field.type === 'String') schema = schema.replace('z.string()', `z.string().min(${min})`);
    if (field.type === 'Int' || field.type === 'Float') schema += `.min(${min})`;
  }

  if (directives['@max']) {
    const max = directives['@max'].value;
    if (field.type === 'String') schema = schema.replace('z.string()', `z.string().max(${max})`);
    if (field.type === 'Int' || field.type === 'Float') schema += `.max(${max})`;
  }

  if (directives['@pattern']) {
    const pattern = directives['@pattern'].value;
    schema = schema.replace('z.string()', `z.string().regex(/${pattern}/)`);
  }

  return schema;
}

function generateCreateSchema(table) {
  const fields = table
    .getFields()
    .filter((field) => !field.isVirtual())
    .filter((field) => !(field.isPrimaryKey() && field.directives?.['@default']))
    .filter((field) => field.name !== 'createdAt' && field.name !== 'updatedAt')
    .map((field) => `  ${field.name}: ${generateZodField(field)}`);

  if (fields.length === 0) return null;

  return `export const ${table.name}CreateSchema = z.object({
${fields.join(',\n')}
});`;
}

function generateUpdateSchema(table) {
  const fields = table
    .getFields()
    .filter((field) => !field.isVirtual())
    .filter((field) => !field.isPrimaryKey())
    .filter((field) => field.name !== 'createdAt')
    .map((field) => {
      let zodField = generateZodField(field);
      if (!zodField.includes('.optional()')) {
        zodField = `${zodField}.optional()`;
      }
      return `  ${field.name}: ${zodField}`;
    });

  if (fields.length === 0) return null;

  return `export const ${table.name}UpdateSchema = z.object({
${fields.join(',\n')}
});`;
}
