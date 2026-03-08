import test from 'node:test';
import assert from 'node:assert/strict';
import { TransmutationRunner } from '../../src/application/TransmutationRunner.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nullLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() { return nullLogger; },
  setLevel() {},
  async flush() {}
};

const fakeClock = { now() { return '2026-03-08T00:00:00.000Z'; } };

function makeRunner(overrides = {}) {
  return new TransmutationRunner({
    logger: nullLogger,
    clock: fakeClock,
    config: {},
    ...overrides
  });
}

function makePlugin(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'test-plugin',
    init() {},
    async plan() {
      return { artifacts: [{ path: 'out.txt', reason: 'test' }] };
    },
    async generate() {
      return { 'out.txt': 'hello' };
    },
    ...overrides
  };
}

/** Plugin that returns evidence alongside files (new transmutation-aware shape) */
function makeEvidencePlugin(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'evidence-plugin',
    init() {},
    async plan() {
      return { artifacts: [{ path: 'ddl/User.sql' }] };
    },
    async generate() {
      return {
        files: { 'ddl/User.sql': 'CREATE TABLE "User" ...;' },
        evidence: {
          'col:User.id': {
            artifacts: {
              ddl: { file: 'ddl/User.sql', lines: [1, 1], sha: 'abc123' }
            }
          },
          'col:User.email': {
            artifacts: {
              ddl: { file: 'ddl/User.sql', lines: [2, 2], sha: 'abc123' }
            }
          }
        }
      };
    },
    ...overrides
  };
}

async function catchReject(fn) {
  try { await fn(); } catch (e) { return e; }
  throw new Error('Expected promise to reject');
}

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

test('TransmutationRunner — constructor throws on missing logger', () => {
  assert.throws(() => new TransmutationRunner({ clock: fakeClock, config: {} }), /logger/i);
});

test('TransmutationRunner — constructor throws on missing clock', () => {
  assert.throws(() => new TransmutationRunner({ logger: nullLogger, config: {} }), /clock/i);
});

test('TransmutationRunner — constructor throws on missing config', () => {
  assert.throws(() => new TransmutationRunner({ logger: nullLogger, clock: fakeClock }), /config/i);
});

// ---------------------------------------------------------------------------
// Golden path
// ---------------------------------------------------------------------------

test('TransmutationRunner — runs a plugin and returns transmutation result', async () => {
  const runner = makeRunner();
  const result = await runner.run('backend', [makePlugin()], { sdl: 'type Query { x: String }' });

  assert.equal(result.transmutation, 'backend');
  assert.equal(result.success, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, 'ok');
  assert.equal(result.results[0].name, 'test-plugin');
  assert.equal(result.totalArtifacts, 1);
  assert.ok(result.runId.startsWith('run-'));
  assert.ok(result.scores);
  assert.ok(result.evidence);
  assert.ok(result.bundle);
});

test('TransmutationRunner — bundle includes transmutation name', async () => {
  const runner = makeRunner();
  const result = await runner.run('echo', [makePlugin()], {});

  assert.equal(result.bundle.transmutation, 'echo');
  assert.equal(result.bundle.bundleVersion, '2.0.0');
});

// ---------------------------------------------------------------------------
// Evidence collection
// ---------------------------------------------------------------------------

test('TransmutationRunner — collects evidence from plugins that return { files, evidence }', async () => {
  const runner = makeRunner();
  const result = await runner.run('backend', [makeEvidencePlugin()], {});

  assert.equal(result.success, true);
  assert.equal(result.results[0].status, 'ok');

  // Evidence should be in the result
  const evidence = result.evidence;
  assert.ok(evidence);
  assert.ok(evidence.evidence['col:User.id']);
  assert.ok(evidence.evidence['col:User.email']);
});

test('TransmutationRunner — merges evidence from multiple plugins', async () => {
  const runner = makeRunner();
  const ddlPlugin = makeEvidencePlugin({ name: 'ddl-plugin' });
  const tsPlugin = {
    apiVersion: '1',
    name: 'ts-plugin',
    async plan() { return { artifacts: [{ path: 'models/User.ts' }] }; },
    async generate() {
      return {
        files: { 'models/User.ts': 'export interface User {}' },
        evidence: {
          'col:User.id': {
            artifacts: {
              typescript: { file: 'models/User.ts', lines: [1, 1], sha: 'def456' }
            }
          }
        }
      };
    }
  };

  const result = await runner.run('backend', [ddlPlugin, tsPlugin], {});
  assert.equal(result.success, true);
  assert.equal(result.totalArtifacts, 2);

  // col:User.id should have evidence from both plugins
  const userIdEvidence = result.evidence.evidence['col:User.id'];
  assert.ok(userIdEvidence);
  assert.ok(userIdEvidence.ddl, 'should have ddl evidence');
  assert.ok(userIdEvidence.typescript, 'should have typescript evidence');
});

// ---------------------------------------------------------------------------
// Legacy plugin support
// ---------------------------------------------------------------------------

test('TransmutationRunner — supports legacy plugins returning Record<string, content>', async () => {
  const runner = makeRunner();
  const legacyPlugin = makePlugin(); // returns plain { 'out.txt': 'hello' }
  const result = await runner.run('legacy', [legacyPlugin], {});

  assert.equal(result.success, true);
  assert.equal(result.results[0].artifacts['out.txt'], 'hello');
  assert.equal(result.results[0].evidence, null);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test('TransmutationRunner — plugin failure stops execution by default', async () => {
  const runner = makeRunner();
  const failPlugin = makePlugin({
    name: 'fail',
    async plan() { throw new Error('boom'); }
  });
  const goodPlugin = makePlugin({ name: 'good' });

  const result = await runner.run('test', [failPlugin, goodPlugin], {});
  assert.equal(result.success, false);
  assert.equal(result.results.length, 1); // stopped after failure
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].phase, 'plan');
});

test('TransmutationRunner — best-effort continues after failure', async () => {
  const runner = makeRunner({ bestEffort: true });
  const failPlugin = makePlugin({
    name: 'fail',
    async plan() { throw new Error('boom'); }
  });
  const goodPlugin = makePlugin({ name: 'good' });

  const result = await runner.run('test', [failPlugin, goodPlugin], {});
  assert.equal(result.success, true);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[1].status, 'ok');
});

test('TransmutationRunner — bad generate() return type produces WPLY003', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({ async generate() { return null; } });

  const result = await runner.run('test', [plugin], {});
  assert.equal(result.success, false);
  assert.equal(result.results[0].errorCode, 'WPLY003');
});

test('TransmutationRunner — null plugin in array produces WPLY001', async () => {
  const runner = makeRunner({ bestEffort: true });
  const result = await runner.run('test', [null, makePlugin()], {});
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY001');
  assert.equal(result.results[1].status, 'ok');
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('TransmutationRunner — throws on non-array plugins', async () => {
  const runner = makeRunner();
  const err = await catchReject(() => runner.run('test', 'not-array', {}));
  assert.match(err.message, /array/i);
});

test('TransmutationRunner — throws on null schema', async () => {
  const runner = makeRunner();
  const err = await catchReject(() => runner.run('test', [], null));
  assert.match(err.message, /schema/i);
});

// ---------------------------------------------------------------------------
// Context isolation
// ---------------------------------------------------------------------------

test('TransmutationRunner — context is frozen (plugin cannot mutate it)', async () => {
  const runner = makeRunner({ config: { key: 'value' } });
  let capturedContext;

  const plugin = makePlugin({
    async plan(schema, context) {
      capturedContext = context;
      assert.throws(() => { context.runId = 'hacked'; }, TypeError);
      assert.throws(() => { context.config.key = 'hacked'; }, TypeError);
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() { return { 'out.txt': 'ok' }; }
  });

  const result = await runner.run('test', [plugin], {});
  assert.equal(result.success, true);
  assert.ok(capturedContext);
  assert.equal(capturedContext.config.key, 'value');
});

// ---------------------------------------------------------------------------
// Task graph generation (Phase 0c)
// ---------------------------------------------------------------------------

test('TransmutationRunner — buildTaskGraph produces DAG with parse → generators → evidence', () => {
  const runner = makeRunner();
  const plugins = [
    makePlugin({ name: 'supabase' }),
    makePlugin({ name: 'js' })
  ];

  const graph = runner.buildTaskGraph('backend', plugins);

  // Should have: parse, supabase, js, evidence = 4 nodes
  assert.equal(graph.nodes.length, 4);
  assert.ok(graph.nodes.find(n => n.id === 'backend:parse'));
  assert.ok(graph.nodes.find(n => n.id === 'backend:gen:supabase'));
  assert.ok(graph.nodes.find(n => n.id === 'backend:gen:js'));
  assert.ok(graph.nodes.find(n => n.id === 'backend:evidence'));

  // Parse has no dependencies
  const parse = graph.nodes.find(n => n.id === 'backend:parse');
  assert.deepEqual(parse.dependencies, []);

  // Generators depend on parse
  const supabase = graph.nodes.find(n => n.id === 'backend:gen:supabase');
  assert.deepEqual(supabase.dependencies, ['backend:parse']);

  // Evidence depends on all generators
  const evidence = graph.nodes.find(n => n.id === 'backend:evidence');
  assert.ok(evidence.dependencies.includes('backend:gen:supabase'));
  assert.ok(evidence.dependencies.includes('backend:gen:js'));

  // Edges match
  assert.ok(graph.edges.some(([from, to]) => from === 'backend:parse' && to === 'backend:gen:supabase'));
  assert.ok(graph.edges.some(([from, to]) => from === 'backend:gen:js' && to === 'backend:evidence'));
});

test('TransmutationRunner — buildTaskGraph with single plugin', () => {
  const runner = makeRunner();
  const graph = runner.buildTaskGraph('echo', [makePlugin({ name: 'echo-gen' })]);

  assert.equal(graph.nodes.length, 3); // parse, echo-gen, evidence
  assert.equal(graph.edges.length, 2); // parse→gen, gen→evidence
});

test('TransmutationRunner — buildTaskGraph metadata carries transmutation name', () => {
  const runner = makeRunner();
  const graph = runner.buildTaskGraph('ui', [makePlugin({ name: 'vue' })]);

  for (const node of graph.nodes) {
    assert.equal(node.metadata.transmutation, 'ui');
  }
});

// ---------------------------------------------------------------------------
// Null-safety at shape boundaries
// ---------------------------------------------------------------------------

test('TransmutationRunner — { files: null, evidence: {} } produces WPLY003 error, not unguarded throw', async () => {
  const runner = makeRunner({ bestEffort: true });
  const plugin = makePlugin({
    name: 'null-files',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() { return { files: null, evidence: {} }; }
  });
  const good = makePlugin({ name: 'good' });

  const result = await runner.run('test', [plugin, good], {});

  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY003');
  assert.equal(result.results[1].status, 'ok');
});

test('TransmutationRunner — { files: [], evidence: {} } (array) produces WPLY003', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    name: 'array-files',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() { return { files: ['not', 'a', 'record'], evidence: {} }; }
  });

  const result = await runner.run('test', [plugin], {});

  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY003');
});

test('TransmutationRunner — non-object evidence produces WPLY003', async () => {
  const runner = makeRunner({ bestEffort: true });
  const plugin = makePlugin({
    name: 'bad-evidence',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() { return { files: { 'x.sql': 'CREATE TABLE ...' }, evidence: 42 }; }
  });
  const good = makePlugin({ name: 'good' });

  const result = await runner.run('test', [plugin, good], {});

  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY003');
  assert.equal(result.results[1].status, 'ok');
});

test('TransmutationRunner — null evidence produces WPLY003', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    name: 'null-evidence',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() { return { files: { 'x.sql': 'ok' }, evidence: null }; }
  });

  const result = await runner.run('test', [plugin], {});

  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY003');
});

test('TransmutationRunner — evidence entry without .artifacts is silently skipped', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    name: 'sparse-evidence',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() {
      return {
        files: { 'x.sql': 'CREATE TABLE ...' },
        evidence: {
          'col:User.id': { /* no artifacts key */ },
          'col:User.email': { artifacts: null },
          'col:User.name': { artifacts: { ddl: { file: 'x.sql', lines: [1, 1], sha: 'abc' } } }
        }
      };
    }
  });

  const result = await runner.run('test', [plugin], {});

  assert.equal(result.success, true);
  assert.equal(result.results[0].status, 'ok');
  // Only col:User.name should have recorded evidence
  const evidence = result.evidence;
  assert.ok(evidence.evidence['col:User.name']);
});

// ---------------------------------------------------------------------------
// Empty plugins
// ---------------------------------------------------------------------------

test('TransmutationRunner — empty plugins array returns success', async () => {
  const runner = makeRunner();
  const result = await runner.run('empty', [], {});
  assert.equal(result.success, true);
  assert.equal(result.totalArtifacts, 0);
  assert.equal(result.results.length, 0);
});
