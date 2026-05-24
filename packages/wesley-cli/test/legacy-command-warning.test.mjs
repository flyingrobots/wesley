import test from 'node:test';
import assert from 'node:assert/strict';

import { program } from '../src/program.mjs';

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

function createContext(io) {
  return {
    cwd: process.cwd(),
    env: {
      WESLEY_DISABLE_MODULES: '1',
      WESLEY_MODULES: '',
      WESLEY_CONFIG: '',
      WESLEY_MODULE_ALLOWLIST: ''
    },
    stdout: io.stdout,
    stderr: io.stderr
  };
}

test('legacy Node commands warn when a native replacement exists', async () => {
  const io = createIo();

  const exitCode = await program(['node', 'wesley', 'diff'], createContext(io));

  assert.notEqual(exitCode, 0);
  assert.match(io.readStderr(), /legacy Node command `diff` is compatibility-only/);
  assert.match(io.readStderr(), /wesley schema diff --old <old\.graphql> --new <new\.graphql>/);
});

test('legacy command warnings do not pollute JSON mode', async () => {
  const io = createIo();

  const exitCode = await program(['node', 'wesley', '--json', 'diff'], createContext(io));

  assert.notEqual(exitCode, 0);
  assert.doesNotMatch(io.readStderr(), /legacy Node command/);
});
