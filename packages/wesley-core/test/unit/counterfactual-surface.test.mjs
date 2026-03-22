import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  collectCounterfactualSurfaceModel,
  ensureCounterfactualWorkspaceArtifacts
} from '../../src/index.mjs';

test('counterfactual surface use cases build workspace artifacts and node specs through injected ports', async () => {
  const workspaceDir = '/repo';
  const files = new Map();
  const dirs = new Set([workspaceDir]);

  writeFile(files, dirs, path.join(workspaceDir, 'schema.graphql'), [
    'type User @wes_table {',
    '  id: ID! @wes_pk',
    '  email: String! @wes_unique',
    '}',
    ''
  ].join('\n'));

  const port = {
    async exists(targetPath) {
      return files.has(targetPath) || dirs.has(targetPath);
    },
    async mkdir(targetPath) {
      ensureDir(dirs, targetPath);
    },
    async readText(targetPath) {
      if (!files.has(targetPath)) throw new Error(`Missing text file: ${targetPath}`);
      return files.get(targetPath);
    },
    async readFile(targetPath) {
      if (!files.has(targetPath)) throw new Error(`Missing file: ${targetPath}`);
      return Buffer.from(files.get(targetPath), 'utf8');
    },
    async writeText(targetPath, content) {
      writeFile(files, dirs, targetPath, String(content));
    },
    async listFilesRecursive(root) {
      return Array.from(files.keys())
        .filter(candidate => candidate.startsWith(`${root}${path.sep}`))
        .sort();
    },
    hashContent(content) {
      return createHash('sha256').update(content).digest('hex');
    },
    resolvePath(...segments) {
      return path.resolve(...segments);
    },
    joinPath(...segments) {
      return path.join(...segments);
    },
    relativePath(from, to) {
      return path.relative(from, to);
    },
    dirname(targetPath) {
      return path.dirname(targetPath);
    },
    isAbsolute(targetPath) {
      return path.isAbsolute(targetPath);
    },
    parseSDL() {
      return {
        version: '1.0.0',
        metadata: { generatedAt: '2026-03-22T00:00:00.000Z' },
        tables: [{
          name: 'User',
          directives: { table: true },
          fields: [
            {
              name: 'id',
              type: { base: 'ID', isList: false },
              nullable: false,
              directives: { pk: true }
            },
            {
              name: 'email',
              type: { base: 'String', isList: false },
              nullable: false,
              directives: { unique: true }
            }
          ],
          indexes: [],
          constraints: []
        }],
        enums: [],
        scalars: [],
        relationships: []
      };
    },
    async emitDDL() {
      return {
        files: [{
          name: 'schema.sql',
          content: 'CREATE TABLE IF NOT EXISTS "User" ("id" text primary key, "email" text not null unique);\n'
        }],
        evidence: {
          'artifact:out/schema.sql': {
            artifacts: {
              sql: { file: 'out/schema.sql', lines: '1-1' }
            }
          }
        }
      };
    },
    async emitRLS() {
      return {
        files: [],
        evidence: {}
      };
    },
    async emitPgTap() {
      return {
        files: [{
          name: 'tests.sql',
          content: 'SELECT plan(1);\n'
        }],
        evidence: {
          'artifact:out/tests.sql': {
            artifacts: {
              test: { file: 'out/tests.sql', lines: '1-1' }
            }
          }
        }
      };
    }
  };

  const created = await ensureCounterfactualWorkspaceArtifacts({
    workspaceDir,
    bundleDir: '.wesley-cache',
    outDir: 'out',
    schemaPath: 'schema.graphql',
    sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    transmutation: 'legacy-supabase'
  }, port);

  assert.equal(created, true);
  assert.ok(files.has(path.join(workspaceDir, '.wesley-cache', 'bundle.json')));
  assert.ok(files.has(path.join(workspaceDir, '.wesley-cache', 'plan-report.json')));
  assert.ok(files.has(path.join(workspaceDir, 'out', 'schema.sql')));

  const model = await collectCounterfactualSurfaceModel({
    workspaceDir,
    sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    surface: {
      bundleDir: '.wesley-cache',
      outDir: 'out',
      schemaPath: 'schema.graphql',
      transmutation: 'legacy-supabase'
    }
  }, port);

  assert.equal(model.summary.evidenceCount, 1);
  assert.equal(model.summary.planCount, 1);
  assert.equal(model.summary.realmCount, 0);
  assert.ok(model.summary.artifactCount >= 2);
  assert.ok(model.nodeSpecs.some(spec => spec.id === 'evidence:bundle'));
  assert.ok(model.nodeSpecs.some(spec => spec.id === 'plan:report'));
  assert.ok(model.nodeSpecs.some(spec => spec.id === 'artifact:out/schema.sql'));

  const bundle = JSON.parse(files.get(path.join(workspaceDir, '.wesley-cache', 'bundle.json')));
  assert.equal(bundle.bundleVersion, '2.0.0');
  assert.equal(bundle.evidence.evidence['artifact:out/schema.sql'].sql[0].file, 'out/schema.sql');
});

function writeFile(files, dirs, targetPath, content) {
  ensureDir(dirs, path.dirname(targetPath));
  files.set(targetPath, content);
}

function ensureDir(dirs, targetPath) {
  let current = targetPath;
  while (current && !dirs.has(current)) {
    dirs.add(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
