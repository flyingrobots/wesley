import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  WARPSPACE_KIND,
  resolveWarpspace,
  resolveWarpspaceOutputFile
} from '../src/utils/warpspace.mjs';

test('resolveWarpspaceOutputFile finds the nearest warpspace and uses default filenames', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-warpspace-'));
  try {
    await mkdir(path.join(tempDir, 'app', 'nested'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'app', 'warpspace.mjs'),
      `export default {
        kind: '${WARPSPACE_KIND}',
        outputs: {
          typescript: 'src/generated/contracts',
          zod: 'src/generated/contracts/zod'
        }
      };
      `
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

test('resolveWarpspace merges .warpspace.local.mjs over the committed file', async () => {
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
    await writeFile(
      path.join(tempDir, '.warpspace.local.mjs'),
      `export default {
        outputs: {
          typescript: 'src/generated/local-contracts'
        }
      };
      `
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
      path.join(tempDir, 'warpspace.mjs'),
      `export default {
        kind: '${WARPSPACE_KIND}',
        outputs: {
          typescript: 'src/generated/contracts'
        }
      };
      `
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
