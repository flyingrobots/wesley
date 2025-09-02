/**
 * Enhanced SQL Generation Snapshot Tests
 * Uses Node.js test runner snapshot functionality for comprehensive SQL testing
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const snapshotsDir = join(__dirname, '__snapshots__');

// Ensure snapshots directory exists
if (!existsSync(snapshotsDir)) {
  mkdirSync(snapshotsDir, { recursive: true });
}

/**
 * Snapshot testing utility for Node.js test runner
 */
function toMatchSnapshot(actual, testName, snapshotName = 'default') {
  const fileName = `${testName}.${snapshotName}.snap`;
  const filePath = join(snapshotsDir, fileName);
  
  // Normalize line endings and whitespace for consistent snapshots
  const normalizedActual = actual
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/gm, '') // Remove trailing whitespace
    .trim();
  
  if (existsSync(filePath)) {
    const expectedContent = readFileSync(filePath, 'utf-8').trim();
    
    if (normalizedActual !== expectedContent) {
      // Update snapshot if UPDATE_SNAPSHOTS env var is set
      if (process.env.UPDATE_SNAPSHOTS) {
        writeFileSync(filePath, normalizedActual + '\n');
        console.log(`Updated snapshot: ${fileName}`);
        return;
      }
      
      // Provide detailed diff information
      console.log('\nSnapshot mismatch:');
      console.log('Expected:');
      console.log(expectedContent);
      console.log('\nActual:');
      console.log(normalizedActual);
      
      throw new Error(`Snapshot mismatch for ${fileName}. Set UPDATE_SNAPSHOTS=1 to update.`);
    }
  } else {
    // Create new snapshot
    writeFileSync(filePath, normalizedActual + '\n');
    console.log(`Created new snapshot: ${fileName}`);
  }
}

describe('SQL Generation Snapshots', () => {
  const generator = new PostgreSQLGenerator();

  test('basic-table-with-constraints', async () => {
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
    toMatchSnapshot(result.sql, 'basic-table-with-constraints');
  });

  test('multi-table-with-foreign-keys', async () => {
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
            nonNull: true
          }),
          content: new Field({
            name: 'content',
            type: 'String',
            nonNull: false
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
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'multi-table-with-foreign-keys');
  });

  test('array-and-json-types', async () => {
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
          tags: new Field({
            name: 'tags',
            type: '[String]',
            nonNull: true,
            itemNonNull: false
          }),
          categories: new Field({
            name: 'categories',
            type: '[String]',
            nonNull: false,
            itemNonNull: true
          }),
          metadata: new Field({
            name: 'metadata',
            type: 'JSON',
            nonNull: false,
            directives: { '@default': { value: '{}' } }
          }),
          prices: new Field({
            name: 'prices',
            type: '[Decimal]',
            nonNull: true,
            itemNonNull: true
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'array-and-json-types');
  });

  test('rls-policies-and-security', async () => {
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
            nonNull: true
          }),
          ownerId: new Field({
            name: 'ownerId',
            type: 'UUID',
            nonNull: true,
            directives: { '@owner': { column: 'ownerId' } }
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
          createdBy: new Field({
            name: 'createdBy',
            type: 'UUID',
            nonNull: true,
            directives: { '@owner': { column: 'createdBy' } }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'rls-policies-and-security');
  });

  test('indexes-and-constraints', async () => {
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
            nonNull: true,
            directives: { '@index': {} }
          }),
          slug: new Field({
            name: 'slug',
            type: 'String',
            nonNull: true,
            directives: { '@unique': {}, '@index': {} }
          }),
          startDate: new Field({
            name: 'startDate',
            type: 'DateTime',
            nonNull: true,
            directives: { '@index': {} }
          }),
          endDate: new Field({
            name: 'endDate',
            type: 'DateTime',
            nonNull: true
          }),
          status: new Field({
            name: 'status',
            type: 'String',
            nonNull: true,
            directives: { 
              '@default': { value: "'draft'" },
              '@index': { where: "status = 'published'" }
            }
          }),
          categoryId: new Field({
            name: 'categoryId',
            type: 'UUID',
            nonNull: true,
            directives: { '@index': {} }
          }),
          organizerId: new Field({
            name: 'organizerId',
            type: 'UUID',
            nonNull: true,
            directives: { '@index': {} }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'indexes-and-constraints');
  });

  test('all-data-types', async () => {
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
          textField: new Field({
            name: 'textField',
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
          boolField: new Field({
            name: 'boolField',
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
          datetimeField: new Field({
            name: 'datetimeField',
            type: 'DateTime',
            nonNull: false
          }),
          jsonField: new Field({
            name: 'jsonField',
            type: 'JSON',
            nonNull: false
          }),
          uuidField: new Field({
            name: 'uuidField',
            type: 'UUID',
            nonNull: false
          }),
          inetField: new Field({
            name: 'inetField',
            type: 'Inet',
            nonNull: false
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'all-data-types');
  });

  test('complex-multi-tenant-schema', async () => {
    const schema = new Schema({
      Tenant: new Table({
        name: 'Tenant',
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
          plan: new Field({
            name: 'plan',
            type: 'String',
            nonNull: true,
            directives: { '@default': { value: "'free'" } }
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
          tenantId: new Field({
            name: 'tenantId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@tenant': { column: 'tenantId' },
              '@foreignKey': { references: 'Tenant.id' },
              '@index': {}
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
      Project: new Table({
        name: 'Project',
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
          tenantId: new Field({
            name: 'tenantId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@tenant': { column: 'tenantId' },
              '@foreignKey': { references: 'Tenant.id' },
              '@index': {}
            }
          }),
          ownerId: new Field({
            name: 'ownerId',
            type: 'UUID',
            nonNull: true,
            directives: { 
              '@owner': { column: 'ownerId' },
              '@foreignKey': { references: 'User.id' },
              '@index': {}
            }
          }),
          settings: new Field({
            name: 'settings',
            type: 'JSON',
            nonNull: false,
            directives: { '@default': { value: '{}' } }
          })
        }
      })
    });

    const result = await generator.generate(schema);
    toMatchSnapshot(result.sql, 'complex-multi-tenant-schema');
  });
});

// Helper test to validate snapshot functionality
test('snapshot-testing-utility-works', () => {
  const testContent = `SELECT * FROM users WHERE id = 1;
SELECT * FROM posts WHERE author_id = 1;`;
  
  // This should create a snapshot file
  toMatchSnapshot(testContent, 'snapshot-utility-test');
  
  // Second call should match the snapshot
  toMatchSnapshot(testContent, 'snapshot-utility-test');
});