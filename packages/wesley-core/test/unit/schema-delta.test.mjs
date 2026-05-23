import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDelta } from '../../src/domain/schemaDelta.mjs';

// ─── helpers ────────────────────────────────────────────────────────

function emptyDelta() {
  return {
    added_types: [],
    removed_types: [],
    modified_types: [],
    added_ops: [],
    removed_ops: [],
    modified_ops: []
  };
}

// ─── 1. identical schemas → empty delta ─────────────────────────────

test('computeDelta: identical schemas produce empty delta', () => {
  const sdl = `
    type Query { hello: String }
    type User { id: ID! name: String }
  `;
  const delta = computeDelta(sdl, sdl);
  assert.deepStrictEqual(delta, emptyDelta());
});

// ─── 2. adding a new type → non-breaking ────────────────────────────

test('computeDelta: adding a new type is non-breaking', () => {
  const old = 'type Query { hello: String }';
  const nu = `
    type Query { hello: String }
    type User { id: ID! }
  `;
  const delta = computeDelta(old, nu);
  assert.equal(delta.added_types.length, 1);
  assert.equal(delta.added_types[0].name, 'User');
  assert.equal(delta.added_types[0].breaking, false);
  assert.ok(delta.added_types[0].description.includes('User'));
});

// ─── 3. removing a type → breaking ──────────────────────────────────

test('computeDelta: removing a type is breaking', () => {
  const old = `
    type Query { hello: String }
    type User { id: ID! }
  `;
  const nu = 'type Query { hello: String }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.removed_types.length, 1);
  assert.equal(delta.removed_types[0].name, 'User');
  assert.equal(delta.removed_types[0].breaking, true);
});

// ─── 4. adding an optional field → non-breaking ─────────────────────

test('computeDelta: adding an optional field is non-breaking', () => {
  const old = 'type User { id: ID! }';
  const nu = 'type User { id: ID! name: String }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, false);
  const fc = delta.modified_types[0].fieldChanges;
  assert.equal(fc.length, 1);
  assert.equal(fc[0].name, 'name');
  assert.equal(fc[0].breaking, false);
  assert.ok(fc[0].description.includes('Optional'));
});

// ─── 5. adding a required field → breaking ──────────────────────────

test('computeDelta: adding a required (non-nullable) field is breaking', () => {
  const old = 'type User { id: ID! }';
  const nu = 'type User { id: ID! email: String! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, true);
  const fc = delta.modified_types[0].fieldChanges;
  assert.equal(fc[0].name, 'email');
  assert.equal(fc[0].breaking, true);
});

// ─── 6. removing a field → breaking ─────────────────────────────────

test('computeDelta: removing a field is breaking', () => {
  const old = 'type User { id: ID! name: String }';
  const nu = 'type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, true);
  const removed = delta.modified_types[0].fieldChanges.find((f) => f.name === 'name');
  assert.ok(removed);
  assert.equal(removed.kind, 'removed');
  assert.equal(removed.breaking, true);
});

// ─── 7. changing a field type → breaking ────────────────────────────

test('computeDelta: changing a field type is breaking', () => {
  const old = 'type User { age: Int }';
  const nu = 'type User { age: String }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, true);
  const changed = delta.modified_types[0].fieldChanges.find((f) => f.kind === 'changed');
  assert.ok(changed);
  assert.ok(changed.description.includes('Int'));
  assert.ok(changed.description.includes('String'));
});

// ─── 8. adding an enum value → non-breaking ─────────────────────────

test('computeDelta: adding an enum value is non-breaking', () => {
  const old = 'enum Color { RED GREEN }';
  const nu = 'enum Color { RED GREEN BLUE }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, false);
  const added = delta.modified_types[0].fieldChanges.find((f) => f.name === 'BLUE');
  assert.ok(added);
  assert.equal(added.breaking, false);
  assert.ok(added.description.includes('Enum value'));
});

// ─── 9. removing an enum value → breaking ───────────────────────────

test('computeDelta: removing an enum value is breaking', () => {
  const old = 'enum Color { RED GREEN BLUE }';
  const nu = 'enum Color { RED GREEN }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].breaking, true);
  const removed = delta.modified_types[0].fieldChanges.find((f) => f.name === 'BLUE');
  assert.ok(removed);
  assert.equal(removed.breaking, true);
});

// ─── 10. type renamed → shows as remove + add ──────────────────────

test('computeDelta: type rename shows as remove + add', () => {
  const old = 'type Foo { x: Int }';
  const nu = 'type Bar { x: Int }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.removed_types.length, 1);
  assert.equal(delta.removed_types[0].name, 'Foo');
  assert.equal(delta.added_types.length, 1);
  assert.equal(delta.added_types[0].name, 'Bar');
});

// ─── 11. op added → non-breaking ────────────────────────────────────

test('computeDelta: adding a query operation is non-breaking', () => {
  const old = 'type Query { users: [User] } type User { id: ID! }';
  const nu =
    'type Query { users: [User] posts: [Post] } type User { id: ID! } type Post { id: ID! }';
  const delta = computeDelta(old, nu);
  const addedOp = delta.added_ops.find((o) => o.name === 'Query.posts');
  assert.ok(addedOp);
  assert.equal(addedOp.breaking, false);
});

// ─── 12. op removed → breaking ──────────────────────────────────────

test('computeDelta: removing a query operation is breaking', () => {
  const old =
    'type Query { users: [User] posts: [Post] } type User { id: ID! } type Post { id: ID! }';
  const nu = 'type Query { users: [User] } type User { id: ID! } type Post { id: ID! }';
  const delta = computeDelta(old, nu);
  const removedOp = delta.removed_ops.find((o) => o.name === 'Query.posts');
  assert.ok(removedOp);
  assert.equal(removedOp.breaking, true);
});

// ─── 13. op arg added (required) → breaking ─────────────────────────

test('computeDelta: adding a required op argument is breaking', () => {
  const old = 'type Query { user(id: ID!): User } type User { id: ID! }';
  const nu = 'type Query { user(id: ID!, role: String!): User } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_ops.length, 1);
  assert.equal(delta.modified_ops[0].breaking, true);
  const argChange = delta.modified_ops[0].argChanges.find((a) => a.name === 'role');
  assert.ok(argChange);
  assert.equal(argChange.breaking, true);
});

// ─── 14. op arg removed → breaking ──────────────────────────────────

test('computeDelta: removing an op argument is breaking', () => {
  const old = 'type Query { user(id: ID!, role: String): User } type User { id: ID! }';
  const nu = 'type Query { user(id: ID!): User } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_ops.length, 1);
  assert.equal(delta.modified_ops[0].breaking, true);
  const removed = delta.modified_ops[0].argChanges.find((a) => a.name === 'role');
  assert.ok(removed);
  assert.equal(removed.kind, 'removed');
});

// ─── 15. op arg type changed → breaking ─────────────────────────────

test('computeDelta: changing an op argument type is breaking', () => {
  const old = 'type Query { user(id: ID!): User } type User { id: ID! }';
  const nu = 'type Query { user(id: String!): User } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_ops.length, 1);
  assert.equal(delta.modified_ops[0].breaking, true);
  const changed = delta.modified_ops[0].argChanges.find((a) => a.kind === 'changed');
  assert.ok(changed);
  assert.ok(changed.description.includes('ID!'));
  assert.ok(changed.description.includes('String!'));
});

// ─── 16. op return type changed → breaking ──────────────────────────

test('computeDelta: changing op return type is breaking', () => {
  const old = 'type Query { user: User } type User { id: ID! }';
  const nu = 'type Query { user: String } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_ops.length, 1);
  assert.equal(delta.modified_ops[0].breaking, true);
  assert.ok(delta.modified_ops[0].returnTypeChange);
  assert.ok(delta.modified_ops[0].returnTypeChange.includes('User'));
  assert.ok(delta.modified_ops[0].returnTypeChange.includes('String'));
});

// ─── 17. delta is JSON-serializable ─────────────────────────────────

test('computeDelta: result is JSON-serializable', () => {
  const old = 'type Query { hello: String }';
  const nu = 'type Query { hello: String world: Int }';
  const delta = computeDelta(old, nu);
  const json = JSON.stringify(delta);
  const parsed = JSON.parse(json);
  assert.deepStrictEqual(parsed.added_types, delta.added_types);
  assert.deepStrictEqual(parsed.removed_types, delta.removed_types);
});

// ─── 18. description strings are present and readable ───────────────

test('computeDelta: all description strings are non-empty', () => {
  const old = `
    type Query { user(id: ID!): User }
    type User { id: ID! name: String }
    enum Role { ADMIN USER }
  `;
  const nu = `
    type Query { user(id: String!): User posts: [Post] }
    type Post { id: ID! }
    enum Role { ADMIN USER MODERATOR }
  `;
  const delta = computeDelta(old, nu);

  // Check all entries have non-empty descriptions
  for (const t of [...delta.added_types, ...delta.removed_types]) {
    assert.ok(
      typeof t.description === 'string' && t.description.length > 0,
      `Type delta for ${t.name} needs description`
    );
  }
  for (const m of delta.modified_types) {
    assert.ok(typeof m.description === 'string' && m.description.length > 0);
    for (const fc of m.fieldChanges) {
      assert.ok(typeof fc.description === 'string' && fc.description.length > 0);
    }
  }
  for (const o of [...delta.added_ops, ...delta.removed_ops]) {
    assert.ok(typeof o.description === 'string' && o.description.length > 0);
  }
  for (const m of delta.modified_ops) {
    assert.ok(typeof m.description === 'string' && m.description.length > 0);
  }
});

// ─── 19. mutation operations tracked ────────────────────────────────

test('computeDelta: mutation operations are tracked', () => {
  const old =
    'type Query { q: String } type Mutation { createUser(name: String!): User } type User { id: ID! }';
  const nu =
    'type Query { q: String } type Mutation { deleteUser(id: ID!): Boolean } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  const removed = delta.removed_ops.find((o) => o.name === 'Mutation.createUser');
  const added = delta.added_ops.find((o) => o.name === 'Mutation.deleteUser');
  assert.ok(removed);
  assert.ok(added);
  assert.equal(removed.breaking, true);
  assert.equal(added.breaking, false);
});

// ─── 20. directive changes on types detected ────────────────────────

test('computeDelta: directive changes on types are detected', () => {
  const old = `
    directive @auth on OBJECT
    type User @auth { id: ID! }
  `;
  const nu = `
    directive @auth on OBJECT
    type User { id: ID! }
  `;
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_types.length, 1);
  assert.equal(delta.modified_types[0].directiveChanges.length, 1);
  assert.equal(delta.modified_types[0].directiveChanges[0].kind, 'removed');
  assert.equal(delta.modified_types[0].directiveChanges[0].breaking, true);
});

// ─── 21. adding optional op arg → non-breaking ─────────────────────

test('computeDelta: adding an optional op argument is non-breaking', () => {
  const old = 'type Query { user(id: ID!): User } type User { id: ID! }';
  const nu = 'type Query { user(id: ID!, limit: Int): User } type User { id: ID! }';
  const delta = computeDelta(old, nu);
  assert.equal(delta.modified_ops.length, 1);
  assert.equal(delta.modified_ops[0].breaking, false);
  const argChange = delta.modified_ops[0].argChanges.find((a) => a.name === 'limit');
  assert.ok(argChange);
  assert.equal(argChange.breaking, false);
});

// ─── 22. performance: 500-type schemas under 200ms ──────────────────

test('computeDelta: performance — 500-type schemas under 200ms', () => {
  const types = [];
  for (let i = 0; i < 500; i++) {
    const fields = [];
    for (let j = 0; j < 5; j++) {
      fields.push(`field${j}: String`);
    }
    types.push(`type Type${i} { ${fields.join(' ')} }`);
  }
  const oldSDL = types.join('\n');
  // Modify every 10th type slightly
  const newTypes = types.map((t, i) =>
    i % 10 === 0 ? t.replace('field0: String', 'field0: Int') : t
  );
  const newSDL = newTypes.join('\n');

  const start = performance.now();
  const delta = computeDelta(oldSDL, newSDL);
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 200, `Took ${elapsed.toFixed(1)}ms, expected < 200ms`);
  assert.equal(delta.modified_types.length, 50);
});
