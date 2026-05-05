import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  WESLEY_ENV_DISABLE_MODULES,
  WESLEY_ENV_CONFIG,
  WESLEY_ENV_MODULE_ALLOWLIST,
  WESLEY_ENV_MODULES,
  loadWesleyModuleEntries,
  parseWesleyEnvModuleEntries,
  parseWesleyModuleAllowlist
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

test('WESLEY_MODULES preserves file URLs when splitting path-delimited entries', async () => withTempDir(async (tempDir) => {
  const firstModule = path.join(tempDir, 'first-module.mjs');
  const secondModule = path.join(tempDir, 'second-module.mjs');
  const firstUrl = pathToFileURL(firstModule).href;
  const secondUrl = pathToFileURL(secondModule).href;

  const entries = parseWesleyEnvModuleEntries(
    [firstUrl, secondUrl].join(delimiter),
    tempDir
  );
  const allowlist = parseWesleyModuleAllowlist(
    [firstUrl, secondUrl].join(delimiter),
    tempDir
  );

  assert.deepEqual(entries, [
    { specifier: firstModule, enabled: true },
    { specifier: secondModule, enabled: true }
  ]);
  assert.deepEqual([...allowlist], [firstModule, secondModule]);
}));

test('explicit missing WESLEY_CONFIG fails loudly', async () => withTempDir(async (tempDir) => {
  const missingConfig = path.join(tempDir, 'missing-wesley.config.mjs');

  await assert.rejects(
    () => loadWesleyModuleEntries({
      cwd: tempDir,
      env: { [WESLEY_ENV_CONFIG]: missingConfig }
    }),
    (error) => {
      assert.equal(error.code, 'WESLEY_CONFIG_NOT_FOUND');
      assert.equal(error.meta.resolvedPath, missingConfig);
      assert.match(error.message, /WESLEY_CONFIG points to/);
      return true;
    }
  );
}));

test('WESLEY_MODULE_ALLOWLIST ignores disabled module entries', async () => withTempDir(async (tempDir) => {
  const configPath = path.join(tempDir, 'wesley.config.mjs');
  const disabledModule = path.join(tempDir, 'disabled-module.mjs');
  writeFileSync(
    configPath,
    'export default { modules: [{ specifier: "./disabled-module.mjs", enabled: false }] };\n'
  );

  const entries = await loadWesleyModuleEntries({
    cwd: tempDir,
    env: { [WESLEY_ENV_MODULE_ALLOWLIST]: configPath }
  });

  assert.deepEqual(entries, [{ specifier: disabledModule, enabled: false }]);
}));
