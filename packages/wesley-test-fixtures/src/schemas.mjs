/**
 * Shared GraphQL Schema Builders
 *
 * Parameterized builders for common Wesley test schemas.
 * Replaces the ~5,000 lines of inline schema definitions scattered
 * across test files with a single source of truth.
 *
 * Usage:
 *   import { schemas } from '@wesley/test-fixtures';
 *   const sdl = schemas.simpleUser();
 *   const sdl = schemas.ecommerce({ withRLS: true });
 */

/**
 * Minimal User type — the "hello world" of Wesley schemas.
 * @param {{ withRLS?: boolean, withTimestamps?: boolean }} [opts]
 */
export function simpleUser(opts = {}) {
  const { withRLS = false, withTimestamps = false } = opts;

  const timestamps = withTimestamps
    ? '\n  createdAt: DateTime! @default(value: "now()")\n  updatedAt: DateTime! @default(value: "now()")'
    : '';
  const rls = withRLS ? ' @rls(preset: "owner")' : '';

  return `type User @table${rls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  email: String! @unique
  name: String!${timestamps}
}

type Query {
  getUser(id: ID!): User
}`;
}

/**
 * User + Profile (one-to-one foreign key relationship).
 * @param {{ withRLS?: boolean }} [opts]
 */
export function userWithProfile(opts = {}) {
  const { withRLS = false } = opts;
  const rls = withRLS ? ' @rls(preset: "owner")' : '';

  return `type User @table${rls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  email: String! @unique
  name: String!
}

type Profile @table${rls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  userId: ID! @fk(table: "User", column: "id") @unique
  bio: String
  avatarUrl: String
}

type Query {
  getUser(id: ID!): User
  getProfile(userId: ID!): Profile
}`;
}

/**
 * Multi-tenant Organization + Members schema.
 * @param {{ withRLS?: boolean }} [opts]
 */
export function multiTenant(opts = {}) {
  const { withRLS = true } = opts;
  const orgRls = withRLS ? ' @rls(preset: "owner")' : '';
  const memberRls = withRLS ? ' @rls(preset: "tenant")' : '';

  return `type Organization @table${orgRls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  name: String!
  ownerId: ID!
  createdAt: DateTime! @default(value: "now()")
}

type Member @table @tenant(field: "orgId")${memberRls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  orgId: ID! @fk(table: "Organization", column: "id")
  userId: ID! @fk(table: "User", column: "id")
  role: String! @default(value: "'member'")
}

type User @table {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  email: String! @unique
  name: String!
}

type Query {
  getOrganization(id: ID!): Organization
  getMembers(orgId: ID!): [Member!]!
}`;
}

/**
 * E-commerce schema (Product, Order, LineItem).
 * @param {{ withRLS?: boolean, withIndexes?: boolean }} [opts]
 */
export function ecommerce(opts = {}) {
  const { withRLS = false, withIndexes = true } = opts;
  const rls = withRLS ? ' @rls(preset: "owner")' : '';
  const statusIndex = withIndexes ? ' @index' : '';

  return `type Product @table {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  name: String!
  price: Float!
  status: String!${statusIndex} @default(value: "'draft'")
  tags: [String!]
  metadata: JSON
  createdAt: DateTime! @default(value: "now()")
}

type Order @table${rls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  userId: ID! @fk(table: "User", column: "id")
  status: String!${statusIndex} @default(value: "'pending'")
  total: Float!
  createdAt: DateTime! @default(value: "now()")
}

type LineItem @table {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  orderId: ID! @fk(table: "Order", column: "id")
  productId: ID! @fk(table: "Product", column: "id")
  quantity: Int!
  unitPrice: Float!
}

type User @table${rls} {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  email: String! @unique
  name: String!
}

type Query {
  getProduct(id: ID!): Product
  getOrder(id: ID!): Order
}`;
}

/**
 * Schema covering all supported scalar types — for type-mapping tests.
 */
export function allDataTypes() {
  return `type AllTypes @table {
  id: ID! @primaryKey @default(value: "gen_random_uuid()")
  textField: String!
  intField: Int!
  floatField: Float!
  boolField: Boolean!
  dateTime: DateTime!
  date: Date
  time: Time
  uuid: UUID
  jsonField: JSON
  decimalField: Decimal
  bigIntField: BigInt
  stringList: [String!]!
  intList: [Int!]
  nullableList: [String]
}

type Query {
  getAllTypes(id: ID!): AllTypes
}`;
}

/**
 * Minimal empty schema — for testing "no tables" edge case.
 */
export function empty() {
  return `type Query {
  health: String
}`;
}

/**
 * Schema with foreign key cycle for cycle-detection tests.
 */
export function circularForeignKeys() {
  return `type A @table {
  id: ID! @primaryKey
  bId: ID @fk(table: "B", column: "id")
}

type B @table {
  id: ID! @primaryKey
  cId: ID @fk(table: "C", column: "id")
}

type C @table {
  id: ID! @primaryKey
  aId: ID @fk(table: "A", column: "id")
}

type Query {
  getA(id: ID!): A
}`;
}

/**
 * All schema builders as a namespace object for convenient import.
 *
 * Usage:
 *   import { schemas } from '@wesley/test-fixtures';
 *   schemas.simpleUser({ withRLS: true });
 */
export const schemas = {
  simpleUser,
  userWithProfile,
  multiTenant,
  ecommerce,
  allDataTypes,
  empty,
  circularForeignKeys
};
