import test from 'node:test';
import assert from 'node:assert/strict';

import {
  testGenerator,
  testGeneratorPlan,
  expectArtifact,
} from '../../src/testing/testGenerator.mjs';

// ---------------------------------------------------------------------------
// Minimal inline plugin for harness tests
// ---------------------------------------------------------------------------

function makePlugin(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'harness-test',
    init() {},
    async plan(schema, context) {
      return {
        artifacts: [{ path: 'out.txt', reason: 'test output' }],
        metadata: { sdl: schema.sdl },
      };
    },
    async generate(plan) {
      return { 'out.txt': `generated:${plan.metadata.sdl}` };
    },
    ...overrides,
  };
}

// ===========================================================================
// testGenerator — full lifecycle
// ===========================================================================

test('testGenerator — golden path returns artifacts', async () => {
  const artifacts = await testGenerator(makePlugin(), 'type Query { hello: String }');
  assert.equal(typeof artifacts, 'object');
  assert.equal(artifacts['out.txt'], 'generated:type Query { hello: String }');
});

test('testGenerator — config forwarded to init', async () => {
  let receivedConfig;
  const plugin = makePlugin({
    init(config) { receivedConfig = config; },
  });

  await testGenerator(plugin, 'type Query { x: Int }', { flavor: 'vanilla' });
  assert.equal(receivedConfig.flavor, 'vanilla');
});

test('testGenerator — default config is empty object', async () => {
  let receivedConfig;
  const plugin = makePlugin({
    init(config) { receivedConfig = config; },
  });

  await testGenerator(plugin, 'type Query { x: Int }');
  assert.deepEqual(receivedConfig, {});
});

test('testGenerator — rejects invalid plugin (no name)', async () => {
  const bad = makePlugin({ name: '' });
  await assert.rejects(() => testGenerator(bad, 'x'), /name/i);
});

test('testGenerator — rejects invalid plan (no artifacts array)', async () => {
  const plugin = makePlugin({
    async plan() { return { artifacts: 'nope' }; },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /artifacts/i);
});

test('testGenerator — rejects non-object generate return', async () => {
  const plugin = makePlugin({
    async generate() { return 'bad'; },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /Record/);
});

test('testGenerator — rejects null generate return', async () => {
  const plugin = makePlugin({
    async generate() { return null; },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /null/);
});

test('testGenerator — rejects array generate return', async () => {
  const plugin = makePlugin({
    async generate() { return []; },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /Array/);
});

test('testGenerator — propagates error thrown in generate', async () => {
  const plugin = makePlugin({
    async generate() { throw new Error('kaboom'); },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /kaboom/);
});

test('testGenerator — propagates error thrown in plan', async () => {
  const plugin = makePlugin({
    async plan() { throw new Error('plan-fail'); },
  });
  await assert.rejects(() => testGenerator(plugin, 'x'), /plan-fail/);
});

test('testGenerator — supports binary (Uint8Array) artifacts', async () => {
  const binary = new Uint8Array([0x00, 0xFF, 0x42]);
  const plugin = makePlugin({
    async plan() { return { artifacts: [{ path: 'bin.dat', binary: true }] }; },
    async generate() { return { 'bin.dat': binary }; },
  });
  const artifacts = await testGenerator(plugin, 'x');
  assert.ok(artifacts['bin.dat'] instanceof Uint8Array);
  assert.deepEqual(artifacts['bin.dat'], binary);
});

test('testGenerator — deterministic: same input produces identical output', async () => {
  const plugin = makePlugin();
  const a1 = await testGenerator(plugin, 'type Q { a: Int }');
  const a2 = await testGenerator(plugin, 'type Q { a: Int }');
  assert.deepEqual(a1, a2);
});

test('testGenerator — no filesystem I/O (context has null logger, fake clock)', async () => {
  let capturedContext;
  const plugin = makePlugin({
    async plan(schema, context) {
      capturedContext = context;
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() { return { 'out.txt': 'ok' }; },
  });

  await testGenerator(plugin, 'x');
  assert.equal(capturedContext.runId, 'test-run-0');
  assert.equal(capturedContext.clock.now(), '2020-01-01T00:00:00.000Z');
  // Logger discards; calling methods should not throw
  capturedContext.logger.info('should be silent');
  capturedContext.logger.warn('should be silent');
  capturedContext.logger.error('should be silent');
  capturedContext.logger.debug('should be silent');
});

test('testGenerator — context is frozen', async () => {
  let capturedContext;
  const plugin = makePlugin({
    async plan(schema, context) {
      capturedContext = context;
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() { return { 'out.txt': 'ok' }; },
  });

  await testGenerator(plugin, 'x');
  assert.throws(() => { capturedContext.runId = 'hacked'; }, TypeError);
  assert.throws(() => { capturedContext.config.anything = 'hacked'; }, TypeError);
});

// ===========================================================================
// testGeneratorPlan — plan-only lifecycle
// ===========================================================================

test('testGeneratorPlan — returns validated plan', async () => {
  const plan = await testGeneratorPlan(makePlugin(), 'type Query { hello: String }');
  assert.ok(Array.isArray(plan.artifacts));
  assert.equal(plan.artifacts[0].path, 'out.txt');
  assert.equal(plan.metadata.sdl, 'type Query { hello: String }');
});

test('testGeneratorPlan — forwards config to init', async () => {
  let receivedConfig;
  const plugin = makePlugin({
    init(config) { receivedConfig = config; },
  });
  await testGeneratorPlan(plugin, 'x', { key: 'val' });
  assert.equal(receivedConfig.key, 'val');
});

test('testGeneratorPlan — rejects invalid plan', async () => {
  const plugin = makePlugin({
    async plan() { return null; },
  });
  await assert.rejects(() => testGeneratorPlan(plugin, 'x'), /Plan/i);
});

// ===========================================================================
// expectArtifact — assertion helpers
// ===========================================================================

test('expectArtifact.toExist — passes when artifact exists', () => {
  const artifacts = { 'a.txt': 'hello' };
  assert.doesNotThrow(() => expectArtifact(artifacts, 'a.txt').toExist());
});

test('expectArtifact.toExist — fails when artifact missing', () => {
  const artifacts = { 'a.txt': 'hello' };
  assert.throws(
    () => expectArtifact(artifacts, 'b.txt').toExist(),
    /b\.txt/
  );
});

test('expectArtifact.toContain — passes when content contains substring', () => {
  const artifacts = { 'a.txt': 'hello world' };
  assert.doesNotThrow(() => expectArtifact(artifacts, 'a.txt').toContain('world'));
});

test('expectArtifact.toContain — fails when content missing substring', () => {
  const artifacts = { 'a.txt': 'hello world' };
  assert.throws(
    () => expectArtifact(artifacts, 'a.txt').toContain('xyz'),
    /xyz/
  );
});

test('expectArtifact.toContain — decodes Uint8Array content', () => {
  const artifacts = { 'a.txt': new TextEncoder().encode('binary hello') };
  assert.doesNotThrow(() => expectArtifact(artifacts, 'a.txt').toContain('binary'));
});

test('expectArtifact.toContain — fails on missing path', () => {
  const artifacts = {};
  assert.throws(
    () => expectArtifact(artifacts, 'x.txt').toContain('any'),
    /x\.txt/
  );
});

test('expectArtifact.toMatchJSON — passes on matching JSON', () => {
  const artifacts = { 'data.json': JSON.stringify({ a: 1, b: [2, 3] }) };
  assert.doesNotThrow(() => expectArtifact(artifacts, 'data.json').toMatchJSON({ a: 1, b: [2, 3] }));
});

test('expectArtifact.toMatchJSON — fails on mismatched JSON', () => {
  const artifacts = { 'data.json': JSON.stringify({ a: 1 }) };
  assert.throws(
    () => expectArtifact(artifacts, 'data.json').toMatchJSON({ a: 2 }),
    /mismatch/i
  );
});

test('expectArtifact.toMatchJSON — fails on invalid JSON', () => {
  const artifacts = { 'data.json': 'not json{{{' };
  assert.throws(
    () => expectArtifact(artifacts, 'data.json').toMatchJSON({}),
    /valid JSON/
  );
});

test('expectArtifact.toMatchJSON — decodes Uint8Array content', () => {
  const obj = { key: 'value' };
  const artifacts = { 'data.json': new TextEncoder().encode(JSON.stringify(obj)) };
  assert.doesNotThrow(() => expectArtifact(artifacts, 'data.json').toMatchJSON(obj));
});

test('expectArtifact.toMatchJSON — fails on missing path', () => {
  const artifacts = {};
  assert.throws(
    () => expectArtifact(artifacts, 'x.json').toMatchJSON({}),
    /x\.json/
  );
});
