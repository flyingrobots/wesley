/**
 * @wesley/test-fixtures
 *
 * Shared test fixtures, mocks, schema builders, and property-testing
 * utilities for the Wesley monorepo.
 */

export {
  testDatabaseConfig,
  createTestSchema,
  testSQL,
  MockDatabase,
  testFixtures,
  dbAssert
} from './database.mjs';

export {
  propertyConfig,
  graphQLGenerators,
  sqlGenerators,
  schemaGenerators,
  invariants,
  wesleyArbitraries,
  propertyHelpers
} from './property-testing.mjs';

export {
  schemas,
  simpleUser,
  userWithProfile,
  multiTenant,
  ecommerce,
  allDataTypes,
  empty,
  circularForeignKeys
} from './schemas.mjs';
