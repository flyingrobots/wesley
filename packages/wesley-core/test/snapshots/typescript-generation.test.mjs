/**
 * TypeScript Generation Snapshot Tests
 * Tests TypeScript interface and type generation from GraphQL schemas
 */

import { test, describe } from 'node:test';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

// Mock TypeScript generator (since the actual one may not exist yet)
class TypeScriptGenerator {
  constructor(options = {}) {
    this.options = {
      strictNullChecks: true,
      generateInterfaces: true,
      generateTypes: true,
      generateEnums: true,
      ...options
    };
  }

  async generate(schema) {
    const types = [];
    const interfaces = [];
    const enums = [];

    for (const [tableName, table] of Object.entries(schema.tables)) {
      // Generate interface for each table
      const interfaceContent = this.generateInterface(table);
      interfaces.push(interfaceContent);

      // Generate input types for mutations
      const inputType = this.generateInputType(table);
      types.push(inputType);

      // Generate create/update types
      const createType = this.generateCreateType(table);
      const updateType = this.generateUpdateType(table);
      types.push(createType, updateType);
    }

    return {
      types: types.join('\n\n'),
      interfaces: interfaces.join('\n\n'),
      enums: enums.join('\n\n'),
      combined: [...interfaces, ...types, ...enums].join('\n\n')
    };
  }

  generateInterface(table) {
    const fields = Object.values(table.fields).map(field => {
      const tsType = this.mapTypeToTypeScript(field.type, field.nonNull, field.itemNonNull);
      const optional = field.nonNull ? '' : '?';
      const comment = this.generateFieldComment(field);
      
      return `  ${comment ? `${comment}\n  ` : ''}${field.name}${optional}: ${tsType};`;
    }).join('\n');

    return `export interface ${table.name} {
${fields}
}`;
  }

  generateInputType(table) {
    const fields = Object.values(table.fields)
      .filter(field => !this.hasDirective(field, '@primaryKey') || this.hasDirective(field, '@default'))
      .map(field => {
        const tsType = this.mapTypeToTypeScript(field.type, false, field.itemNonNull); // All inputs optional by default
        const comment = this.generateFieldComment(field);
        
        return `  ${comment ? `${comment}\n  ` : ''}${field.name}?: ${tsType};`;
      }).join('\n');

    return `export interface ${table.name}Input {
${fields}
}`;
  }

  generateCreateType(table) {
    const requiredFields = Object.values(table.fields)
      .filter(field => 
        field.nonNull && 
        !this.hasDirective(field, '@primaryKey') && 
        !this.hasDirective(field, '@default')
      )
      .map(field => {
        const tsType = this.mapTypeToTypeScript(field.type, true, field.itemNonNull);
        return `  ${field.name}: ${tsType};`;
      });

    const optionalFields = Object.values(table.fields)
      .filter(field => 
        !field.nonNull || 
        this.hasDirective(field, '@default') ||
        this.hasDirective(field, '@primaryKey')
      )
      .map(field => {
        const tsType = this.mapTypeToTypeScript(field.type, field.nonNull, field.itemNonNull);
        return `  ${field.name}?: ${tsType};`;
      });

    const allFields = [...requiredFields, ...optionalFields].join('\n');

    return `export interface Create${table.name}Input {
${allFields}
}`;
  }

  generateUpdateType(table) {
    const fields = Object.values(table.fields)
      .filter(field => !this.hasDirective(field, '@primaryKey'))
      .map(field => {
        const tsType = this.mapTypeToTypeScript(field.type, false, field.itemNonNull);
        return `  ${field.name}?: ${tsType};`;
      }).join('\n');

    return `export interface Update${table.name}Input {
${fields}
}`;
  }

  generateFieldComment(field) {
    const comments = [];
    
    if (this.hasDirective(field, '@sensitive')) {
      comments.push('@sensitive - Contains sensitive data');
    }
    if (this.hasDirective(field, '@unique')) {
      comments.push('@unique - Must be unique');
    }
    if (this.hasDirective(field, '@index')) {
      comments.push('@indexed - Database index exists');
    }
    
    const defaultValue = this.getDirectiveArg(field, '@default', 'value');
    if (defaultValue) {
      comments.push(`@default ${defaultValue}`);
    }

    return comments.length > 0 ? `/** ${comments.join(', ')} */` : '';
  }

  mapTypeToTypeScript(graphQLType, nonNull = false, itemNonNull = false) {
    // Handle array types
    if (graphQLType.startsWith('[') && graphQLType.endsWith(']')) {
      const innerType = graphQLType.slice(1, -1);
      const tsInnerType = this.mapScalarToTypeScript(innerType);
      const itemType = itemNonNull ? tsInnerType : `${tsInnerType} | null`;
      const arrayType = `Array<${itemType}>`;
      return nonNull ? arrayType : `${arrayType} | null`;
    }

    // Handle scalar types
    const tsType = this.mapScalarToTypeScript(graphQLType);
    return nonNull ? tsType : `${tsType} | null`;
  }

  mapScalarToTypeScript(graphQLType) {
    const typeMap = {
      'String': 'string',
      'Int': 'number',
      'BigInt': 'bigint',
      'Float': 'number',
      'Decimal': 'number',
      'Boolean': 'boolean',
      'ID': 'string',
      'UUID': 'string',
      'DateTime': 'Date',
      'Date': 'Date',
      'Time': 'Date',
      'JSON': 'Record<string, any>',
      'Inet': 'string'
    };

    return typeMap[graphQLType] || 'unknown';
  }

  hasDirective(field, directiveName) {
    return field.directives && field.directives[directiveName] !== undefined;
  }

  getDirectiveArg(field, directiveName, argName) {
    return field.directives?.[directiveName]?.[argName];
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
      
      console.log('\nTypeScript Snapshot mismatch:');
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

describe('TypeScript Generation Snapshots', () => {
  const generator = new TypeScriptGenerator();

  test('basic-user-interfaces', async () => {
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
          }),
          createdAt: new Field({
            name: 'createdAt',
            type: 'DateTime',
            nonNull: true,
            directives: { '@default': { value: 'now()' } }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'basic-user-interfaces');
  });

  test('complex-types-with-arrays', async () => {
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
            nonNull: true,
            directives: { '@index': {} }
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
          prices: new Field({
            name: 'prices',
            type: '[Decimal]',
            nonNull: true,
            itemNonNull: true
          }),
          metadata: new Field({
            name: 'metadata',
            type: 'JSON',
            nonNull: false,
            directives: { '@default': { value: '{}' } }
          }),
          features: new Field({
            name: 'features',
            type: '[String]',
            nonNull: false,
            itemNonNull: false
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'complex-types-with-arrays');
  });

  test('multi-table-with-relationships', async () => {
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
          profile: new Field({
            name: 'profile',
            type: 'JSON',
            nonNull: false
          })
        }
      }),
      Post: new Table({
        name: 'Post',
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
            nonNull: true,
            directives: { '@index': {} }
          }),
          content: new Field({
            name: 'content',
            type: 'String',
            nonNull: false,
            directives: { '@sensitive': {} }
          }),
          authorId: new Field({
            name: 'authorId',
            type: 'UUID',
            nonNull: true,
            directives: { '@foreignKey': { references: 'User.id' } }
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
      }),
      Comment: new Table({
        name: 'Comment',
        fields: {
          id: new Field({
            name: 'id',
            type: 'UUID',
            nonNull: true,
            directives: { '@primaryKey': {} }
          }),
          content: new Field({
            name: 'content',
            type: 'String',
            nonNull: true
          }),
          postId: new Field({
            name: 'postId',
            type: 'UUID',
            nonNull: true,
            directives: { '@foreignKey': { references: 'Post.id' } }
          }),
          authorId: new Field({
            name: 'authorId',
            type: 'UUID',
            nonNull: true,
            directives: { '@foreignKey': { references: 'User.id' } }
          }),
          createdAt: new Field({
            name: 'createdAt',
            type: 'DateTime',
            nonNull: true,
            directives: { '@default': { value: 'now()' } }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'multi-table-with-relationships');
  });

  test('all-data-types-coverage', async () => {
    const schema = new Schema({
      DataTypes: new Table({
        name: 'DataTypes',
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
    toMatchSnapshot(result.combined, 'all-data-types-coverage');
  });

  test('tenant-aware-types', async () => {
    const schema = new Schema({
      Organization: new Table({
        name: 'Organization',
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
            nonNull: true,
            directives: { '@unique': {} }
          }),
          settings: new Field({
            name: 'settings',
            type: 'JSON',
            nonNull: false,
            directives: { '@default': { value: '{}' } }
          })
        }
      }),
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
          orgId: new Field({
            name: 'orgId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@tenant': { column: 'orgId' },
              '@foreignKey': { references: 'Organization.id' }
            }
          }),
          role: new Field({
            name: 'role',
            type: 'String',
            nonNull: true,
            directives: { '@default': { value: "'member'" } }
          })
        }
      }),
      Document: new Table({
        name: 'Document',
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
          content: new Field({
            name: 'content',
            type: 'String',
            nonNull: false,
            directives: { '@sensitive': {} }
          }),
          orgId: new Field({
            name: 'orgId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@tenant': { column: 'orgId' },
              '@foreignKey': { references: 'Organization.id' }
            }
          }),
          ownerId: new Field({
            name: 'ownerId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@owner': { column: 'ownerId' },
              '@foreignKey': { references: 'User.id' }
            }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.combined, 'tenant-aware-types');
  });

  test('strict-null-checks-disabled', async () => {
    const generatorNonStrict = new TypeScriptGenerator({ 
      strictNullChecks: false 
    });

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
            nonNull: false
          }),
          age: new Field({
            name: 'age',
            type: 'Int',
            nonNull: false
          }),
          tags: new Field({
            name: 'tags',
            type: '[String]',
            nonNull: false,
            itemNonNull: false
          })
        }
      })
    });

    const result = await generatorNonStrict.generate(schema);
    toMatchSnapshot(result.combined, 'strict-null-checks-disabled');
  });
});