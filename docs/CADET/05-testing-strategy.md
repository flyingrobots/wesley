# Testing Strategy

## Overview

Comprehensive testing strategy for Wesley combining property-based testing, snapshot testing, integration testing, and performance benchmarking to ensure production quality.

## Testing Pyramid

```mermaid
graph TD
    subgraph "Testing Levels"
        E2E[End-to-End Tests<br/>5%]
        INT[Integration Tests<br/>20%]
        UNIT[Unit Tests<br/>75%]
    end
    
    subgraph "Testing Types"
        PROP[Property-Based]
        SNAP[Snapshot]
        PERF[Performance]
        SEC[Security]
    end
    
    E2E --> REAL[Real Database]
    INT --> MOCK[Test Database]
    UNIT --> STUB[Mocked Dependencies]
    
    PROP --> GEN[Generators]
    SNAP --> GOLD[Golden Files]
    PERF --> BENCH[Benchmarks]
    SEC --> FUZZ[Fuzzing]
```

## Testing Approaches

### Unit Testing

#### Test Structure

```javascript
// Standard unit test structure
describe('DDLPlanner', () => {
  let planner;
  let mockClassifier;
  let mockAnalyzer;
  
  beforeEach(() => {
    mockClassifier = {
      classify: jest.fn()
    };
    mockAnalyzer = {
      analyze: jest.fn()
    };
    
    planner = new DDLPlanner({
      classifier: mockClassifier,
      analyzer: mockAnalyzer
    });
  });
  
  describe('planOperation', () => {
    it('should classify operations by lock level', () => {
      // Arrange
      const operation = {
        type: 'CREATE_INDEX',
        table: 'users',
        columns: ['email']
      };
      mockClassifier.classify.mockReturnValue('SHARE');
      
      // Act
      const result = planner.planOperation(operation);
      
      // Assert
      expect(mockClassifier.classify).toHaveBeenCalledWith(operation);
      expect(result.lockLevel).toBe('SHARE');
    });
    
    it('should rewrite unsafe operations', () => {
      // Arrange
      const operation = {
        type: 'CREATE_INDEX',
        table: 'users',
        columns: ['email']
      };
      
      // Act
      const result = planner.planOperation(operation);
      
      // Assert
      expect(result.type).toBe('CREATE_INDEX_CONCURRENTLY');
      expect(result.phase).toBe('non_transactional');
    });
    
    it('should handle partitioned tables specially', () => {
      // Arrange
      const operation = {
        type: 'CREATE_INDEX',
        table: { name: 'events', isPartitioned: true },
        columns: ['created_at']
      };
      
      // Act
      const result = planner.planOperation(operation);
      
      // Assert
      expect(result).toHaveLength(5); // Parent + 2 partitions + 2 attachments
      expect(result[0].only).toBe(true);
    });
  });
});
```

#### Test Coverage Requirements

```javascript
// Coverage configuration (vitest.config.js)
export default {
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
      include: ['src/**/*.mjs'],
      exclude: [
        'src/**/*.test.mjs',
        'src/**/*.spec.mjs',
        'src/cli/**'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
};
```

### Property-Based Testing

#### Schema Generation

```javascript
import fc from 'fast-check';

// GraphQL type generators
const graphqlTypeArb = fc.oneof(
  fc.constant('String'),
  fc.constant('Int'),
  fc.constant('Float'),
  fc.constant('Boolean'),
  fc.constant('ID'),
  fc.constant('DateTime'),
  fc.constant('JSON')
);

const fieldArb = fc.record({
  name: fc.stringMatching(/^[a-z][a-zA-Z0-9_]*$/),
  type: graphqlTypeArb,
  nullable: fc.boolean(),
  list: fc.boolean(),
  directives: fc.array(
    fc.record({
      name: fc.constantFrom('@unique', '@index', '@default'),
      args: fc.dictionary(fc.string(), fc.jsonValue())
    }),
    { maxLength: 3 }
  )
});

const tableArb = fc.record({
  name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
  fields: fc.array(fieldArb, { minLength: 1, maxLength: 20 }),
  directives: fc.array(
    fc.constantFrom('@table', '@tenant', '@rls'),
    { maxLength: 3 }
  )
});

const schemaArb = fc.array(tableArb, { minLength: 1, maxLength: 50 });

// Property tests
describe('Schema Compilation Properties', () => {
  it('should always produce valid SQL', () => {
    fc.assert(
      fc.property(schemaArb, (schema) => {
        // Compile schema
        const compiled = compiler.compile(schema);
        
        // Parse generated SQL
        const parsed = sqlParser.parse(compiled.sql);
        
        // Should parse without errors
        expect(parsed.error).toBeUndefined();
        
        // Should have same number of tables
        expect(parsed.tables).toHaveLength(schema.length);
      }),
      { numRuns: 1000 }
    );
  });
  
  it('should maintain referential integrity', () => {
    fc.assert(
      fc.property(schemaArb, (schema) => {
        const compiled = compiler.compile(schema);
        
        // All foreign keys should reference existing tables
        for (const fk of compiled.foreignKeys) {
          expect(compiled.tables).toContainEqual(
            expect.objectContaining({ name: fk.referencedTable })
          );
        }
      })
    );
  });
  
  it('should be idempotent', () => {
    fc.assert(
      fc.property(schemaArb, (schema) => {
        const first = compiler.compile(schema);
        const second = compiler.compile(schema);
        
        expect(first).toEqual(second);
      })
    );
  });
  
  it('should handle circular references', () => {
    fc.assert(
      fc.property(
        fc.array(tableArb, { minLength: 2, maxLength: 5 }),
        (tables) => {
          // Add circular references
          tables[0].fields.push({
            name: 'ref',
            type: tables[1].name,
            directives: [{ name: '@relation' }]
          });
          tables[1].fields.push({
            name: 'backref',
            type: tables[0].name,
            directives: [{ name: '@relation' }]
          });
          
          // Should compile without stack overflow
          const compiled = compiler.compile({ tables });
          expect(compiled).toBeDefined();
          
          // Should use DEFERRABLE constraints
          const circularFKs = compiled.foreignKeys.filter(
            fk => fk.deferrable
          );
          expect(circularFKs.length).toBeGreaterThan(0);
        }
      )
    );
  });
});
```

#### Shrinking Examples

```javascript
// Custom shrinker for failed cases
const shrinkSchema = (schema) => {
  return fc.shrinkArray(
    schema,
    (table) => shrinkTable(table)
  );
};

const shrinkTable = (table) => {
  return [
    // Try removing fields
    ...table.fields.slice(1).map((_, i) => ({
      ...table,
      fields: table.fields.filter((_, j) => j !== i)
    })),
    // Try removing directives
    ...table.directives.slice(1).map((_, i) => ({
      ...table,
      directives: table.directives.filter((_, j) => j !== i)
    })),
    // Try simplifying field types
    ...table.fields.map((field, i) => ({
      ...table,
      fields: table.fields.map((f, j) => 
        j === i ? { ...f, type: 'String', directives: [] } : f
      )
    }))
  ];
};

// Use custom shrinker
fc.configureGlobal({
  shrink: true,
  shrinkPath: true,
  numRuns: 1000,
  seed: Date.now(),
  reporter: (runDetails) => {
    if (runDetails.failed) {
      console.log('Minimal failing case:', runDetails.counterexample);
    }
  }
});
```

### Snapshot Testing

#### SQL Generation Snapshots

```javascript
import { expect, test } from 'vitest';

describe('SQL Generation Snapshots', () => {
  test('simple table', () => {
    const schema = {
      tables: [{
        name: 'users',
        fields: [
          { name: 'id', type: 'ID', nullable: false },
          { name: 'email', type: 'String', nullable: false },
          { name: 'created_at', type: 'DateTime', nullable: false }
        ]
      }]
    };
    
    const sql = generator.generate(schema);
    expect(sql).toMatchSnapshot();
  });
  
  test('table with indexes', () => {
    const schema = {
      tables: [{
        name: 'users',
        fields: [
          { name: 'id', type: 'ID', nullable: false },
          { name: 'email', type: 'String', nullable: false, directives: [{ name: '@unique' }] },
          { name: 'org_id', type: 'ID', nullable: false, directives: [{ name: '@index' }] }
        ]
      }]
    };
    
    const sql = generator.generate(schema);
    expect(sql).toMatchInlineSnapshot(`
      "CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        org_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users(email);
      CREATE INDEX CONCURRENTLY idx_users_org_id ON users(org_id);"
    `);
  });
  
  test('migration with safety patterns', () => {
    const migration = {
      operations: [
        { type: 'ADD_COLUMN', table: 'users', column: 'age', dataType: 'INTEGER' },
        { type: 'ADD_FOREIGN_KEY', table: 'posts', column: 'user_id', references: 'users(id)' },
        { type: 'CREATE_INDEX', table: 'posts', columns: ['created_at'] }
      ]
    };
    
    const sql = planner.plan(migration);
    expect(sql).toMatchSnapshot();
  });
});
```

#### TypeScript Generation Snapshots

```javascript
describe('TypeScript Generation Snapshots', () => {
  test('generates correct types', () => {
    const schema = parseGraphQL(`
      type User {
        id: ID!
        email: String!
        profile: Profile
        posts: [Post!]!
      }
      
      type Profile {
        bio: String
        avatar: String
      }
      
      type Post {
        id: ID!
        title: String!
        content: String!
        author: User!
      }
    `);
    
    const types = tsGenerator.generate(schema);
    expect(types).toMatchSnapshot();
  });
  
  test('handles custom scalars', () => {
    const schema = parseGraphQL(`
      scalar DateTime
      scalar JSON
      scalar UUID
      
      type Event {
        id: UUID!
        timestamp: DateTime!
        data: JSON!
      }
    `);
    
    const types = tsGenerator.generate(schema);
    expect(types).toMatchInlineSnapshot(`
      "export type UUID = string;
      export type DateTime = string;
      export type JSON = any;
      
      export interface Event {
        id: UUID;
        timestamp: DateTime;
        data: JSON;
      }"
    `);
  });
});
```

### Integration Testing

#### Database Integration Tests

```javascript
import { Client } from 'pg';
import { TestDatabase } from './helpers/test-database';

describe('Migration Integration', () => {
  let db;
  let client;
  
  beforeAll(async () => {
    db = await TestDatabase.create();
    client = new Client(db.connectionString);
    await client.connect();
  });
  
  afterAll(async () => {
    await client.end();
    await db.destroy();
  });
  
  beforeEach(async () => {
    await db.reset();
  });
  
  test('executes migration without blocking', async () => {
    // Start migration
    const migrationPromise = executor.execute({
      operations: [
        { type: 'CREATE_INDEX_CONCURRENTLY', table: 'users', columns: ['email'] }
      ]
    });
    
    // Verify reads still work
    const readResult = await client.query('SELECT * FROM users LIMIT 1');
    expect(readResult.rows).toBeDefined();
    
    // Verify writes still work
    const writeResult = await client.query(
      'INSERT INTO users (email) VALUES ($1) RETURNING id',
      ['test@example.com']
    );
    expect(writeResult.rows[0].id).toBeDefined();
    
    // Wait for migration
    await migrationPromise;
    
    // Verify index exists
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'users' AND indexname LIKE '%email%'
    `);
    expect(indexResult.rows).toHaveLength(1);
  });
  
  test('rolls back on error', async () => {
    // Start migration with error
    const migrationPromise = executor.execute({
      operations: [
        { type: 'ADD_COLUMN', table: 'users', column: 'age', dataType: 'INTEGER' },
        { type: 'INVALID_OPERATION' } // Will cause error
      ]
    });
    
    // Should reject
    await expect(migrationPromise).rejects.toThrow();
    
    // Verify rollback
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'age'
    `);
    expect(result.rows).toHaveLength(0);
  });
  
  test('checkpoint recovery works', async () => {
    // Execute partial migration
    const executor1 = new SQLExecutor({ checkpointInterval: 1 });
    
    await executor1.execute({
      operations: [
        { type: 'ADD_COLUMN', table: 'users', column: 'status', dataType: 'TEXT' }
      ]
    });
    
    // Simulate crash
    executor1.crash();
    
    // Create new executor and recover
    const executor2 = new SQLExecutor();
    await executor2.recover();
    
    // Continue migration
    await executor2.execute({
      operations: [
        { type: 'ADD_INDEX', table: 'users', columns: ['status'] }
      ]
    });
    
    // Verify both operations completed
    const columnResult = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'status'
    `);
    expect(columnResult.rows).toHaveLength(1);
    
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'users' AND indexname LIKE '%status%'
    `);
    expect(indexResult.rows).toHaveLength(1);
  });
});
```

#### End-to-End Tests

```javascript
describe('End-to-End Workflows', () => {
  test('complete development workflow', async () => {
    // Initialize project
    await cli.run(['init', '--template', 'basic']);
    
    // Create schema
    await fs.writeFile('schema/schema.graphql', `
      type User @table {
        id: ID! @primaryKey
        email: String! @unique
        posts: [Post!]! @relation
      }
      
      type Post @table {
        id: ID! @primaryKey
        title: String!
        author: User! @relation
      }
    `);
    
    // Compile schema
    const compileResult = await cli.run(['compile']);
    expect(compileResult.exitCode).toBe(0);
    
    // Generate migration
    const generateResult = await cli.run(['migrate', 'generate', 'initial']);
    expect(generateResult.exitCode).toBe(0);
    
    // Execute migration
    const executeResult = await cli.run(['migrate', 'execute', '--yes']);
    expect(executeResult.exitCode).toBe(0);
    
    // Verify no drift
    const driftResult = await cli.run(['drift', 'detect']);
    expect(driftResult.exitCode).toBe(0);
    
    // Run tests
    const testResult = await cli.run(['test', 'run']);
    expect(testResult.exitCode).toBe(0);
  });
  
  test('production deployment workflow', async () => {
    // Validate schema
    const validateResult = await cli.run(['validate', '--strict']);
    expect(validateResult.exitCode).toBe(0);
    
    // Explain migration
    const explainResult = await cli.run(['explain', '--estimate']);
    expect(explainResult.output).toContain('Lock Impact');
    expect(explainResult.output).toContain('Estimated Duration');
    
    // Dry run
    const dryRunResult = await cli.run(['migrate', 'execute', '--dry-run']);
    expect(dryRunResult.exitCode).toBe(0);
    expect(dryRunResult.output).toContain('-- DRY RUN');
    
    // Execute with safety
    const executeResult = await cli.run([
      'migrate', 'execute',
      '--checkpoint',
      '--timeout', '60',
      '--yes'
    ]);
    expect(executeResult.exitCode).toBe(0);
    
    // Verify success
    const statusResult = await cli.run(['migrate', 'status']);
    expect(statusResult.output).toContain('All migrations applied');
  });
});
```

### Performance Testing

#### Benchmark Suite

```javascript
import { bench, describe } from 'vitest';

describe('Performance Benchmarks', () => {
  bench('compile 100 tables', async () => {
    const schema = generateLargeSchema(100);
    await compiler.compile(schema);
  });
  
  bench('compile 1000 tables', async () => {
    const schema = generateLargeSchema(1000);
    await compiler.compile(schema);
  });
  
  bench('plan migration with 100 operations', async () => {
    const operations = generateOperations(100);
    await planner.plan(operations);
  });
  
  bench('generate TypeScript for 50 types', async () => {
    const schema = generateSchemaWithTypes(50);
    await tsGenerator.generate(schema);
  });
  
  bench('parse 10MB SQL file', async () => {
    const sql = generateLargeSQL(10 * 1024 * 1024);
    await sqlParser.parse(sql);
  });
  
  bench('checkpoint save/restore', async () => {
    const state = generateLargeState();
    const checkpoint = await checkpointManager.save(state);
    await checkpointManager.load(checkpoint.id);
  });
});

// Performance assertions
describe('Performance Requirements', () => {
  test('compilation under 1 second for 100 tables', async () => {
    const schema = generateLargeSchema(100);
    
    const start = performance.now();
    await compiler.compile(schema);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
  
  test('streaming handles 1GB schema', async () => {
    const schema = generateGiantSchema(1024 * 1024 * 1024);
    const stream = new SQLStreamGenerator();
    
    let memoryPeak = 0;
    const interval = setInterval(() => {
      const usage = process.memoryUsage().heapUsed;
      memoryPeak = Math.max(memoryPeak, usage);
    }, 10);
    
    await stream.generate(schema);
    clearInterval(interval);
    
    // Should not load entire schema in memory
    expect(memoryPeak).toBeLessThan(200 * 1024 * 1024); // < 200MB
  });
  
  test('watch mode responds within 200ms', async () => {
    const watcher = new SchemaWatcher();
    await watcher.start();
    
    const changePromise = new Promise(resolve => {
      watcher.on('compiled', resolve);
    });
    
    const start = performance.now();
    await fs.writeFile('schema/test.graphql', 'type Test { id: ID! }');
    await changePromise;
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(200);
    
    await watcher.stop();
  });
});
```

### Security Testing

#### SQL Injection Prevention

```javascript
describe('SQL Injection Prevention', () => {
  test('sanitizes table names', () => {
    const malicious = [
      'users; DROP TABLE users; --',
      'users`; DROP TABLE users; --',
      "users'; DROP TABLE users; --",
      'users"); DROP TABLE users; --'
    ];
    
    for (const name of malicious) {
      const result = generator.generateTable({ name, fields: [] });
      
      // Should escape or reject
      expect(result).not.toContain('DROP');
      expect(result).not.toContain(';');
    }
  });
  
  test('parameterizes all values', () => {
    const operation = {
      type: 'INSERT',
      table: 'users',
      values: {
        email: "admin'; DROP TABLE users; --"
      }
    };
    
    const { sql, params } = generator.generateInsert(operation);
    
    // SQL should use placeholders
    expect(sql).toContain('$1');
    expect(sql).not.toContain('DROP');
    
    // Values should be in params
    expect(params[0]).toContain('DROP TABLE');
  });
  
  test('validates directive arguments', () => {
    const schema = `
      type User @table {
        id: ID! @default(expr: "'; DROP TABLE users; --")
      }
    `;
    
    expect(() => {
      parser.parse(schema);
    }).toThrow('Invalid default expression');
  });
});
```

#### Fuzzing

```javascript
import { fuzzSync } from 'jest-fuzzer';

describe('Fuzz Testing', () => {
  test('parser handles malformed input', () => {
    fuzzSync((data) => {
      try {
        parser.parse(data);
      } catch (e) {
        // Should throw ParseError, not crash
        expect(e).toBeInstanceOf(ParseError);
      }
    }, {
      runs: 10000,
      maxLength: 1000
    });
  });
  
  test('SQL generator handles random schemas', () => {
    fuzzSync((data) => {
      try {
        const schema = JSON.parse(data);
        generator.generate(schema);
      } catch (e) {
        // Should handle gracefully
        expect(e.message).toBeDefined();
      }
    }, {
      runs: 10000
    });
  });
});
```

## Test Infrastructure

### Test Database Management

```javascript
class TestDatabase {
  static async create() {
    const id = uuidv4();
    const dbName = `test_${id.replace(/-/g, '_')}`;
    
    // Create test database
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'postgres'
    });
    
    await client.connect();
    await client.query(`CREATE DATABASE ${dbName}`);
    await client.end();
    
    return new TestDatabase(dbName);
  }
  
  constructor(dbName) {
    this.dbName = dbName;
    this.connectionString = `postgresql://localhost/${dbName}`;
  }
  
  async reset() {
    const client = new Client(this.connectionString);
    await client.connect();
    
    // Drop all tables
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);
    
    // Run baseline schema
    const baseline = await fs.readFile('test/fixtures/baseline.sql', 'utf8');
    await client.query(baseline);
    
    await client.end();
  }
  
  async destroy() {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'postgres'
    });
    
    await client.connect();
    
    // Terminate connections
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${this.dbName}' AND pid <> pg_backend_pid()
    `);
    
    // Drop database
    await client.query(`DROP DATABASE ${this.dbName}`);
    await client.end();
  }
}
```

### Test Fixtures

```javascript
// test/fixtures/schemas.js
export const simpleSchema = `
  type User @table {
    id: ID! @primaryKey
    email: String! @unique
  }
`;

export const complexSchema = `
  type Organization @table @tenant {
    id: ID! @primaryKey
    name: String!
    users: [User!]! @relation
  }
  
  type User @table @rls {
    id: ID! @primaryKey
    email: String! @unique
    org: Organization! @relation
    profile: Profile @relation
    posts: [Post!]! @relation
  }
  
  type Profile @table {
    id: ID! @primaryKey
    user: User! @relation
    bio: String
  }
  
  type Post @table {
    id: ID! @primaryKey
    author: User! @relation
    title: String! @index
    content: String!
    published: Boolean! @default(value: false)
    created_at: DateTime! @default(expr: "NOW()")
  }
`;

export const generateLargeSchema = (tableCount) => {
  const tables = [];
  for (let i = 0; i < tableCount; i++) {
    tables.push(`
      type Table${i} @table {
        id: ID! @primaryKey
        field1: String
        field2: Int
        field3: Boolean
        field4: DateTime
        created_at: DateTime! @default(expr: "NOW()")
      }
    `);
  }
  return tables.join('\n');
};
```

## Continuous Integration

### CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 21]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:property
        env:
          FAST_CHECK_NUM_RUNS: 10000

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:performance
      - uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'vitest'
          output-file-path: benchmark-results.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true
```

## Test Commands

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --grep '^(?!.*\\[integration\\])(?!.*\\[e2e\\])'",
    "test:integration": "vitest run --grep '\\[integration\\]'",
    "test:e2e": "vitest run --grep '\\[e2e\\]'",
    "test:property": "vitest run --grep '\\[property\\]'",
    "test:snapshot": "vitest run -u",
    "test:performance": "vitest bench",
    "test:security": "npm audit && vitest run --grep '\\[security\\]'"
  }
}
```

---

**[← Back to Resource Management](./04-resource-management.md)** | **[↑ Back to README](./README.md)**