import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  WARPSPACE_KIND,
  resolveWarpspace,
  resolveWarpspaceOutputDir,
  resolveWarpspaceOutputFile
} from '../src/utils/warpspace.mjs';

test('resolveWarpspaceOutputFile finds the nearest warpspace.toml and uses default filenames', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await mkdir(path.join(tempDir, 'app', 'nested'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'app', 'warpspace.toml'),
      [
        'version = 1',
        '',
        '[outputs]',
        'typescript = "src/generated/contracts"',
        'zod = "src/generated/contracts/zod"',
        ''
      ].join('\n')
    );

    const tsPath = await resolveWarpspaceOutputFile({
      outputKey: 'typescript',
      cwd: path.join(tempDir, 'app', 'nested')
    });
    const zodPath = await resolveWarpspaceOutputFile({
      outputKey: 'zod',
      cwd: path.join(tempDir, 'app', 'nested')
    });

    assert.equal(tsPath, path.join(tempDir, 'app', 'src/generated/contracts/types.generated.ts'));
    assert.equal(zodPath, path.join(tempDir, 'app', 'src/generated/contracts/zod/zod.generated.ts'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveWarpspace merges .warpspace.local.toml over the committed file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await writeFile(
      path.join(tempDir, 'warpspace.toml'),
      [
        'version = 1',
        '',
        '[outputs]',
        'typescript = "src/generated/contracts"',
        ''
      ].join('\n')
    );
    await writeFile(
      path.join(tempDir, '.warpspace.local.toml'),
      [
        '[outputs]',
        'typescript = "src/generated/local-contracts"',
        ''
      ].join('\n')
    );

    const warpspace = await resolveWarpspace({ cwd: tempDir });
    assert.ok(warpspace);
    assert.equal(
      warpspace.config.outputs.typescript,
      'src/generated/local-contracts'
    );
    assert.equal(
      await resolveWarpspaceOutputFile({
        outputKey: 'typescript',
        cwd: tempDir
      }),
      path.join(tempDir, 'src/generated/local-contracts/types.generated.ts')
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveWarpspaceOutputFile lets an explicit file override WARPspace defaults', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await writeFile(
      path.join(tempDir, 'warpspace.toml'),
      [
        'version = 1',
        '',
        '[outputs]',
        'typescript = "src/generated/contracts"',
        ''
      ].join('\n')
    );

    const outFile = await resolveWarpspaceOutputFile({
      outputKey: 'typescript',
      explicitOutFile: 'manual/types.ts',
      cwd: tempDir
    });

    assert.equal(outFile, 'manual/types.ts');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveWarpspaceOutputDir resolves multi-file output roots from warpspace.toml aliases', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await mkdir(path.join(tempDir, 'app'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'app', 'warpspace.toml'),
      [
        'version = 1',
        '',
        '[outputs]',
        'echo_ir = "crates/my-app-contracts/src/generated/echo"',
        'warp_ttd = "src/generated/warp-ttd"',
        ''
      ].join('\n')
    );

    const echoDir = await resolveWarpspaceOutputDir({
      outputKeys: ['echo-ir', 'echo'],
      cwd: path.join(tempDir, 'app')
    });
    const ttdDir = await resolveWarpspaceOutputDir({
      outputKeys: ['warp-ttd', 'ttd'],
      cwd: path.join(tempDir, 'app')
    });
    const defaultDir = await resolveWarpspaceOutputDir({
      outputKeys: ['missing'],
      defaultOutDir: 'fallback-out',
      cwd: path.join(tempDir, 'app')
    });

    assert.equal(echoDir, path.join(tempDir, 'app', 'crates/my-app-contracts/src/generated/echo'));
    assert.equal(ttdDir, path.join(tempDir, 'app', 'src/generated/warp-ttd'));
    assert.equal(defaultDir, 'fallback-out');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveWarpspace still supports legacy warpspace.mjs files', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await writeFile(
      path.join(tempDir, 'warpspace.mjs'),
      `export default {
        kind: '${WARPSPACE_KIND}',
        outputs: {
          typescript: 'src/generated/contracts'
        }
      };
      `
    );

    const warpspace = await resolveWarpspace({ cwd: tempDir });
    assert.ok(warpspace);
    assert.equal(warpspace.config.outputs.typescript, 'src/generated/contracts');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
