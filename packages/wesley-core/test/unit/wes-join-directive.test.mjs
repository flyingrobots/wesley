/**
 * @wes_join Directive Parsing and Validation Tests (E3.1)
 *
 * Tests the @wes_join directive for lattice/CRDT join strategies:
 *   - union: valid on list fields
 *   - max: valid on Int/Float fields
 *   - lww: valid on any field type
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { GraphQLSchemaBuilder } from '../../src/domain/GraphQLSchemaBuilder.mjs';
import { parse } from 'graphql';
import { validateJoinDirective, VALID_JOIN_STRATEGIES } from '../../src/domain/joinDirective.mjs';

/**
 * Helper: parse SDL and build Wesley schema (throws on validation error)
 */
function buildSchema(sdl) {
  const ast = parse(sdl);
  const builder = new GraphQLSchemaBuilder();
  return builder.buildFromAST(ast);
}

// ──────────────────────────────────────────────────
// Valid usages
// ──────────────────────────────────────────────────

test('@wes_join(strategy: "union") on list field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      players: [String!]! @wes_join(strategy: "union")
    }
  `);
  const field = schema.getTable('GameState').getField('players');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'union' });
});

test('@wes_join(strategy: "union") on nullable list field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      tags: [String] @wes_join(strategy: "union")
    }
  `);
  const field = schema.getTable('GameState').getField('tags');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'union' });
});

test('@wes_join(strategy: "max") on Int field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      maxScore: Int! @wes_join(strategy: "max")
    }
  `);
  const field = schema.getTable('GameState').getField('maxScore');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'max' });
});

test('@wes_join(strategy: "max") on Float field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      rating: Float @wes_join(strategy: "max")
    }
  `);
  const field = schema.getTable('GameState').getField('rating');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'max' });
});

test('@wes_join(strategy: "lww") on String field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      name: String @wes_join(strategy: "lww")
    }
  `);
  const field = schema.getTable('GameState').getField('name');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'lww' });
});

test('@wes_join(strategy: "lww") on list field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      items: [Int!]! @wes_join(strategy: "lww")
    }
  `);
  const field = schema.getTable('GameState').getField('items');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'lww' });
});

test('@wes_join(strategy: "lww") on Boolean field parses successfully', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      active: Boolean! @wes_join(strategy: "lww")
    }
  `);
  const field = schema.getTable('GameState').getField('active');
  assert.deepStrictEqual(field.getJoin(), { strategy: 'lww' });
});

// ──────────────────────────────────────────────────
// Invalid usages
// ──────────────────────────────────────────────────

test('@wes_join(strategy: "union") on scalar field throws error', () => {
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table {
        id: ID! @primaryKey
        maxScore: Int! @wes_join(strategy: "union")
      }
    `),
    (err) => {
      assert(err.message.includes('@wes_join(strategy: "union") requires a list field'));
      assert(err.message.includes('"maxScore"'));
      return true;
    }
  );
});

test('@wes_join(strategy: "max") on String field throws error', () => {
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table {
        id: ID! @primaryKey
        name: String! @wes_join(strategy: "max")
      }
    `),
    (err) => {
      assert(err.message.includes('@wes_join(strategy: "max") requires Int or Float'));
      assert(err.message.includes('"name"'));
      return true;
    }
  );
});

test('@wes_join(strategy: "max") on Boolean field throws error', () => {
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table {
        id: ID! @primaryKey
        active: Boolean! @wes_join(strategy: "max")
      }
    `),
    (err) => {
      assert(err.message.includes('@wes_join(strategy: "max") requires Int or Float'));
      assert(err.message.includes('"active"'));
      return true;
    }
  );
});

test('@wes_join(strategy: "max") on ID field throws error', () => {
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table {
        id: ID! @primaryKey @wes_join(strategy: "max")
      }
    `),
    (err) => {
      assert(err.message.includes('@wes_join(strategy: "max") requires Int or Float'));
      return true;
    }
  );
});

test('unknown @wes_join strategy throws error', () => {
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table {
        id: ID! @primaryKey
        name: String @wes_join(strategy: "merge")
      }
    `),
    (err) => {
      assert(err.message.includes('Unknown @wes_join strategy "merge"'));
      assert(err.message.includes('Valid: union, max, lww'));
      return true;
    }
  );
});

test('@wes_join on type definition throws error', () => {
  // The GraphQL parser for directives.graphql defines @wes_join on FIELD_DEFINITION only.
  // But the runtime builder must also reject it if somehow placed on a type.
  // We test by using the bare alias "join" which normalizes to @join.
  assert.throws(
    () =>
      buildSchema(`
      type GameState @table @wes_join(strategy: "union") {
        id: ID! @primaryKey
        name: String
      }
    `),
    (err) => {
      assert(err.message.includes('only valid on field definitions'));
      assert(err.message.includes('"GameState"'));
      return true;
    }
  );
});

// ──────────────────────────────────────────────────
// Multiple fields with different strategies
// ──────────────────────────────────────────────────

test('multiple fields with different @wes_join strategies on same type', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      players: [String!]! @wes_join(strategy: "union")
      maxScore: Int! @wes_join(strategy: "max")
      lastUpdate: String @wes_join(strategy: "lww")
    }
  `);
  const table = schema.getTable('GameState');
  assert.deepStrictEqual(table.getField('players').getJoin(), { strategy: 'union' });
  assert.deepStrictEqual(table.getField('maxScore').getJoin(), { strategy: 'max' });
  assert.deepStrictEqual(table.getField('lastUpdate').getJoin(), { strategy: 'lww' });
});

// ──────────────────────────────────────────────────
// Fields without @wes_join should have no join metadata
// ──────────────────────────────────────────────────

test('field without @wes_join returns null from getJoin()', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      name: String!
    }
  `);
  const field = schema.getTable('GameState').getField('name');
  assert.strictEqual(field.getJoin(), null);
});

// ──────────────────────────────────────────────────
// Canonical AST includes join directive
// ──────────────────────────────────────────────────

test('@wes_join appears in canonical AST', () => {
  const schema = buildSchema(`
    type GameState @table {
      id: ID! @primaryKey
      score: Int! @wes_join(strategy: "max")
    }
  `);
  const ast = schema.toAST();
  const scoreField = ast.tables[0].fields.find((f) => f.name === 'score');
  assert.ok(scoreField.directives['@join'], 'AST field should have @join directive');
  assert.strictEqual(scoreField.directives['@join'].strategy, 'max');
});

// ──────────────────────────────────────────────────
// Standalone validateJoinDirective unit tests
// ──────────────────────────────────────────────────

test('validateJoinDirective returns null for valid union on list', () => {
  const result = validateJoinDirective(
    { strategy: 'union' },
    { list: true, base: 'String' },
    'tags'
  );
  assert.strictEqual(result, null);
});

test('validateJoinDirective returns null for valid max on Int', () => {
  const result = validateJoinDirective({ strategy: 'max' }, { list: false, base: 'Int' }, 'score');
  assert.strictEqual(result, null);
});

test('validateJoinDirective returns null for valid max on Float', () => {
  const result = validateJoinDirective(
    { strategy: 'max' },
    { list: false, base: 'Float' },
    'rating'
  );
  assert.strictEqual(result, null);
});

test('validateJoinDirective returns null for lww on any type', () => {
  const result = validateJoinDirective(
    { strategy: 'lww' },
    { list: false, base: 'Boolean' },
    'flag'
  );
  assert.strictEqual(result, null);
});

test('validateJoinDirective returns error for unknown strategy', () => {
  const result = validateJoinDirective(
    { strategy: 'crdt' },
    { list: false, base: 'String' },
    'name'
  );
  assert.ok(result.includes('Unknown @wes_join strategy "crdt"'));
});

test('validateJoinDirective returns error for union on non-list', () => {
  const result = validateJoinDirective(
    { strategy: 'union' },
    { list: false, base: 'String' },
    'name'
  );
  assert.ok(result.includes('requires a list field'));
});

test('validateJoinDirective returns error for max on String', () => {
  const result = validateJoinDirective(
    { strategy: 'max' },
    { list: false, base: 'String' },
    'name'
  );
  assert.ok(result.includes('requires Int or Float'));
});

test('VALID_JOIN_STRATEGIES contains exactly union, max, lww', () => {
  assert.deepStrictEqual(VALID_JOIN_STRATEGIES, ['union', 'max', 'lww']);
});
