import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATED_BUNDLE_PATH,
  GENERATED_HISTORY_PATH,
  GENERATED_SCORES_PATH
} from '@wesley/core';
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

function makeGeneratorsWithEvidence() {
  return {
    sql: {
      emitDDL: async (_ir, { outDir } = {}) => ({
        files: [{ name: 'schema.sql', content: '-- ddl\ncreate table users ();' }],
        evidence: {
          'col:User.id': {
            artifacts: {
              sql: {
                file: `${outDir || 'out'}/schema.sql`,
                lines: '2-2'
              }
            }
          }
        }
      }),
      emitRLS: async (_ir, { outDir } = {}) => ({
        files: [{ name: 'rls.sql', content: '-- rls' }],
        evidence: {
          'tbl:User.rls': {
            artifacts: {
              sql: {
                file: `${outDir || 'out'}/rls.sql`,
                lines: '1-1'
              }
            }
          }
        }
      })
    },
    tests: {
      emitPgTap: async (_ir, { outDir } = {}) => ({
        files: [{ name: 'tests.sql', content: '-- tests\nselect plan(1);' }],
        evidence: {
          'tbl:User': {
            artifacts: {
              test: {
                file: `${outDir || 'out'}/tests.sql`,
                lines: '2-2'
              }
            }
          },
          'col:User.id': {
            artifacts: {
              test: {
                file: `${outDir || 'out'}/tests.sql`,
                lines: '2-2'
              }
            }
          },
          'col:User.id.pk': {
            artifacts: {
              test: {
                file: `${outDir || 'out'}/tests.sql`,
                lines: '2-2'
              }
            }
          }
        }
      })
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

test('runSequentialGeneration persists real evidence-backed bundle metadata', async () => {
  const fsWrites = [];
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ({
          tables: [{
            name: 'User',
            fields: [{ name: 'id', type: { base: 'ID', isList: false }, nullable: false, directives: { pk: true } }],
            indexes: [],
            directives: {}
          }]
        })
      }
    },
    generators: makeGeneratorsWithEvidence(),
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
  const scoresWrite = fsWrites.find((entry) => entry.path === GENERATED_SCORES_PATH);
  const historyWrite = fsWrites.find((entry) => entry.path === GENERATED_HISTORY_PATH);
  assert.ok(bundleWrite, 'expected bundle write');
  assert.ok(scoresWrite, 'expected scores write');
  assert.ok(historyWrite, 'expected history write');
  const bundle = JSON.parse(bundleWrite.content);
  const scores = JSON.parse(scoresWrite.content);
  const history = JSON.parse(historyWrite.content);
  assert.equal(bundle.evidence.evidence['col:User.id'].sql[0].lines, '2-2');
  assert.equal(bundle.evidence.evidence['col:User.id'].test[0].lines, '2-2');
  assert.deepEqual(scores.metadata.citationQuality, {
    exact: 4,
    wholeFile: 1,
    coarse: 0
  });
  assert.equal(scores.metadata.evidenceTrust, 'moderate');
  assert.equal(scores.readiness.evidenceTrust, 'moderate');
  assert.equal(history.points.at(-1).evidenceTrust, 'moderate');
  assert.deepEqual(history.points.at(-1).evidenceTrustReasons, [
    '1 whole-file citation still relies on broad file-level proof.'
  ]);
  assert.equal(scores.scores.scs, 1);
  assert.equal(scores.scores.tci, 0.75);
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
