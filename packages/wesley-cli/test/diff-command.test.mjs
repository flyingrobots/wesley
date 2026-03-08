/**
 * Unit tests for wesley diff command (E1.7)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiffCommand, flattenChanges, formatText, formatSummary } from '../src/commands/diff.mjs';

// ─── test harness ───────────────────────────────────────────────────

let tmpDir;

/** Create a temp dir before each test group and clean up after. */
function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'wesley-diff-'));
}
function teardown() {
  rmSync(tmpDir, { recursive: true, force: true });
}

/** Write SDL to a temp file, return its path. */
function writeSchema(name, sdl) {
  const p = join(tmpDir, name);
  writeFileSync(p, sdl, 'utf-8');
  return p;
}

/** Build a minimal context with captured stdout/stderr. */
function makeCtx() {
  const stdout = { chunks: [], write(s) { this.chunks.push(s); } };
  const stderr = { chunks: [], write(s) { this.chunks.push(s); } };
  return {
    stdout,
    stderr,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    fs: {},
    env: {}
  };
}

// ─── text format ────────────────────────────────────────────────────

test('diff: text output lists breaking and safe changes', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', `
      type Query { getUser: UserProfile }
      type UserProfile { id: ID! name: String }
    `);
    const nu = writeSchema('new.graphql', `
      type Query { listUsers: [UserListItem] }
      type UserListItem { id: ID! }
    `);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await cmd._run(old, nu, { format: 'text' });
    const output = ctx.stdout.chunks.join('');
    assert.ok(output.includes('BREAKING'), 'should contain BREAKING tag');
    assert.ok(output.includes('safe'), 'should contain safe tag');
  } finally {
    teardown();
  }
});

// ─── json format ────────────────────────────────────────────────────

test('diff: json output is valid SchemaDelta', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', 'type Query { hello: String }');
    const nu = writeSchema('new.graphql', `
      type Query { hello: String world: Int }
      type NewType { id: ID! }
    `);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await cmd._run(old, nu, { format: 'json' });
    const output = ctx.stdout.chunks.join('');
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed.added_types), 'has added_types array');
    assert.ok(Array.isArray(parsed.removed_types), 'has removed_types array');
    assert.ok(Array.isArray(parsed.modified_types), 'has modified_types array');
    assert.ok(Array.isArray(parsed.added_ops), 'has added_ops array');
    assert.ok(Array.isArray(parsed.removed_ops), 'has removed_ops array');
    assert.ok(Array.isArray(parsed.modified_ops), 'has modified_ops array');
  } finally {
    teardown();
  }
});

// ─── summary format ─────────────────────────────────────────────────

test('diff: summary format produces single line', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', `
      type Query { getUser: User }
      type User { id: ID! name: String }
    `);
    const nu = writeSchema('new.graphql', `
      type Query { getUser: User listUsers: [User] }
      type User { id: ID! }
    `);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await cmd._run(old, nu, { format: 'summary' });
    const output = ctx.stdout.chunks.join('').trim();
    const lines = output.split('\n');
    assert.equal(lines.length, 1, 'summary should be a single line');
    assert.ok(/\d+ breaking/.test(output) || /\d+ safe/.test(output), 'should contain counts');
  } finally {
    teardown();
  }
});

// ─── --breaking-only ────────────────────────────────────────────────

test('diff: --breaking-only filters out non-breaking changes', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', `
      type Query { getUser: User }
      type User { id: ID! name: String }
    `);
    const nu = writeSchema('new.graphql', `
      type Query { getUser: User listUsers: [User] }
      type User { id: ID! }
    `);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await cmd._run(old, nu, { format: 'text', breakingOnly: true });
    const output = ctx.stdout.chunks.join('');
    assert.ok(!output.includes('safe'), 'should not contain safe changes');
    assert.ok(output.includes('BREAKING'), 'should contain breaking changes');
  } finally {
    teardown();
  }
});

// ─── --exit-code ────────────────────────────────────────────────────

test('diff: --exit-code returns 1 on breaking changes', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', `
      type Query { hello: String }
      type User { id: ID! }
    `);
    const nu = writeSchema('new.graphql', 'type Query { hello: String }');
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await assert.rejects(
      () => cmd._run(old, nu, { format: 'text', exitCode: true }),
      (err) => err.name === 'ExitError' && err.exitCode === 1,
      'should throw ExitError(1) on breaking changes'
    );
  } finally {
    teardown();
  }
});

test('diff: --exit-code returns 0 when no breaking changes', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', 'type Query { hello: String }');
    const nu = writeSchema('new.graphql', `
      type Query { hello: String world: Int }
      type NewType { id: ID! }
    `);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    // Should NOT throw
    const result = await cmd._run(old, nu, { format: 'text', exitCode: true });
    assert.ok(result.delta, 'should return delta');
  } finally {
    teardown();
  }
});

// ─── missing file ───────────────────────────────────────────────────

test('diff: missing old file gives clear error', async () => {
  setup();
  try {
    const nu = writeSchema('new.graphql', 'type Query { hello: String }');
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await assert.rejects(
      () => cmd._run('/nonexistent/old.graphql', nu, { format: 'text' }),
      (err) => err.name === 'ExitError',
      'should throw ExitError for missing file'
    );
    const errOutput = ctx.stderr.chunks.join('');
    assert.ok(errOutput.includes('Cannot read old schema'), 'error message mentions old schema');
  } finally {
    teardown();
  }
});

test('diff: missing new file gives clear error', async () => {
  setup();
  try {
    const old = writeSchema('old.graphql', 'type Query { hello: String }');
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await assert.rejects(
      () => cmd._run(old, '/nonexistent/new.graphql', { format: 'text' }),
      (err) => err.name === 'ExitError',
      'should throw ExitError for missing file'
    );
    const errOutput = ctx.stderr.chunks.join('');
    assert.ok(errOutput.includes('Cannot read new schema'), 'error message mentions new schema');
  } finally {
    teardown();
  }
});

// ─── identical schemas ──────────────────────────────────────────────

test('diff: identical schemas report no changes', async () => {
  setup();
  try {
    const sdl = 'type Query { hello: String }\ntype User { id: ID! name: String }';
    const old = writeSchema('old.graphql', sdl);
    const nu = writeSchema('new.graphql', sdl);
    const ctx = makeCtx();
    const cmd = new DiffCommand(ctx);
    await cmd._run(old, nu, { format: 'text' });
    const output = ctx.stdout.chunks.join('');
    assert.ok(output.includes('No changes'), 'should report no changes');
  } finally {
    teardown();
  }
});

// ─── missing arguments ─────────────────────────────────────────────

test('diff: missing arguments gives usage error', async () => {
  const ctx = makeCtx();
  const cmd = new DiffCommand(ctx);
  await assert.rejects(
    () => cmd._run(null, null, {}),
    (err) => err.name === 'ExitError',
    'should throw ExitError for missing args'
  );
  const errOutput = ctx.stderr.chunks.join('');
  assert.ok(errOutput.includes('Two schema file paths are required'), 'shows usage hint');
});

// ─── helper unit tests ─────────────────────────────────────────────

test('flattenChanges: flattens SchemaDelta correctly', () => {
  const delta = {
    added_types: [{ name: 'Foo', breaking: false, description: 'Type "Foo" added' }],
    removed_types: [{ name: 'Bar', breaking: true, description: 'Type "Bar" removed' }],
    modified_types: [{
      name: 'Baz',
      breaking: true,
      description: 'Type "Baz" modified: 1 field change(s)',
      fieldChanges: [{ name: 'x', kind: 'removed', breaking: true, description: 'Field "x" removed from Baz' }],
      directiveChanges: []
    }],
    added_ops: [],
    removed_ops: [],
    modified_ops: []
  };
  const changes = flattenChanges(delta);
  assert.equal(changes.length, 3);
  assert.ok(changes.some((c) => c.breaking && c.description.includes('Bar')));
  assert.ok(changes.some((c) => !c.breaking && c.description.includes('Foo')));
  assert.ok(changes.some((c) => c.breaking && c.description.includes('removed from Baz')));
});

test('formatText: no changes message', () => {
  assert.equal(formatText([]), 'No changes detected.');
});

test('formatText: BREAKING and safe tags', () => {
  const changes = [
    { breaking: true, description: 'Removed type: X' },
    { breaking: false, description: 'Added type: Y' }
  ];
  const text = formatText(changes);
  assert.ok(text.includes('BREAKING'));
  assert.ok(text.includes('safe'));
});

test('formatSummary: counts breaking and safe', () => {
  const changes = [
    { breaking: true }, { breaking: true },
    { breaking: false }
  ];
  const summary = formatSummary(changes);
  assert.ok(summary.includes('2 breaking'));
  assert.ok(summary.includes('1 safe'));
});

test('formatSummary: no changes', () => {
  assert.equal(formatSummary([]), 'No changes detected.');
});
