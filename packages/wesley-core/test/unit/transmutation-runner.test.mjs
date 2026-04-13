import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryEventStore } from '../../src/application/MemoryEventStore.mjs';
import { createRuntimeStreamId } from '../../src/application/RuntimeEvents.mjs';
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
const minimalIr = {
  tables: [
    {
      name: 'User',
      directives: { table: true },
      fields: [
        {
          name: 'id',
          type: { base: 'ID', isList: false },
          nullable: false,
          directives: { pk: true }
        }
      ],
      indexes: []
    }
  ],
  relationships: []
};

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

test('TransmutationRunner — preserves caller-supplied runId', async () => {
  const runner = makeRunner();
  const result = await runner.run('backend', [makePlugin()], {}, { runId: 'run-manual-001' });

  assert.equal(result.runId, 'run-manual-001');
});

test('TransmutationRunner — lowers raw SDL and IR into one plugin schema envelope', async () => {
  const runner = makeRunner();
  let observedSchema = null;
  let observedContext = null;
  const plugin = makePlugin({
    async plan(schema, context) {
      observedSchema = schema;
      observedContext = context;
      assert.equal(schema.ir, minimalIr);
      assert.equal(schema.sdl, 'type User @table { id: ID! @pk }');
      assert.equal(schema.outputDir, undefined);
      assert.equal(typeof schema.getTables, 'function');
      assert.equal(context.emission.outDir, 'out');
      return {
        artifacts: [{ path: 'out.txt', reason: 'test' }],
        metadata: { tableCount: schema.getTables().length }
      };
    },
    async generate(plan) {
      return { 'out.txt': String(plan.metadata.tableCount) };
    }
  });

  const result = await runner.run('backend', [plugin], {
    sdl: 'type User @table { id: ID! @pk }',
    ir: minimalIr
  }, {
    emission: {
      outDir: 'out'
    }
  });

  assert.equal(result.success, true);
  assert.ok(observedSchema);
  assert.ok(observedContext);
  assert.equal(observedSchema.getTables()[0].name, 'User');
  assert.equal(result.results[0].artifacts['out.txt'], '1');
});

test('TransmutationRunner — bundle includes transmutation name', async () => {
  const runner = makeRunner();
  const result = await runner.run('echo', [makePlugin()], {});

  assert.equal(result.bundle.transmutation, 'echo');
  assert.equal(result.bundle.bundleVersion, '2.0.0');
});

test('TransmutationRunner — emits lifecycle events with a runtime envelope', async () => {
  const runner = makeRunner();
  const result = await runner.run('backend', [makePlugin()], {});

  assert.deepEqual(
    result.events.map(event => event.type),
    ['TaskGraphBuilt', 'TaskStarted', 'TaskCompleted', 'EvidenceMerged', 'ScoresComputed']
  );
  assert.deepEqual(
    result.events.map(event => event.sequence),
    [1, 2, 3, 4, 5]
  );
  result.events.forEach(event => {
    assert.equal(event.runId, result.runId);
    assert.equal(event.transmutation, 'backend');
    assert.match(event.eventId, new RegExp(`^${event.streamId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\d+$`));
    assert.equal(event.correlationId, result.runId);
    assert.equal(event.schemaVersion, '1.0.0');
  });
});

test('TransmutationRunner — can write events through a supplied event store', async () => {
  const runner = makeRunner();
  const eventStore = new MemoryEventStore();
  const result = await runner.run(
    'backend',
    [makePlugin()],
    {},
    { runId: 'run-store-backend', eventStore }
  );

  assert.deepEqual(
    eventStore.readStream(createRuntimeStreamId({ transmutation: 'backend', runId: 'run-store-backend' })),
    result.events
  );
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

test('TransmutationRunner — accepts transmutation-specific SCS scoring options', async () => {
  const runner = makeRunner();
  const schema = {
    getTables: () => [{
      name: 'User',
      directives: {},
      getFields: () => [{
        name: 'id',
        directives: { '@primaryKey': {} },
        isVirtual: () => false,
        isPrimaryKey: () => true,
        isForeignKey: () => false,
        isUnique: () => false,
        isIndexed: () => false
      }]
    }]
  };
  const plugin = {
    apiVersion: '1',
    name: 'legacy-supabase-plugin',
    async plan() {
      return { artifacts: [{ path: 'schema.sql' }, { path: 'tests.sql' }] };
    },
    async generate() {
      return {
        files: {
          'schema.sql': '-- ddl',
          'tests.sql': '-- tests'
        },
        evidence: {
          'col:User.id': {
            artifacts: {
              sql: { file: 'out/schema.sql', lines: '1-1', sha: 'abc123' },
              test: { file: 'out/tests.sql', lines: '1-1', sha: 'abc123' }
            }
          },
          'col:User.id.pk': {
            artifacts: {
              test: { file: 'out/tests.sql', lines: '1-1', sha: 'abc123' }
            }
          }
        }
      };
    }
  };

  const result = await runner.run(
    'legacy-supabase',
    [plugin],
    schema,
    {
      scoring: {
        scs: {
          artifactGroups: {
            sql: ['sql'],
            tests: ['test']
          },
          rollupGroups: ['sql']
        }
      }
    }
  );

  assert.equal(result.scores.scores.scs, 1);
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
  assert.deepEqual(
    result.events.map(event => event.type),
    ['TaskGraphBuilt', 'TaskStarted', 'TaskFailed', 'EvidenceMerged', 'ScoresComputed']
  );
  assert.equal(result.events[2].payload.phase, 'plan');
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

test('TransmutationRunner — null plugin in array produces WPLY001 at validate phase', async () => {
  const runner = makeRunner({ bestEffort: true });
  const result = await runner.run('test', [null, makePlugin()], {});
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].errorCode, 'WPLY001');
  assert.equal(result.results[0].phase, 'validate');
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
      assert.throws(() => { context.emission.outDir = 'hacked'; }, TypeError);
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() { return { 'out.txt': 'ok' }; }
  });

  const result = await runner.run('test', [plugin], {}, {
    emission: { outDir: 'out' }
  });
  assert.equal(result.success, true);
  assert.ok(capturedContext);
  assert.equal(capturedContext.config.key, 'value');
  assert.equal(capturedContext.emission.outDir, 'out');
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

test('TransmutationRunner — runId has consistent length (padded random segment)', async () => {
  const runner = makeRunner();
  const results = [];
  for (let i = 0; i < 20; i++) {
    const result = await runner.run('test', [], {});
    results.push(result.runId);
  }
  // All runIds should have a 6-char random suffix after the last hyphen
  for (const runId of results) {
    const parts = runId.split('-');
    // Format: run-<ts>-<rand6>
    assert.equal(parts.length, 3, `runId "${runId}" should have 3 parts`);
    assert.equal(parts[2].length, 6, `random segment of "${runId}" should be 6 chars`);
  }
});

test('TransmutationRunner — bundle.evidence and result.evidence are the same serialized object', async () => {
  const runner = makeRunner();
  const result = await runner.run('backend', [makeEvidencePlugin()], { sha: 'abc123' });

  // They should be deeply equal (same serialization)
  assert.deepEqual(result.bundle.evidence, result.evidence);
});

test('TransmutationRunner — plugin evidence errors and warnings are forwarded to evidenceMap', async () => {
  const runner = makeRunner();
  const plugin = {
    apiVersion: '1',
    name: 'err-warn-plugin',
    async plan() { return { artifacts: [{ path: 'x.sql' }] }; },
    async generate() {
      return {
        files: { 'x.sql': 'CREATE TABLE ...' },
        evidence: {
          'col:User.id': {
            artifacts: { ddl: { file: 'x.sql', lines: [1, 1], sha: 'abc' } },
            errors: [{ message: 'Missing NOT NULL', type: 'constraint', severity: 'error' }],
            warnings: [{ message: 'Consider adding index', type: 'performance', severity: 'warning' }]
          }
        }
      };
    }
  };

  const result = await runner.run('test', [plugin], {});
  assert.equal(result.success, true);

  // Errors and warnings should appear in serialized evidence
  const evidenceJson = result.evidence;
  assert.ok(evidenceJson.errors['col:User.id'], 'should have errors for col:User.id');
  assert.equal(evidenceJson.errors['col:User.id'].length, 1);
  assert.ok(evidenceJson.warnings['col:User.id'], 'should have warnings for col:User.id');
  assert.equal(evidenceJson.warnings['col:User.id'].length, 1);
});

test('TransmutationRunner — empty plugins array returns success', async () => {
  const runner = makeRunner();
  const result = await runner.run('empty', [], {});
  assert.equal(result.success, true);
  assert.equal(result.totalArtifacts, 0);
  assert.equal(result.results.length, 0);
});
