import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERATED_BUNDLE_PATH } from '@wesley/core';
import {
  LEGACY_SUPABASE_TRANSMUTATION,
  LegacySupabaseGeneratorPlugin
} from '../src/transmutations/legacy-supabase.mjs';
import { runSequentialGeneration } from '../src/commands/generate-execution.mjs';
import { SNAPSHOT_PROJECTION_PATH } from '../src/utils/runtime-projections.mjs';

const noopLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  }
};

function makeGenerators() {
  return {
    sql: {
      emitDDL: () => ({ files: [{ name: 'schema.sql', content: '-- ddl' }] }),
      emitRLS: () => ({ files: [{ name: 'rls.sql', content: '-- rls' }] })
    },
    tests: {
      emitPgTap: () => ({ files: [{ name: 'tests.sql', content: '-- tests' }] })
    }
  };
}

test('legacy supabase plugin plans only the current artifact set', async () => {
  const plugin = new LegacySupabaseGeneratorPlugin({
    generators: makeGenerators(),
    enableRls: true
  });
  const plan = await plugin.plan({
    ir: {
      tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
    }
  });

  assert.equal(plugin.name, LEGACY_SUPABASE_TRANSMUTATION);
  assert.deepEqual(
    plan.artifacts.map(entry => entry.path),
    ['schema.sql', 'rls.sql', 'tests.sql']
  );
});

test('runSequentialGeneration executes the legacy supabase transmutation by default', async () => {
  const writes = [];
  const fsWrites = [];
  let compiledOps = false;
  const ir = {
    tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
  };
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ir
      }
    },
    generators: makeGenerators(),
    writer: {
      writeFiles: async (artifacts, outDir) => {
        writes.push({ artifacts, outDir });
      }
    },
    fs: {
      write: async (path, content) => {
        fsWrites.push({ path, content });
      }
    },
    stderr: { write() {} },
    stdout: { write() {} },
    clock: { now: () => '2026-03-18T12:00:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      outDir: 'out',
      supabase: true,
      dryRun: false,
      quiet: true,
      json: false,
      emitBundle: false
    },
    logger: noopLogger
  };

  const result = await runSequentialGeneration({
    ctx,
    context,
    compileOpsIfRequested: async () => {
      compiledOps = true;
    }
  });

  assert.equal(result.transmutation, LEGACY_SUPABASE_TRANSMUTATION);
  assert.match(result.runId, /^run-/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].outDir, 'out');
  assert.deepEqual(
    writes[0].artifacts.map(file => file.name),
    ['schema.sql', 'rls.sql', 'tests.sql']
  );
  assert.ok(fsWrites.some(entry => entry.path === SNAPSHOT_PROJECTION_PATH));
  assert.equal(context.transmutationRun.transmutation, LEGACY_SUPABASE_TRANSMUTATION);
  assert.ok(Array.isArray(context.transmutationRun.events));
  assert.equal(compiledOps, true);
});

test('runSequentialGeneration emits structured lifecycle events', async () => {
  const ir = {
    tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
  };
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ir
      }
    },
    generators: makeGenerators(),
    writer: {
      writeFiles: async () => {}
    },
    fs: {
      write: async () => {}
    },
    stderr: { write() {} },
    stdout: { write() {} },
    clock: { now: () => '2026-03-19T09:45:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      outDir: 'out',
      supabase: true,
      dryRun: false,
      quiet: true,
      json: false,
      emitBundle: false,
      runId: 'run-events-123'
    },
    logger: noopLogger
  };

  const result = await runSequentialGeneration({
    ctx,
    context,
    compileOpsIfRequested: async () => {}
  });

  assert.deepEqual(
    result.events.map(event => event.type),
    [
      'RunRequested',
      'SourcesResolved',
      'IRParsed',
      'TaskGraphBuilt',
      'TaskStarted',
      'TaskCompleted',
      'EvidenceMerged',
      'ScoresComputed',
      'ArtifactsMaterialized',
      'RunCompleted'
    ]
  );
  assert.deepEqual(
    result.events.map(event => event.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  result.events.forEach(event => {
    assert.equal(event.runId, 'run-events-123');
    assert.equal(event.transmutation, LEGACY_SUPABASE_TRANSMUTATION);
    assert.equal(event.streamId, `transmutation:${LEGACY_SUPABASE_TRANSMUTATION}:run-events-123`);
  });
});

test('runSequentialGeneration preserves a caller-supplied runId', async () => {
  const ir = {
    tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
  };
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ir
      }
    },
    generators: makeGenerators(),
    writer: {
      writeFiles: async () => {}
    },
    fs: {
      write: async () => {}
    },
    stderr: { write() {} },
    stdout: { write() {} },
    clock: { now: () => '2026-03-18T12:00:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      outDir: 'out',
      supabase: false,
      dryRun: false,
      quiet: true,
      json: false,
      emitBundle: false,
      runId: 'run-cli-123'
    },
    logger: noopLogger
  };

  const result = await runSequentialGeneration({
    ctx,
    context,
    compileOpsIfRequested: async () => {}
  });

  assert.equal(result.runId, 'run-cli-123');
  assert.equal(context.transmutationRun.runId, 'run-cli-123');
});

test('runSequentialGeneration emits exact whole-file spans in the placeholder bundle', async () => {
  const fsWrites = [];
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ({
          tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
        })
      }
    },
    generators: {
      sql: {
        emitDDL: () => ({ files: [{ name: 'schema.sql', content: '-- ddl\ncreate table users ();' }] }),
        emitRLS: () => ({ files: [{ name: 'rls.sql', content: '-- rls' }] })
      },
      tests: {
        emitPgTap: () => ({ files: [{ name: 'tests.sql', content: '-- tests\nselect plan(1);' }] })
      }
    },
    writer: {
      writeFiles: async () => {}
    },
    fs: {
      write: async (targetPath, content) => {
        fsWrites.push({ path: targetPath, content });
      }
    },
    stderr: { write() {} },
    stdout: { write() {} },
    shell: {
      exec: async () => ({ stdout: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n' })
    },
    clock: { now: () => '2026-03-18T12:00:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      outDir: 'out',
      supabase: true,
      dryRun: false,
      quiet: true,
      json: false,
      emitBundle: true
    },
    logger: noopLogger
  };

  await runSequentialGeneration({
    ctx,
    context,
    compileOpsIfRequested: async () => {}
  });

  const bundleWrite = fsWrites.find((entry) => entry.path === GENERATED_BUNDLE_PATH);
  assert.ok(bundleWrite, 'expected placeholder bundle write');
  const bundle = JSON.parse(bundleWrite.content);
  assert.equal(bundle.evidence.evidence.schema.sql[0].lines, '1-2');
  assert.equal(bundle.evidence.evidence.schema.tests[0].lines, '1-2');
});

test('runSequentialGeneration keeps dry-run side effects disabled', async () => {
  const writes = [];
  let compiledOps = false;
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ({
          tables: [{ name: 'User', fields: [], indexes: [], directives: {} }]
        })
      }
    },
    generators: makeGenerators(),
    writer: {
      writeFiles: async (artifacts, outDir) => {
        writes.push({ artifacts, outDir });
      }
    },
    fs: {
      write: async () => {
        throw new Error('dry-run should not write snapshot state');
      }
    },
    stderr: { write() {} },
    stdout: { write() {} },
    clock: { now: () => '2026-03-18T12:00:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      outDir: 'out',
      supabase: false,
      dryRun: true,
      quiet: true,
      json: false,
      emitBundle: false
    },
    logger: noopLogger
  };

  const result = await runSequentialGeneration({
    ctx,
    context,
    compileOpsIfRequested: async () => {
      compiledOps = true;
    }
  });

  assert.equal(result.transmutation, LEGACY_SUPABASE_TRANSMUTATION);
  assert.equal(writes.length, 0);
  assert.equal(compiledOps, false);
});
