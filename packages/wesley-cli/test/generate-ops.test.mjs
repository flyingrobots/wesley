import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryPlan,
  TableNode,
  JoinNode,
  Projection,
  ProjectionItem,
  ColumnRef,
  Predicate
} from '@wesley/core/domain/qir';

import {
  compileOpsIfRequested,
  inferOpsSchemaContext
} from '../src/commands/generate-ops.mjs';

function makePlan(table) {
  return new QueryPlan(
    new TableNode(table, 't0'),
    new Projection([
      new ProjectionItem('id', new ColumnRef('t0', 'id'))
    ]),
    {}
  );
}

function makeMixedJoinPlan({ rootTable, joinedTable }) {
  return new QueryPlan(
    new JoinNode(
      new TableNode(rootTable, 't0'),
      new TableNode(joinedTable, 'j0'),
      'INNER',
      Predicate.compare(new ColumnRef('t0', 'id'), 'eq', new ColumnRef('j0', 'product_id'))
    ),
    new Projection([
      new ProjectionItem('id', new ColumnRef('t0', 'id'))
    ]),
    {}
  );
}

const noopLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  }
};

test('inferOpsSchemaContext: infers a hardened default from IR metadata', () => {
  const schemaContext = inferOpsSchemaContext({
    ir: {
      metadata: {
        schemaName: 'app'
      }
    },
    compiledOps: [
      { plan: makePlan('products') }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'app');
  assert.deepEqual(schemaContext.inferredSchemas, ['app']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops', 'app']);
});

test('inferOpsSchemaContext: preserves explicit search_path overrides while keeping inferred base schema', () => {
  const schemaContext = inferOpsSchemaContext({
    ir: {
      metadata: {
        schemaName: 'app'
      }
    },
    compiledOps: [
      { plan: makePlan('products') }
    ],
    targetSchema: 'wes_ops',
    explicitSearchPath: 'pg_catalog, custom_runtime, wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'app');
  assert.deepEqual(schemaContext.inferredSchemas, ['app']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'custom_runtime', 'wes_ops']);
});

test('inferOpsSchemaContext: keeps multi-schema plans explicit instead of forcing the wrong base schema', () => {
  const schemaContext = inferOpsSchemaContext({
    compiledOps: [
      { plan: makePlan('sales.orders') },
      { plan: makePlan('billing.invoices') }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, null);
  assert.deepEqual(schemaContext.inferredSchemas, ['billing', 'sales']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops', 'billing', 'sales']);
});

test('inferOpsSchemaContext: preserves IR-derived base schema for mixed qualified and unqualified refs', () => {
  const schemaContext = inferOpsSchemaContext({
    ir: {
      metadata: {
        schemaName: 'app'
      }
    },
    compiledOps: [
      {
        plan: makeMixedJoinPlan({
          rootTable: 'products',
          joinedTable: 'audit.product_events'
        })
      }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'app');
  assert.deepEqual(schemaContext.inferredSchemas, ['app', 'audit']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops', 'app', 'audit']);
});

test('inferOpsSchemaContext: preserves a fallback base schema across a mixed batch of qualified and unqualified ops', () => {
  const schemaContext = inferOpsSchemaContext({
    compiledOps: [
      { plan: makePlan('products') },
      { plan: makePlan('audit.product_events') }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'public');
  assert.deepEqual(schemaContext.inferredSchemas, ['audit']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops', 'public', 'audit']);
});

test('inferOpsSchemaContext: falls back to public for mixed refs when no IR schema is available', () => {
  const schemaContext = inferOpsSchemaContext({
    compiledOps: [
      {
        plan: makeMixedJoinPlan({
          rootTable: 'products',
          joinedTable: 'audit.product_events'
        })
      }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'public');
  assert.deepEqual(schemaContext.inferredSchemas, ['audit']);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops', 'public', 'audit']);
});

test('inferOpsSchemaContext: preserves the inferred base schema when tables live in the ops schema', () => {
  const schemaContext = inferOpsSchemaContext({
    ir: {
      metadata: {
        schemaName: 'wes_ops'
      }
    },
    compiledOps: [
      { plan: makePlan('products') }
    ],
    targetSchema: 'wes_ops'
  });

  assert.equal(schemaContext.baseSchema, 'wes_ops');
  assert.deepEqual(schemaContext.inferredSchemas, []);
  assert.deepEqual(schemaContext.searchPath, ['pg_catalog', 'wes_ops']);
});

test('compileOpsIfRequested: emits inferred search_path and schema-qualified base tables from IR metadata', async () => {
  const writes = [];
  const opPath = 'ops/products_by_name.op.json';
  const opJson = JSON.stringify({
    name: 'products_by_name',
    table: 'Product',
    columns: ['id', 'name']
  });
  const ir = {
    metadata: {
      schemaName: 'app'
    },
    tables: [
      {
        name: 'Product',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'name', type: { base: 'String', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      }
    ],
    relationships: []
  };
  const ctx = {
    fs: {
      async exists(path) {
        return path === 'ops' || path === opPath;
      },
      async read(path) {
        if (path === opPath) return opJson;
        throw new Error(`unexpected read: ${path}`);
      },
      async readDir(path) {
        if (path !== 'ops') return [];
        return [
          {
            isDirectory: false,
            isFile: true,
            name: 'products_by_name.op.json',
            path: opPath
          }
        ];
      },
      async join(...parts) {
        return parts.join('/');
      }
    },
    writer: {
      async writeFiles(files, outDir) {
        writes.push({ files, outDir });
      }
    }
  };
  const context = {
    ir,
    options: {
      ops: 'ops',
      outDir: 'out',
      opsSchema: 'wes_ops',
      opsSecurity: 'invoker'
    },
    logger: noopLogger
  };

  await compileOpsIfRequested({ ctx, context });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].outDir, 'out');
  const functionFile = writes[0].files.find((file) => file.name === 'ops/products_by_name.fn.sql');
  assert.ok(functionFile, 'expected function SQL to be emitted');
  assert.match(functionFile.content, /SET search_path = "pg_catalog", "wes_ops", "app"/);
  assert.match(functionFile.content, /FROM "app"\."products" "t0"/);
});
