import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { program } from '../src/program.mjs';
import {
  loadWesleyCliModuleEntries,
  resolveDefaultWesleyModuleSpecifiers
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

test('resolveDefaultWesleyModuleSpecifiers prefers the foreign Continuum module when present', () => {
  const preferred = resolveDefaultWesleyModuleSpecifiers({
    exists(pathname) {
      return pathname.endsWith('/continuum/wesley/continuum-cli-module.mjs');
    }
  });

  assert.deepEqual(preferred, [
    '/Users/james/git/continuum/wesley/continuum-cli-module.mjs'
  ]);
});

test('resolveDefaultWesleyModuleSpecifiers falls back to the Wesley bootstrap module when foreign module is absent', () => {
  const preferred = resolveDefaultWesleyModuleSpecifiers({
    exists() {
      return false;
    }
  });

  assert.equal(preferred.length, 1);
  assert.match(preferred[0], /packages\/wesley-cli\/src\/modules\/continuum\.mjs$/);
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
