/**
 * Zod Schema Generation Snapshot Tests
 * Tests Zod validation schema generation from GraphQL schemas
 */

import { test, describe } from 'node:test';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

// Enhanced Zod generator implementation
class ZodSchemaGenerator {
  constructor(options = {}) {
    this.options = {
      generateInputSchemas: true,
      generateOutputSchemas: true,
      strictMode: true,
      includeRefinements: true,
      generateTransforms: false,
      ...options
    };
  }

  async generate(schema) {
    const imports = [`import { z } from 'zod';`];
    const schemas = [];
    const inputSchemas = [];
    const refinements = [];

    for (const [tableName, table] of Object.entries(schema.tables)) {
      // Generate main entity schema
      const entitySchema = this.generateEntitySchema(table);
      schemas.push(entitySchema);

      if (this.options.generateInputSchemas) {
        // Generate input schemas for mutations
        const createInputSchema = this.generateCreateInputSchema(table);
        const updateInputSchema = this.generateUpdateInputSchema(table);
        inputSchemas.push(createInputSchema, updateInputSchema);
      }

      if (this.options.includeRefinements) {
        // Generate custom refinements based on directives
        const entityRefinements = this.generateRefinements(table);
        refinements.push(...entityRefinements);
      }
    }

    const allSchemas = [
      ...imports,
      '',
      '// Entity Schemas',
      ...schemas,
      '',
      '// Input Schemas', 
      ...inputSchemas,
      '',
      '// Refinements and Custom Validations',
      ...refinements
    ];

    return {
      combined: allSchemas.join('\n'),
      schemas: schemas.join('\n\n'),
      inputSchemas: inputSchemas.join('\n\n'),
      refinements: refinements.join('\n\n')
    };
  }

  generateEntitySchema(table) {
    const fields = Object.values(table.fields).map(field => {
      const zodType = this.mapFieldToZod(field);
      const fieldComment = this.generateFieldComment(field);
      
      return fieldComment ? 
        `  // ${fieldComment}\n  ${field.name}: ${zodType}` :
        `  ${field.name}: ${zodType}`;
    });

    return `export const ${table.name}Schema = z.object({
${fields.join(',\n')}
});

export type ${table.name} = z.infer<typeof ${table.name}Schema>;`;
  }

  generateCreateInputSchema(table) {
    const fields = Object.values(table.fields)
      .filter(field => !this.hasDirective(field, '@primaryKey') || this.hasDirective(field, '@default'))
      .map(field => {
        const zodType = this.mapFieldToZod(field, 'create');
        const fieldComment = this.generateFieldComment(field);
        
        return fieldComment ?
          `  // ${fieldComment}\n  ${field.name}: ${zodType}` :
          `  ${field.name}: ${zodType}`;
      });

    return `export const Create${table.name}Schema = z.object({
${fields.join(',\n')}
});

export type Create${table.name}Input = z.infer<typeof Create${table.name}Schema>;`;
  }

  generateUpdateInputSchema(table) {
    const fields = Object.values(table.fields)
      .filter(field => !this.hasDirective(field, '@primaryKey'))
      .map(field => {
        const zodType = this.mapFieldToZod(field, 'update');
        return `  ${field.name}: ${zodType}.optional()`;
      });

    return `export const Update${table.name}Schema = z.object({
${fields.join(',\n')}
});

export type Update${table.name}Input = z.infer<typeof Update${table.name}Schema>;`;
  }

  generateRefinements(table) {
    const refinements = [];

    // Generate unique field validations
    const uniqueFields = Object.values(table.fields)
      .filter(field => this.hasDirective(field, '@unique'));

    if (uniqueFields.length > 0) {
      const uniqueValidations = uniqueFields.map(field => {
        return `// Unique validation for ${field.name}
export const validate${table.name}${this.capitalize(field.name)}Unique = async (value: string) => {
  // Implementation would check database for uniqueness
  return true; // Placeholder
};`;
      });

      refinements.push(...uniqueValidations);
    }

    // Generate custom validations based on directives
    const sensitiveFields = Object.values(table.fields)
      .filter(field => this.hasDirective(field, '@sensitive'));

    if (sensitiveFields.length > 0) {
      refinements.push(`// Enhanced validation for ${table.name} sensitive fields
export const ${table.name}SensitiveDataSchema = ${table.name}Schema.refine(
  (data) => {
    // Add custom validation logic for sensitive fields
    ${sensitiveFields.map(f => `// Validate ${f.name} meets security requirements`).join('\n    ')}
    return true;
  },
  {
    message: "Sensitive data validation failed"
  }
);`);
    }

    return refinements;
  }

  mapFieldToZod(field, context = 'entity') {
    const baseType = this.mapTypeToZod(field.type, field.nonNull, field.itemNonNull);
    const validations = this.generateFieldValidations(field, context);
    
    return validations ? `${baseType}${validations}` : baseType;
  }

  mapTypeToZod(graphQLType, nonNull = false, itemNonNull = false) {
    // Handle array types
    if (graphQLType.startsWith('[') && graphQLType.endsWith(']')) {
      const innerType = graphQLType.slice(1, -1);
      const zodInnerType = this.mapScalarToZod(innerType);
      const itemType = itemNonNull ? zodInnerType : `${zodInnerType}.nullable()`;
      const arrayType = `z.array(${itemType})`;
      return nonNull ? arrayType : `${arrayType}.nullable()`;
    }

    // Handle scalar types
    const zodType = this.mapScalarToZod(graphQLType);
    return nonNull ? zodType : `${zodType}.nullable()`;
  }

  mapScalarToZod(graphQLType) {
    const typeMap = {
      'String': 'z.string()',
      'Int': 'z.number().int()',
      'BigInt': 'z.bigint()',
      'Float': 'z.number()',
      'Decimal': 'z.number()',
      'Boolean': 'z.boolean()',
      'ID': 'z.string()',
      'UUID': 'z.string().uuid()',
      'DateTime': 'z.date()',
      'Date': 'z.date()',
      'Time': 'z.date()',
      'JSON': 'z.record(z.unknown())',
      'Inet': 'z.string().ip()'
    };

    return typeMap[graphQLType] || 'z.unknown()';
  }

  generateFieldValidations(field, context) {
    const validations = [];

    // String validations
    if (field.type === 'String' || field.type === 'ID') {
      if (this.hasDirective(field, '@unique')) {
        validations.push('.min(1, "Required for unique field")');
      }
      
      // Email validation
      if (field.name.toLowerCase().includes('email')) {
        validations.push('.email("Invalid email format")');
      }

      // URL validation
      if (field.name.toLowerCase().includes('url') || field.name.toLowerCase().includes('website')) {
        validations.push('.url("Invalid URL format")');
      }

      // Min/max length based on field name patterns
      if (field.name.toLowerCase().includes('name')) {
        validations.push('.min(1, "Name cannot be empty").max(100, "Name too long")');
      }
      
      if (field.name.toLowerCase().includes('description') || field.name.toLowerCase().includes('content')) {
        validations.push('.max(10000, "Content too long")');
      }
    }

    // Numeric validations
    if (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal') {
      if (field.name.toLowerCase().includes('age')) {
        validations.push('.min(0, "Age cannot be negative").max(150, "Invalid age")');
      }
      
      if (field.name.toLowerCase().includes('price') || field.name.toLowerCase().includes('amount')) {
        validations.push('.min(0, "Price cannot be negative")');
      }
      
      if (field.name.toLowerCase().includes('count') || field.name.toLowerCase().includes('quantity')) {
        validations.push('.min(0, "Count cannot be negative")');
      }
    }

    // Date validations
    if (field.type === 'DateTime' || field.type === 'Date') {
      if (field.name.toLowerCase().includes('future') || field.name.toLowerCase().includes('end')) {
        validations.push('.min(new Date(), "Date must be in the future")');
      }
    }

    // Default value handling
    const defaultValue = this.getDirectiveArg(field, '@default', 'value');
    if (defaultValue && context === 'create') {
      validations.push(`.default(${defaultValue})`);
    }

    return validations.join('');
  }

  generateFieldComment(field) {
    const comments = [];
    
    if (this.hasDirective(field, '@sensitive')) {
      comments.push('Sensitive data - handle with care');
    }
    if (this.hasDirective(field, '@unique')) {
      comments.push('Must be unique');
    }
    if (this.hasDirective(field, '@index')) {
      comments.push('Database indexed');
    }

    const defaultValue = this.getDirectiveArg(field, '@default', 'value');
    if (defaultValue) {
      comments.push(`Default: ${defaultValue}`);
    }

    return comments.join(', ');
  }

  hasDirective(field, directiveName) {
    return field.directives && field.directives[directiveName] !== undefined;
  }

  getDirectiveArg(field, directiveName, argName) {
    return field.directives?.[directiveName]?.[argName];
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const snapshotsDir = join(__dirname, '__snapshots__');

// Ensure snapshots directory exists
if (!existsSync(snapshotsDir)) {
  mkdirSync(snapshotsDir, { recursive: true });
}

function toMatchSnapshot(actual, testName, snapshotName = 'default') {
  const fileName = `${testName}.${snapshotName}.snap`;
  const filePath = join(snapshotsDir, fileName);
  
  const normalizedActual = actual
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/gm, '')
    .trim();
  
  if (existsSync(filePath)) {
    const expectedContent = readFileSync(filePath, 'utf-8').trim();
    
    if (normalizedActual !== expectedContent) {
      if (process.env.UPDATE_SNAPSHOTS) {
        writeFileSync(filePath, normalizedActual + '\n');
        console.log(`Updated snapshot: ${fileName}`);
        return;
      }
      
      console.log('\nZod Snapshot mismatch:');
      console.log('Expected:');
      console.log(expectedContent);
      console.log('\nActual:');
      console.log(normalizedActual);
      
      throw new Error(`Snapshot mismatch for ${fileName}. Set UPDATE_SNAPSHOTS=1 to update.`);
    }
  } else {
    writeFileSync(filePath, normalizedActual + '\n');
    console.log(`Created new snapshot: ${fileName}`);
  }
}

describe('Zod Schema Generation Snapshots', () => {
  const generator = new ZodSchemaGenerator();

  test('basic-user-validation', async () => {
    const schema = new Schema({
      User: new Table({
        name: 'User',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          email: new Field({
            name: 'email',
            type: 'String',
            nonNull: true,
            directives: { '@unique': {} }
          }),
          name: new Field({
            name: 'name',
            type: 'String',
            nonNull: true
          }),
          age: new Field({
            name: 'age',
            type: 'Int',
            nonNull: false
          }),
          isActive: new Field({
            name: 'isActive',
            type: 'Boolean',
            nonNull: true,
            directives: { '@default': { value: 'true' } }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'basic-user-validation');
  });

  test('complex-product-schema', async () => {
    const schema = new Schema({
      Product: new Table({
        name: 'Product',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          name: new Field({
            name: 'name',
            type: 'String',
            nonNull: true
          }),
          description: new Field({
            name: 'description',
            type: 'String',
            nonNull: false
          }),
          price: new Field({
            name: 'price',
            type: 'Decimal',
            nonNull: true
          }),
          quantity: new Field({
            name: 'quantity',
            type: 'Int',
            nonNull: true,
            directives: { '@default': { value: '0' } }
          }),
          tags: new Field({
            name: 'tags',
            type: '[String]',
            nonNull: true,
            itemNonNull: false
          }),
          categoryIds: new Field({
            name: 'categoryIds',
            type: '[UUID]',
            nonNull: false,
            itemNonNull: true
          }),
          metadata: new Field({
            name: 'metadata',
            type: 'JSON',
            nonNull: false,
            directives: { '@default': { value: '{}' } }
          }),
          websiteUrl: new Field({
            name: 'websiteUrl',
            type: 'String',
            nonNull: false
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'complex-product-schema');
  });

  test('array-types-validation', async () => {
    const schema = new Schema({
      Collection: new Table({
        name: 'Collection',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          optionalStrings: new Field({
            name: 'optionalStrings',
            type: '[String]',
            nonNull: false,
            itemNonNull: false
          }),
          requiredStrings: new Field({
            name: 'requiredStrings',
            type: '[String]',
            nonNull: true,
            itemNonNull: true
          }),
          mixedNumbers: new Field({
            name: 'mixedNumbers',
            type: '[Int]',
            nonNull: true,
            itemNonNull: false
          }),
          uuidList: new Field({
            name: 'uuidList',
            type: '[UUID]',
            nonNull: false,
            itemNonNull: true
          }),
          dateList: new Field({
            name: 'dateList',
            type: '[DateTime]',
            nonNull: true,
            itemNonNull: true
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'array-types-validation');
  });

  test('sensitive-data-with-refinements', async () => {
    const schema = new Schema({
      UserProfile: new Table({
        name: 'UserProfile',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          email: new Field({
            name: 'email',
            type: 'String',
            nonNull: true,
            directives: { '@unique': {}, '@sensitive': {} }
          }),
          socialSecurityNumber: new Field({
            name: 'socialSecurityNumber',
            type: 'String',
            nonNull: false,
            directives: { '@sensitive': {} }
          }),
          creditCardNumber: new Field({
            name: 'creditCardNumber',
            type: 'String',
            nonNull: false,
            directives: { '@sensitive': {} }
          }),
          phoneNumber: new Field({
            name: 'phoneNumber',
            type: 'String',
            nonNull: false
          }),
          dateOfBirth: new Field({
            name: 'dateOfBirth',
            type: 'Date',
            nonNull: false,
            directives: { '@sensitive': {} }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'sensitive-data-with-refinements');
  });

  test('all-data-types', async () => {
    const schema = new Schema({
      DataTypeTest: new Table({
        name: 'DataTypeTest',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          stringField: new Field({
            name: 'stringField',
            type: 'String',
            nonNull: false
          }),
          intField: new Field({
            name: 'intField',
            type: 'Int',
            nonNull: false
          }),
          bigIntField: new Field({
            name: 'bigIntField',
            type: 'BigInt',
            nonNull: false
          }),
          floatField: new Field({
            name: 'floatField',
            type: 'Float',
            nonNull: false
          }),
          decimalField: new Field({
            name: 'decimalField',
            type: 'Decimal',
            nonNull: false
          }),
          booleanField: new Field({
            name: 'booleanField',
            type: 'Boolean',
            nonNull: false
          }),
          dateField: new Field({
            name: 'dateField',
            type: 'Date',
            nonNull: false
          }),
          timeField: new Field({
            name: 'timeField',
            type: 'Time',
            nonNull: false
          }),
          dateTimeField: new Field({
            name: 'dateTimeField',
            type: 'DateTime',
            nonNull: false
          }),
          jsonField: new Field({
            name: 'jsonField',
            type: 'JSON',
            nonNull: false
          }),
          inetField: new Field({
            name: 'inetField',
            type: 'Inet',
            nonNull: false
          }),
          idField: new Field({
            name: 'idField',
            type: 'ID',
            nonNull: false
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'all-data-types');
  });

  test('event-schema-with-future-dates', async () => {
    const schema = new Schema({
      Event: new Table({
        name: 'Event',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          name: new Field({
            name: 'name',
            type: 'String',
            nonNull: true
          }),
          startDate: new Field({
            name: 'startDate',
            type: 'DateTime',
            nonNull: true
          }),
          endDate: new Field({
            name: 'endDate',
            type: 'DateTime',
            nonNull: true
          }),
          futureEventDate: new Field({
            name: 'futureEventDate',
            type: 'DateTime',
            nonNull: false
          }),
          maxAttendees: new Field({
            name: 'maxAttendees',
            type: 'Int',
            nonNull: false
          }),
          ticketPrice: new Field({
            name: 'ticketPrice',
            type: 'Decimal',
            nonNull: false
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'event-schema-with-future-dates');
  });

  test('input-only-schemas', async () => {
    const generatorInputOnly = new ZodSchemaGenerator({
      generateInputSchemas: true,
      generateOutputSchemas: false,
      includeRefinements: false
    });

    const schema = new Schema({
      BlogPost: new Table({
        name: 'BlogPost',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          title: new Field({
            name: 'title',
            type: 'String',
            nonNull: true
          }),
          slug: new Field({
            name: 'slug',
            type: 'String',
            nonNull: true,
            directives: { '@unique': {} }
          }),
          content: new Field({
            name: 'content',
            type: 'String',
            nonNull: false
          }),
          publishedAt: new Field({
            name: 'publishedAt',
            type: 'DateTime',
            nonNull: false
          }),
          viewCount: new Field({
            name: 'viewCount',
            type: 'Int',
            nonNull: true,
            directives: { '@default': { value: '0' } }
          })
        }
      })
    });

    const result = await generatorInputOnly.generate(schema);
    toMatchSnapshot(result.combined, 'input-only-schemas');
  });
});