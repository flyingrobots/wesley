import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { program } from '../src/program.mjs';
import {
  discoverAndRegisterWesleyCliModules,
  loadWesleyCliModuleEntries
} from '../src/framework/module-loader.mjs';

const fixtureModulePath = fileURLToPath(new URL('./fixtures/modules/test-extension-module.mjs', import.meta.url));

function createIo() {
  let stdout = '';
  let stderr = '';

  return {
    stdout: {
      write(chunk) {
        stdout += String(chunk);
      }
    },
    stderr: {
      write(chunk) {
        stderr += String(chunk);
      }
    },
    readStdout() {
      return stdout;
    },
    readStderr() {
      return stderr;
    }
  };
}

test('loadWesleyCliModuleEntries adds env-provided fixture modules without project config', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-config-'));

  try {
    const entries = await loadWesleyCliModuleEntries({
      cwd: tempDir,
      env: {
        WESLEY_MODULES: fixtureModulePath
      },
      defaultSpecifiers: []
    });

    assert.deepEqual(entries, [{ specifier: fixtureModulePath, enabled: true }]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadWesleyCliModuleEntries defaults to no modules when config and env are absent', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-empty-'));

  try {
    const entries = await loadWesleyCliModuleEntries({
      cwd: tempDir,
      env: {}
    });

    assert.deepEqual(entries, []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadWesleyCliModuleEntries loads config-provided modules explicitly', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-explicit-'));

  try {
    const relativeFixturePath = path.relative(tempDir, fixtureModulePath);
    writeFileSync(
      path.join(tempDir, 'wesley.config.mjs'),
      `export default { modules: [${JSON.stringify(relativeFixturePath)}] };\n`
    );

    const entries = await loadWesleyCliModuleEntries({
      cwd: tempDir,
      env: {}
    });

    assert.deepEqual(entries, [{ specifier: fixtureModulePath, enabled: true }]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('program loads CLI commands from a fixture module via WESLEY_MODULES', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-program-'));
  const io = createIo();

  try {
    const exitCode = await program(
      ['node', 'wesley', '--json', 'fixture-hello'],
      {
        cwd: tempDir,
        env: {
          WESLEY_MODULES: fixtureModulePath
        },
        stdout: io.stdout,
        stderr: io.stderr,
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
          child() {
            return this;
          }
        }
      }
    );

    assert.equal(exitCode, 0);
    const payload = JSON.parse(io.readStdout());
    assert.equal(payload.success, true);
    assert.equal(payload.result.kind, 'fixture.hello');
    assert.equal(payload.result.source, 'test-extension-module');
    assert.equal(io.readStderr(), '');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('discoverAndRegisterWesleyCliModules exposes fixture capability registry on ctx', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-capabilities-'));

  try {
    const ctx = {
      cwd: tempDir,
      env: {
        WESLEY_MODULES: fixtureModulePath
      },
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return this;
        }
      }
    };

    const result = await discoverAndRegisterWesleyCliModules({
      ctx,
      cwd: tempDir,
      env: ctx.env,
      logger: ctx.logger
    });
    const registry = result.capabilityRegistry;

    assert.equal(ctx.moduleCapabilityRegistry, registry);
    assert.deepEqual(registry.modules, [
      { name: 'test-extension-module', apiVersion: '1' }
    ]);
    assert.deepEqual(registry.capabilities.wesley.targets, [
      {
        moduleName: 'test-extension-module',
        value: { name: 'fixture-target' }
      }
    ]);
    assert.deepEqual(registry.capabilities.holmes.scopes, [
      {
        moduleName: 'test-extension-module',
        value: { name: 'fixture-scope' }
      }
    ]);
    assert.deepEqual(registry.capabilities.cli.commands, [
      {
        moduleName: 'test-extension-module',
        value: { name: 'fixture-hello' }
      }
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
