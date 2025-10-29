# Wesley Core Testing Strategy

This document outlines the comprehensive testing strategy for Wesley Core, implementing Wave 1 testing requirements (WP5.T001-T005) with 100% test coverage for critical paths.

## Test Organization

### Directory Structure

```
test/
├── unit/                    # Unit tests for individual modules
├── integration/            # Integration tests for component interaction  
├── property/              # Property-based tests using fast-check
├── snapshots/             # Snapshot tests for generated output
├── e2e/                   # End-to-end tests
├── helpers/               # Test utilities and helpers
│   ├── database.mjs       # Database testing utilities
│   └── property-testing.mjs # Property-based testing helpers
└── run-all-tests.mjs     # Comprehensive test runner
```

## Test Types

### 1. Unit Tests (`test/unit/`)

Tests individual modules and classes in isolation.

**Examples:**
- `migration-differ.test.mjs` - Tests migration diffing logic
- `operation-registry.test.mjs` - Tests RPC operation harvesting  
- `sql-generation-flags.test.mjs` - Tests SQL generation configuration

**Running:**
```bash
npm run test:unit
```

### 2. Integration Tests (`test/integration/`)

Tests interaction between components and end-to-end workflows.

**Test Files:**
- `migration-execution.test.mjs` - Migration execution end-to-end
- `migration-rollback.test.mjs` - Rollback functionality testing
- `migration-checkpoints.test.mjs` - Checkpoint recovery testing  
- `concurrent-migration-prevention.test.mjs` - Concurrent execution prevention
- `fk-ast-roundtrip.test.mjs` - Foreign key AST validation
- `rls-idempotency.test.mjs` - RLS policy idempotency

**Running:**
```bash
npm run test:integration
```

### 3. Property-Based Tests (`test/property/`)

Uses fast-check for property-based testing to find edge cases.

**Test Files:**
- `ddl-planner-idempotency.test.mjs` - Tests DDL generation idempotency
- `migration-lock-levels.test.mjs` - Tests PostgreSQL lock level correctness

**Key Properties Tested:**
- DDL generation idempotency (same input → same output)
- Migration determinism (consistent results)
- Type mapping consistency 
- Lock level correctness for PostgreSQL operations
- Schema semantic preservation

**Running:**
```bash
npm run test:property
```

### 4. Snapshot Tests (`test/snapshots/`)

Validates generated output against golden snapshots using Node.js built-in test runner.

**Test Files:**
- `sql-generation-enhanced.test.mjs` - Comprehensive SQL generation snapshots
- `typescript-generation.test.mjs` - TypeScript interface generation snapshots
- `zod-generation.test.mjs` - Zod validation schema snapshots

**Features:**
- Node.js native snapshot testing (no external dependencies)
- Automatic snapshot creation and updating
- Cross-platform line ending normalization
- Detailed diff reporting on mismatches

**Running:**
```bash
# Run snapshot tests
npm run test:snapshots

# Update snapshots (when output intentionally changes)
npm run test:snapshots:update
```

### 5. End-to-End Tests (`test/e2e/`)

Tests complete user workflows from GraphQL schema to deployed database.

**Running:**
```bash
npm run test:e2e
```

## Test Utilities

### Database Testing (`test/helpers/database.mjs`)

Provides utilities for database testing:

- **MockDatabase**: In-memory database mock implementing real database interface
- **testDatabaseConfig**: Configuration for test database connections  
- **createTestSchema()**: Creates isolated test schemas
- **testSQL**: Common SQL utilities for setup/teardown
- **testFixtures**: Pre-built schema fixtures for common patterns
- **dbAssert**: Assertion helpers for database state verification

**Example Usage:**
```javascript
import { MockDatabase, testFixtures, dbAssert } from '../helpers/database.mjs';

const db = new MockDatabase();
db.mockResult('create table', { rowCount: 0 });

await db.query('CREATE TABLE users (id uuid PRIMARY KEY)');
await dbAssert.tableExists(db, 'users');
```

### Property Testing (`test/helpers/property-testing.mjs`)

Provides generators and utilities for property-based testing:

- **graphQLGenerators**: Generators for GraphQL types, fields, directives
- **sqlGenerators**: Generators for SQL identifiers, types, constraints
- **schemaGenerators**: Generators for complete schema evolution scenarios
- **invariants**: Property testing predicates and invariants
- **wesleyArbitraries**: Custom arbitraries for Wesley domain objects
- **propertyHelpers**: Execution helpers for running property tests

**Example Usage:**
```javascript
import fc from 'fast-check';
import { wesleyArbitraries, propertyHelpers, invariants } from '../helpers/property-testing.mjs';

await propertyHelpers.runAsyncProperty(
  'ddl-idempotent',
  wesleyArbitraries.wesleySchema(),
  async (schemaData) => {
    const schema = createSchemaFromData(schemaData);
    return invariants.schemaIdempotent(schema, generator);
  }
);
```

## Test Runner

### Comprehensive Test Runner (`test/run-all-tests.mjs`)

Advanced test runner with support for:
- **Parallel/Sequential execution**: Run tests concurrently or in order
- **Selective suite execution**: Run specific test types
- **Coverage reporting**: Built-in Node.js coverage
- **Snapshot management**: Update snapshots automatically
- **Watch mode**: Continuous testing during development
- **Bail on failure**: Stop on first test failure

**Usage:**
```bash
# Run all tests (default: parallel)
npm test

# Run specific test suites
npm run test:unit
npm run test:integration  
npm run test:property

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Update snapshots
npm run test:snapshots:update

# Run sequentially (for debugging)
npm run test:sequential

# Stop on first failure
npm run test:bail
```

**Advanced Usage:**
```bash
# Run multiple suites in parallel
node test/run-all-tests.mjs unit property --parallel

# Run with coverage and update snapshots
node test/run-all-tests.mjs snapshots --coverage --update-snapshots

# Watch specific test types
node test/run-all-tests.mjs unit integration --watch
```

## Testing Principles

### 1. Test Behavior, Not Implementation

Tests validate **what** the code does, not **how** it does it:
- ✅ Test that DDL generation produces valid SQL
- ❌ Test that specific internal methods are called

### 2. Property-Based Testing for Edge Cases

Use fast-check to discover edge cases that unit tests might miss:
- Generate random GraphQL schemas and verify DDL idempotency
- Test migration lock level correctness across all PostgreSQL operations
- Validate type mapping consistency with random input combinations

### 3. Real Database Operations

When possible, test against real databases rather than mocks:
- Integration tests use actual PostgreSQL connections (when available)
- Mock databases implement the same interface as real connections
- Test helpers provide both mock and real database options

### 4. Snapshot Testing for Generated Code

Use snapshots to catch unintended changes in generated output:
- SQL DDL generation snapshots
- TypeScript interface generation snapshots
- Zod validation schema snapshots
- Automatic snapshot updates with `--update-snapshots`

### 5. 100% Critical Path Coverage

Ensure complete test coverage for critical functionality:
- Migration generation and execution
- DDL planning and SQL generation
- RLS policy creation and validation
- Type mapping and schema validation
- Lock level calculation and safety checks

## Configuration

### Environment Variables

- `NODE_ENV=test` - Set automatically by test runner
- `UPDATE_SNAPSHOTS=1` - Update snapshot files (use `--update-snapshots` flag)
- `TEST_DATABASE_URL` - Database connection for integration tests

### Test Timeouts

Different test types have appropriate timeouts:
- **Unit tests**: 5 seconds
- **Property tests**: 15 seconds  
- **Integration tests**: 30 seconds
- **Snapshot tests**: 10 seconds
- **E2E tests**: 60 seconds

## CI/CD Integration

### GitHub Actions

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:parallel
```

### Test Reports

The test runner supports multiple output formats:
- **Default**: Human-readable console output
- **TAP**: Use `--reporter=tap` for machine-readable output
- **Coverage**: Built-in Node.js coverage reports

## Debugging Tests

### Individual Test Execution

Run individual test files directly:
```bash
node --test test/unit/migration-differ.test.mjs
node --test test/property/ddl-planner-idempotency.test.mjs
```

### Debugging Property Tests

Generate specific test cases for debugging:
```javascript
import { propertyHelpers } from '../helpers/property-testing.mjs';

// Generate a failing example for debugging
const example = propertyHelpers.shrinkExample(
  wesleyArbitraries.wesleySchema(),
  (schema) => invariants.schemaIdempotent(schema, generator),
  42 // seed
);
```

### Snapshot Debugging

Compare snapshot differences:
```bash
# This will show detailed diffs when snapshots don't match
npm run test:snapshots

# Update snapshots after intentional changes
npm run test:snapshots:update
```

## Best Practices

### 1. Test Organization

- Group related tests in the same directory
- Use descriptive test names that explain the scenario
- Keep test files focused on a single module or feature

### 2. Test Data

- Use test fixtures for common scenarios
- Generate random data for property tests
- Isolate test data to prevent cross-test contamination

### 3. Async Testing

- Always await async operations in tests
- Use proper error handling in async tests
- Test both success and failure scenarios

### 4. Mock Usage

- Mock external dependencies (databases, APIs)
- Don't mock the code under test
- Verify mock interactions when relevant

### 5. Performance

- Keep unit tests fast (< 100ms each)
- Use parallel execution for independent tests
- Profile slow tests and optimize where possible

---

This comprehensive testing strategy ensures Wesley Core maintains high quality and reliability while supporting rapid development and refactoring.