import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_SUPABASE_TRANSMUTATION,
  LegacySupabaseGeneratorPlugin
} from '../src/transmutations/legacy-supabase.mjs';
import { runSequentialGeneration } from '../src/commands/generate-execution.mjs';

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
  assert.ok(fsWrites.some(entry => entry.path === '.wesley/snapshot.json'));
  assert.equal(context.transmutationRun.transmutation, LEGACY_SUPABASE_TRANSMUTATION);
  assert.equal(compiledOps, true);
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
