import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';
import path from 'node:path';

import {
  WESLEY_ENV_DISABLE_MODULES,
  WESLEY_ENV_MODULE_ALLOWLIST,
  WESLEY_ENV_MODULES,
  loadWesleyModuleEntries
} from '../src/index.mjs';

async function withTempDir(fn) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-module-loader-'));
  try {
    return await fn(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('WESLEY_DISABLE_MODULES prevents config and env module loading', async () => withTempDir(async (tempDir) => {
  writeFileSync(
    path.join(tempDir, 'wesley.config.mjs'),
    'throw new Error("config should not be imported when modules are disabled");'
  );

  const entries = await loadWesleyModuleEntries({
    cwd: tempDir,
    env: {
      [WESLEY_ENV_DISABLE_MODULES]: '1',
      [WESLEY_ENV_MODULES]: './module.mjs'
    }
  });

  assert.deepEqual(entries, []);
}));

test('WESLEY_MODULE_ALLOWLIST rejects non-allowlisted config before import', async () => withTempDir(async (tempDir) => {
  const allowedModule = path.join(tempDir, 'allowed-module.mjs');
  writeFileSync(
    path.join(tempDir, 'wesley.config.mjs'),
    'throw new Error("config import should be blocked by allowlist");'
  );

  await assert.rejects(
    () => loadWesleyModuleEntries({
      cwd: tempDir,
      env: { [WESLEY_ENV_MODULE_ALLOWLIST]: allowedModule }
    }),
    (error) => {
      assert.equal(error.code, 'WESLEY_MODULE_NOT_ALLOWLISTED');
      assert.match(error.message, /config/);
      return true;
    }
  );
}));

test('WESLEY_MODULE_ALLOWLIST rejects non-allowlisted env modules', async () => withTempDir(async (tempDir) => {
  const modulePath = path.join(tempDir, 'module.mjs');
  const allowedModule = path.join(tempDir, 'allowed-module.mjs');

  await assert.rejects(
    () => loadWesleyModuleEntries({
      cwd: tempDir,
      env: {
        [WESLEY_ENV_MODULES]: modulePath,
        [WESLEY_ENV_MODULE_ALLOWLIST]: allowedModule
      }
    }),
    (error) => {
      assert.equal(error.code, 'WESLEY_MODULE_NOT_ALLOWLISTED');
      assert.match(error.message, /module/);
      return true;
    }
  );
}));

test('WESLEY_MODULE_ALLOWLIST permits allowlisted config and module paths', async () => withTempDir(async (tempDir) => {
  const configPath = path.join(tempDir, 'wesley.config.mjs');
  const modulePath = path.join(tempDir, 'module.mjs');
  writeFileSync(configPath, 'export default { modules: ["./module.mjs"] };');

  const entries = await loadWesleyModuleEntries({
    cwd: tempDir,
    env: { [WESLEY_ENV_MODULE_ALLOWLIST]: [configPath, modulePath].join(delimiter) }
  });

  assert.deepEqual(entries, [{ specifier: modulePath, enabled: true }]);
}));
