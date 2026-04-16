import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';

import { NodeFileSystem } from '../src/adapters/NodeFileSystem.mjs';
import { nodeCrypto } from '../src/adapters/NodeCrypto.mjs';
import { initWarpspace } from '../src/warpspace/init.mjs';

test('initWarpspace materializes a family, writes warpspace.toml, and infers authority root', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-init-'));
  const authorityRoot = path.join(tempDir, 'continuum');
  const projectDir = path.join(tempDir, 'app');
  const schemaPath = path.join(authorityRoot, 'schemas', 'continuum-neighborhood-core-family.graphql');
  const manifestPath = path.join(authorityRoot, 'docs', 'releases', 'demo', 'continuum-stack-release.json');
  const schemaContent = 'type Query { ok: Boolean! }\n';

  try {
    await mkdir(path.join(authorityRoot, '.git'), { recursive: true });
    await mkdir(path.dirname(schemaPath), { recursive: true });
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(schemaPath, schemaContent);
    await writeFile(
      manifestPath,
      JSON.stringify({
        kind: 'continuum.stack-release.v1',
        profile: 'demo',
        releaseId: 'demo-test',
        status: 'proposed',
        deliveryMode: 'local-sibling-proof',
        families: [
          {
            id: 'continuum-neighborhood-core-family',
            version: '0.1.0',
            sourcePath: 'schemas/continuum-neighborhood-core-family.graphql',
            sha256: nodeCrypto.sha256(schemaContent),
            materializeTo: 'contracts/continuum/continuum-neighborhood-core-family.graphql',
            defaultProjections: ['typescript', 'zod']
          }
        ],
        toolchain: {
          wesley: {
            package: '@wesley/host-node',
            version: '0.1.0'
          }
        },
        runtimes: {
          echo: { crate: 'warp-core', version: '0.1.1' }
        },
        bootstrap: {
          tool: 'warpspace',
          defaultOutputs: {
            typescript: 'packages/app/src/generated/continuum',
            zod: 'packages/app/src/generated/continuum/zod'
          }
        }
      }, null, 2) + '\n'
    );

    const result = await initWarpspace({
      ctx: { fs: new NodeFileSystem(), crypto: nodeCrypto },
      manifestPath,
      projectDir,
      generate: false,
      now: () => new Date('2026-04-16T01:40:00.000Z')
    });

    assert.equal(result.authorityRoot, authorityRoot);
    assert.equal(result.generated, false);

    const materialized = await readFile(
      path.join(projectDir, 'contracts', 'continuum', 'continuum-neighborhood-core-family.graphql'),
      'utf8'
    );
    assert.equal(materialized, schemaContent);

    const warpspaceToml = await readFile(path.join(projectDir, 'warpspace.toml'), 'utf8');
    assert.match(warpspaceToml, /^version = 1$/m);
    assert.match(
      warpspaceToml,
      /^source = "contracts\/continuum\/continuum-neighborhood-core-family\.graphql"$/m
    );

    const lock = JSON.parse(await readFile(path.join(projectDir, 'warpspace.lock.json'), 'utf8'));
    assert.equal(lock.kind, 'warpspace.lock.v1');
    assert.equal(lock.releaseId, 'demo-test');
    assert.equal(lock.manifest.sha256, nodeCrypto.sha256(await readFile(manifestPath, 'utf8')));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('initWarpspace runs Wesley generation commands for the selected projections', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-init-'));
  const authorityRoot = path.join(tempDir, 'continuum');
  const projectDir = path.join(tempDir, 'app');
  const schemaPath = path.join(authorityRoot, 'schemas', 'continuum-neighborhood-core-family.graphql');
  const manifestPath = path.join(authorityRoot, 'docs', 'releases', 'demo', 'continuum-stack-release.json');
  const schemaContent = 'type Query { ok: Boolean! }\n';
  const invocations = [];

  try {
    await mkdir(path.join(authorityRoot, '.git'), { recursive: true });
    await mkdir(path.dirname(schemaPath), { recursive: true });
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(schemaPath, schemaContent);
    await writeFile(
      manifestPath,
      JSON.stringify({
        kind: 'continuum.stack-release.v1',
        profile: 'demo',
        releaseId: 'demo-test',
        families: [
          {
            id: 'continuum-neighborhood-core-family',
            version: '0.1.0',
            sourcePath: 'schemas/continuum-neighborhood-core-family.graphql',
            sha256: nodeCrypto.sha256(schemaContent),
            materializeTo: 'contracts/continuum/continuum-neighborhood-core-family.graphql',
            defaultProjections: ['typescript', 'zod', 'echo-ir', 'warp-ttd']
          }
        ],
        toolchain: {
          wesley: {
            package: '@wesley/host-node',
            version: '0.1.0'
          }
        },
        bootstrap: {
          tool: 'warpspace',
          defaultOutputs: {
            typescript: 'packages/app/src/generated/continuum',
            zod: 'packages/app/src/generated/continuum/zod',
            'echo-ir': 'crates/app-contracts/src/generated/echo',
            'warp-ttd': 'packages/app/src/generated/warp-ttd'
          }
        }
      }, null, 2) + '\n'
    );

    const result = await initWarpspace({
      ctx: { fs: new NodeFileSystem(), crypto: nodeCrypto },
      manifestPath,
      projectDir,
      runCommand: async ({ command, args, cwd }) => {
        invocations.push({ command, args, cwd });
        return {
          status: 0,
          stdout: JSON.stringify({ success: true, result: { ok: true, args } }),
          stderr: ''
        };
      }
    });

    assert.equal(result.generatedCommands.length, 4);
    assert.deepEqual(
      invocations.map(call => call.args.slice(1, 3)),
      [
        ['typescript', '--schema'],
        ['zod', '--schema'],
        ['bundle-echo', '--schema'],
        ['compile-ttd', '--schema']
      ]
    );
    assert.ok(invocations.every(call => call.cwd === projectDir));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
