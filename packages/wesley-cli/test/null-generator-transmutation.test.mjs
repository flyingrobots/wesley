import test from 'node:test';
import assert from 'node:assert/strict';
import { NullGeneratorPlugin, NULL_GENERATOR_TRANSMUTATION } from '../src/transmutations/null-generator.mjs';
import {
  describeTransmutations,
  getDefaultTransmutationName,
  resolveTransmutationRegistration
} from '../src/transmutations/registry.mjs';
import { runSequentialGeneration } from '../src/commands/generate-execution.mjs';
import { resolveRunMetadata } from '../src/utils/run-metadata.mjs';

const noopLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  }
};

test('null generator plugin plans from IR and explicit emission context', async () => {
  const plugin = new NullGeneratorPlugin();
  const plan = await plugin.plan({
    ir: {
      tables: [{ name: 'User', fields: [{ name: 'id' }] }]
    }
  }, {
    emission: { outDir: 'build/null' }
  });

  assert.equal(plugin.name, NULL_GENERATOR_TRANSMUTATION);
  assert.deepEqual(plan.artifacts, [
    { path: 'null/summary.json', reason: 'Minimal registration-only witness artifact' }
  ]);
  assert.equal(plan.metadata.outDir, 'build/null');
  assert.equal(plan.metadata.tableCount, 1);
  assert.equal(plan.metadata.fieldCount, 1);
});

test('registry resolves null-generator as a registration-only sequential transmutation', () => {
  const registration = resolveTransmutationRegistration(NULL_GENERATOR_TRANSMUTATION);
  assert.equal(registration.name, NULL_GENERATOR_TRANSMUTATION);
  assert.equal(registration.supportsTasksRunner, false);
  assert.deepEqual(registration.requiredGenerators, []);
});

test('registry exposes default transmutation metadata for command surfaces', () => {
  assert.equal(getDefaultTransmutationName(), NULL_GENERATOR_TRANSMUTATION);
  assert.deepEqual(
    describeTransmutations(),
    [
      {
        name: 'null-generator',
        description: 'Minimal registration-only witness transmutation',
        default: true
      }
    ]
  );
  assert.equal(resolveRunMetadata({}).transmutation, NULL_GENERATOR_TRANSMUTATION);
});

test('runSequentialGeneration executes null-generator through the transmutation registry', async () => {
  const writes = [];
  const fsWrites = [];
  const ctx = {
    parsers: {
      graphql: {
        parse: () => ({
          tables: [{ name: 'User', fields: [{ name: 'id', type: { base: 'ID', isList: false }, nullable: false, directives: { pk: true } }], indexes: [], directives: {} }]
        })
      }
    },
    generators: {},
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
    shell: {
      exec: async () => ({ stdout: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n' })
    },
    clock: { now: () => '2026-04-12T12:00:00.000Z' },
    config: { paths: {} }
  };
  const context = {
    schemaContent: 'type User @wes_table { id: ID! @wes_pk }',
    schemaPath: 'schema.graphql',
    options: {
      transmutation: NULL_GENERATOR_TRANSMUTATION,
      outDir: 'out',
      dryRun: false,
      quiet: true,
      json: false,
      emitBundle: false
    },
    logger: noopLogger
  };

  const result = await runSequentialGeneration({
    ctx,
    context
  });

  assert.equal(result.transmutation, NULL_GENERATOR_TRANSMUTATION);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].outDir, 'out');
  assert.deepEqual(writes[0].artifacts.map((file) => file.name), ['null/summary.json']);
  const summary = JSON.parse(String(writes[0].artifacts[0].content));
  assert.equal(summary.transmutation, NULL_GENERATOR_TRANSMUTATION);
  assert.equal(summary.outputDir, 'out');
  assert.equal(summary.tables, 1);
  assert.equal(summary.fields, 1);
  assert.ok(fsWrites.some((entry) => entry.path.includes('snapshot.json')));
});
