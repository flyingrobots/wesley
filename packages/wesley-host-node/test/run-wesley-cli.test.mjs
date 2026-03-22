import test from 'node:test';
import assert from 'node:assert/strict';

import { runWesleyCli } from '../src/runWesleyCli.mjs';

test('runWesleyCli injects runtime context without ambient globals', async () => {
  const originalCtx = globalThis.wesleyCtx;
  delete globalThis.wesleyCtx;

  const runtime = { name: 'ctx' };
  let receivedArgv = null;
  let receivedCtx = null;
  let exitCode = null;

  try {
    const result = await runWesleyCli({
      argv: ['node', 'wesley', 'doctor'],
      createRuntime: async () => runtime,
      runProgram: async (argv, ctx) => {
        receivedArgv = argv;
        receivedCtx = ctx;
        return 17;
      },
      exit: async (code) => {
        exitCode = code;
      },
      errorSink: async () => {}
    });

    assert.equal(result, 17);
    assert.equal(exitCode, 17);
    assert.deepEqual(receivedArgv, ['node', 'wesley', 'doctor']);
    assert.strictEqual(receivedCtx, runtime);
    assert.equal('wesleyCtx' in globalThis, false);
  } finally {
    if (originalCtx === undefined) delete globalThis.wesleyCtx;
    else globalThis.wesleyCtx = originalCtx;
  }
});

test('runWesleyCli reports startup failures through injected sinks', async () => {
  let exitCode = null;
  let sinkMessage = null;

  const result = await runWesleyCli({
    createRuntime: async () => {
      throw new Error('boom');
    },
    runProgram: async () => 0,
    exit: async (code) => {
      exitCode = code;
    },
    errorSink: async (message) => {
      sinkMessage = String(message);
    }
  });

  assert.equal(result, 1);
  assert.equal(exitCode, 1);
  assert.match(sinkMessage, /boom/);
});
