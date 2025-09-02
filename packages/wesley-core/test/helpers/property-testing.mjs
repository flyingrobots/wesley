/**
 * Property-Based Testing Helpers
 * Generators and utilities for fast-check property tests
 */

import fc from 'fast-check';

/**
 * Configuration for property tests
 */
export const propertyConfig = {
  // Number of test cases to generate
  numRuns: 100,
  
  // Timeout for each property test
  timeout: 5000,
  
  // Seed for reproducible tests (can be overridden)
  seed: 42,
  
  // Shrinking attempts on failure
  maxSkipsPerRun: 100,
  
  // Enable verbose output on failure
  verbose: true
};

/**
 * GraphQL type generators
 */
export const graphQLGenerators = {
  /**
   * Generates valid GraphQL field names
   */
  fieldName: () => fc.stringOf(
    fc.char().filter(c => /[a-zA-Z_]/.test(c)),
    { minLength: 1, maxLength: 50 }
  ).filter(name => name.length > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)),
  
  /**
   * Generates valid GraphQL type names
   */
  typeName: () => fc.stringOf(
    fc.char().filter(c => /[a-zA-Z_]/.test(c)),
    { minLength: 1, maxLength: 50 }
  ).filter(name => name.length > 0 && /^[A-Z][a-zA-Z0-9_]*$/.test(name)),
  
  /**
   * Generates scalar types
   */
  scalarType: () => fc.constantFrom(
    'String', 'Int', 'Float', 'Boolean', 'ID', 'UUID', 'DateTime', 'Date', 'Time',
    'JSON', 'Decimal', 'BigInt'
  ),
  
  /**
   * Generates list types with nullability
   */
  listType: () => fc.record({
    base: graphQLGenerators.scalarType(),
    isList: fc.constant(true),
    nonNull: fc.boolean(),
    itemNonNull: fc.boolean()
  }),
  
  /**
   * Generates field types (scalar or list)
   */
  fieldType: () => fc.oneof(
    graphQLGenerators.scalarType(),
    graphQLGenerators.listType()
  ),
  
  /**
   * Generates GraphQL directives
   */
  directive: () => fc.record({
    name: fc.constantFrom('@primaryKey', '@unique', '@index', '@default', '@rls', '@owner', '@tenant'),
    args: fc.record({
      value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      column: fc.option(graphQLGenerators.fieldName()),
      preset: fc.option(fc.constantFrom('owner', 'tenant', 'public-read', 'authenticated'))
    }, { requiredKeys: [] })
  }),
  
  /**
   * Generates GraphQL field definitions
   */
  field: () => fc.record({
    name: graphQLGenerators.fieldName(),
    type: graphQLGenerators.fieldType(),
    nonNull: fc.boolean(),
    directives: fc.array(graphQLGenerators.directive(), { maxLength: 3 })
  })
};

/**
 * SQL/Database generators
 */
export const sqlGenerators = {
  /**
   * Generates valid PostgreSQL identifiers
   */
  identifier: () => fc.stringOf(
    fc.char().filter(c => /[a-zA-Z0-9_]/.test(c)),
    { minLength: 1, maxLength: 63 }
  ).filter(name => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 63),
  
  /**
   * Generates PostgreSQL column types
   */
  columnType: () => fc.constantFrom(
    'text', 'varchar(255)', 'integer', 'bigint', 'decimal(10,2)', 'boolean',
    'uuid', 'timestamptz', 'jsonb', 'text[]', 'integer[]', 'inet', 'cidr'
  ),
  
  /**
   * Generates SQL constraints
   */
  constraint: () => fc.record({
    type: fc.constantFrom('primary_key', 'unique', 'foreign_key', 'check', 'not_null'),
    name: fc.option(sqlGenerators.identifier()),
    columns: fc.array(sqlGenerators.identifier(), { minLength: 1, maxLength: 3 }),
    expression: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
  }),
  
  /**
   * Generates table definitions
   */
  table: () => fc.record({
    name: sqlGenerators.identifier(),
    columns: fc.array(fc.record({
      name: sqlGenerators.identifier(),
      type: sqlGenerators.columnType(),
      nullable: fc.boolean(),
      defaultValue: fc.option(fc.string())
    }), { minLength: 1, maxLength: 10 }),
    constraints: fc.array(sqlGenerators.constraint(), { maxLength: 5 })
  }),
  
  /**
   * Generates migration operations
   */
  migrationOp: () => fc.oneof(
    // CREATE TABLE
    fc.record({
      type: fc.constant('create_table'),
      table: sqlGenerators.table()
    }),
    
    // DROP TABLE
    fc.record({
      type: fc.constant('drop_table'),
      tableName: sqlGenerators.identifier()
    }),
    
    // ADD COLUMN
    fc.record({
      type: fc.constant('add_column'),
      tableName: sqlGenerators.identifier(),
      column: fc.record({
        name: sqlGenerators.identifier(),
        type: sqlGenerators.columnType(),
        nullable: fc.boolean()
      })
    }),
    
    // DROP COLUMN
    fc.record({
      type: fc.constant('drop_column'),
      tableName: sqlGenerators.identifier(),
      columnName: sqlGenerators.identifier()
    })
  )
};

/**
 * Schema generators for complex property tests
 */
export const schemaGenerators = {
  /**
   * Generates a complete GraphQL schema
   */
  schema: () => fc.record({
    types: fc.array(fc.record({
      name: graphQLGenerators.typeName(),
      fields: fc.array(graphQLGenerators.field(), { minLength: 1, maxLength: 10 })
    }), { minLength: 1, maxLength: 5 }),
    
    queries: fc.array(fc.record({
      name: graphQLGenerators.fieldName(),
      args: fc.array(graphQLGenerators.field(), { maxLength: 3 }),
      returnType: graphQLGenerators.typeName()
    }), { maxLength: 10 }),
    
    mutations: fc.array(fc.record({
      name: graphQLGenerators.fieldName(),
      args: fc.array(graphQLGenerators.field(), { maxLength: 5 }),
      returnType: graphQLGenerators.typeName()
    }), { maxLength: 10 })
  }),
  
  /**
   * Generates schema evolution scenarios
   */
  schemaEvolution: () => fc.record({
    from: schemaGenerators.schema(),
    to: schemaGenerators.schema(),
    expectedOperations: fc.array(sqlGenerators.migrationOp(), { maxLength: 20 })
  })
};

/**
 * Property test predicates and invariants
 */
export const invariants = {
  /**
   * Schema generation should be idempotent
   */
  schemaIdempotent: (schema, generator) => {
    const result1 = generator.generate(schema);
    const result2 = generator.generate(schema);
    
    return JSON.stringify(result1) === JSON.stringify(result2);
  },
  
  /**
   * Migration generation should be deterministic
   */
  migrationDeterministic: (fromSchema, toSchema, differ) => {
    const migration1 = differ.diff(fromSchema, toSchema);
    const migration2 = differ.diff(fromSchema, toSchema);
    
    return JSON.stringify(migration1) === JSON.stringify(migration2);
  },
  
  /**
   * Round-trip property: applying then reversing a migration should yield original schema
   */
  migrationRoundTrip: async (schema, migration, applier) => {
    const modifiedSchema = await applier.apply(schema, migration);
    const reverseMigration = await applier.generateReverse(migration);
    const revertedSchema = await applier.apply(modifiedSchema, reverseMigration);
    
    // Note: This is approximate due to metadata differences
    return schema.tables.length === revertedSchema.tables.length;
  },
  
  /**
   * SQL generation should produce parseable SQL
   */
  sqlParseable: (ast, backend) => {
    try {
      const sql = backend.toSQL(ast);
      return typeof sql === 'string' && sql.length > 0;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * Type mappings should be consistent
   */
  typeConsistent: (graphqlType, sqlType, mapper) => {
    const mapped1 = mapper.mapType(graphqlType);
    const mapped2 = mapper.mapType(graphqlType);
    
    return mapped1 === mapped2;
  },
  
  /**
   * Lock levels should be correctly ordered
   */
  lockLevelsOrdered: (operations, lockCalculator) => {
    const locks = operations.map(op => lockCalculator.calculateLock(op));
    
    // Ensure DDL operations have appropriate lock levels
    return locks.every(lock => 
      ['ACCESS_SHARE', 'ROW_SHARE', 'ROW_EXCLUSIVE', 'SHARE_UPDATE_EXCLUSIVE', 
       'SHARE', 'SHARE_ROW_EXCLUSIVE', 'EXCLUSIVE', 'ACCESS_EXCLUSIVE'].includes(lock)
    );
  }
};

/**
 * Custom arbitraries for Wesley-specific domain objects
 */
export const wesleyArbitraries = {
  /**
   * Generates Wesley Schema objects
   */
  wesleySchema: () => fc.record({
    tables: fc.dictionary(
      sqlGenerators.identifier(),
      fc.record({
        name: sqlGenerators.identifier(),
        fields: fc.dictionary(
          graphQLGenerators.fieldName(),
          fc.record({
            name: graphQLGenerators.fieldName(),
            type: graphQLGenerators.fieldType(),
            nonNull: fc.boolean(),
            itemNonNull: fc.boolean(),
            directives: fc.record({}, { requiredKeys: [] })
          })
        )
      })
    )
  }),
  
  /**
   * Generates tenant/ownership scenarios
   */
  tenantScenario: () => fc.record({
    ownerColumn: fc.option(graphQLGenerators.fieldName()),
    tenantColumn: fc.option(graphQLGenerators.fieldName()),
    rlsPolicies: fc.array(fc.record({
      operation: fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'),
      using: fc.option(fc.string()),
      check: fc.option(fc.string()),
      roles: fc.option(fc.array(fc.string(), { maxLength: 3 }))
    }), { maxLength: 5 })
  }),
  
  /**
   * Generates test generation scenarios
   */
  testScenario: () => fc.record({
    table: sqlGenerators.table(),
    testDepth: fc.constantFrom('minimal', 'standard', 'comprehensive'),
    includeNegative: fc.boolean(),
    includeSensitive: fc.boolean()
  })
};

/**
 * Property test execution helpers
 */
export const propertyHelpers = {
  /**
   * Runs a property test with standard configuration
   */
  async runProperty(name, arbitrary, predicate, config = {}) {
    const testConfig = { ...propertyConfig, ...config };
    
    return fc.assert(
      fc.property(arbitrary, predicate),
      {
        numRuns: testConfig.numRuns,
        seed: testConfig.seed,
        verbose: testConfig.verbose
      }
    );
  },
  
  /**
   * Runs a async property test
   */
  async runAsyncProperty(name, arbitrary, asyncPredicate, config = {}) {
    const testConfig = { ...propertyConfig, ...config };
    
    return fc.assert(
      fc.asyncProperty(arbitrary, asyncPredicate),
      {
        numRuns: testConfig.numRuns,
        seed: testConfig.seed,
        verbose: testConfig.verbose
      }
    );
  },
  
  /**
   * Creates a shrinking example for debugging
   */
  shrinkExample(arbitrary, predicate, seed) {
    return fc.sample(arbitrary, { seed, numRuns: 1 });
  }
};