import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GeneratorPlugin,
  validatePlugin,
  validatePlan,
  SUPPORTED_API_VERSIONS,
} from '../../src/ports/GeneratorPlugin.mjs';
import { PluginRunner } from '../../src/application/PluginRunner.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture a thrown error for assertion. */
function catchError(fn) {
  try { fn(); } catch (e) { return e; }
  throw new Error('Expected function to throw');
}

/** Capture a rejected promise for assertion. */
async function catchReject(fn) {
  try { await fn(); } catch (e) { return e; }
  throw new Error('Expected promise to reject');
}

/** Minimal valid plain-object plugin */
function makePlugin(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'test-plugin',
    init() {},
    async plan() {
      return { artifacts: [{ path: 'out.txt', reason: 'test' }] };
    },
    async generate() {
      return { 'out.txt': 'hello' };
    },
    ...overrides,
  };
}

/** Minimal class-based plugin extending GeneratorPlugin */
class GoodPlugin extends GeneratorPlugin {
  get apiVersion() { return '1'; }
  get name() { return 'good'; }
  async plan() { return { artifacts: [{ path: 'a.txt' }] }; }
  async generate() { return { 'a.txt': 'ok' }; }
}

/** No-op logger for test use */
const nullLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() { return nullLogger; },
  setLevel() {},
  async flush() {},
};

/** Collecting logger that stores warn calls */
function collectingLogger() {
  const warnings = [];
  const logger = {
    info() {},
    warn(...args) { warnings.push(args); },
    error() {},
    debug() {},
    child() { return logger; },
    setLevel() {},
    async flush() {},
  };
  return { logger, warnings };
}

const fakeClock = { now() { return '2025-01-01T00:00:00.000Z'; } };

function makeRunner(overrides = {}) {
  return new PluginRunner({
    logger: nullLogger,
    clock: fakeClock,
    config: {},
    ...overrides,
  });
}

// ===========================================================================
// validatePlugin
// ===========================================================================

test('validatePlugin — accepts valid plain-object plugin', () => {
  assert.doesNotThrow(() => validatePlugin(makePlugin()));
});

test('validatePlugin — accepts class instance extending GeneratorPlugin', () => {
  assert.doesNotThrow(() => validatePlugin(new GoodPlugin()));
});

test('validatePlugin — rejects null (WPLY001)', () => {
  const err = catchError(() => validatePlugin(null));
  assert.equal(err.code, 'WPLY001');
});

test('validatePlugin — rejects missing apiVersion (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ apiVersion: undefined })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /apiVersion/);
});

test('validatePlugin — rejects numeric apiVersion 1 with actionable error (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ apiVersion: 1 })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /string/);
  assert.match(err.message, /apiVersion: "1"/);
});

test('validatePlugin — rejects semver-like apiVersion "1.0" (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ apiVersion: '1.0' })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /"1\.0"/);
});

test('validatePlugin — rejects unsupported apiVersion "99" — includes plugin name (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ apiVersion: '99', name: 'foo' })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /"foo"/);
  assert.match(err.message, /"99"/);
  assert.match(err.message, /\["1"\]/);
});

test('validatePlugin — rejects empty name (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ name: '' })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /name/i);
});

test('validatePlugin — rejects whitespace-only name (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ name: '   ' })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /whitespace/i);
});

test('validatePlugin — rejects non-function plan (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ plan: 'not-a-fn' })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /plan/);
});

test('validatePlugin — rejects non-function generate (WPLY001)', () => {
  const err = catchError(() => validatePlugin(makePlugin({ generate: null })));
  assert.equal(err.code, 'WPLY001');
  assert.match(err.message, /generate/);
});

// ===========================================================================
// validatePlan
// ===========================================================================

test('validatePlan — accepts valid plan with artifacts array', () => {
  assert.doesNotThrow(() => validatePlan({
    artifacts: [{ path: 'a.txt' }, { path: 'b.txt', reason: 'test', binary: true }],
  }));
});

test('validatePlan — rejects null plan (WPLY004)', () => {
  const err = catchError(() => validatePlan(null, 'test'));
  assert.equal(err.code, 'WPLY004');
});

test('validatePlan — rejects plan without artifacts array (WPLY004)', () => {
  const err = catchError(() => validatePlan({ artifacts: 'nope' }, 'test'));
  assert.equal(err.code, 'WPLY004');
  assert.match(err.message, /artifacts/);
});

test('validatePlan — rejects plan with artifact missing path (WPLY004)', () => {
  const err = catchError(() => validatePlan({ artifacts: [{ reason: 'no path' }] }, 'test'));
  assert.equal(err.code, 'WPLY004');
  assert.match(err.message, /path/);
});

// ===========================================================================
// PluginRunner
// ===========================================================================

test('PluginRunner — golden path: runs plugin, returns artifacts with ok status', async () => {
  const runner = makeRunner();
  const plugin = makePlugin();
  const result = await runner.run([plugin], { sdl: 'type Query { hello: String }' });

  assert.equal(result.success, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, 'ok');
  assert.equal(result.results[0].name, 'test-plugin');
  assert.equal(result.results[0].artifactCount, 1);
  assert.deepEqual(result.results[0].artifacts, { 'out.txt': 'hello' });
  assert.equal(result.totalArtifacts, 1);
  assert.ok(result.runId.startsWith('run-'));
});

test('PluginRunner — error isolation: failing plugin produces error result with phase', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    async plan() { throw new Error('boom'); },
  });

  const err = await catchReject(() => runner.run([plugin], {}));
  assert.equal(err.code, 'WPLY002');
  assert.equal(err.phase, 'plan');
  assert.ok(Array.isArray(err.pluginResults));
  assert.equal(err.pluginResults[0].status, 'error');
  assert.equal(err.pluginResults[0].phase, 'plan');
});

test('PluginRunner — best-effort: continues after failure, success=true if at least one ok', async () => {
  const runner = makeRunner({ bestEffort: true });
  const failing = makePlugin({
    name: 'fail-plugin',
    async plan() { throw new Error('boom'); },
  });
  const good = makePlugin({ name: 'good-plugin' });

  const result = await runner.run([failing, good], {});
  assert.equal(result.success, true);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].name, 'fail-plugin');
  assert.equal(result.results[1].status, 'ok');
  assert.equal(result.results[1].name, 'good-plugin');
});

test('PluginRunner — bad return type from generate() → WPLY003', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    async generate() { return 'not-an-object'; },
  });

  const err = await catchReject(() => runner.run([plugin], {}));
  assert.equal(err.code, 'WPLY003');
});

test('PluginRunner — bad plan return → WPLY004', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    async plan() { return null; },
  });

  const err = await catchReject(() => runner.run([plugin], {}));
  assert.equal(err.code, 'WPLY004');
});

test('PluginRunner — per-plugin timing in results', async () => {
  const runner = makeRunner();
  const plugin = makePlugin();
  const result = await runner.run([plugin], {});

  assert.equal(typeof result.results[0].durationMs, 'number');
  assert.ok(result.results[0].durationMs >= 0);
});

test('PluginRunner — context is frozen (plugin cannot mutate it)', async () => {
  const runner = makeRunner({ config: { key: 'value' } });
  let capturedContext;

  const plugin = makePlugin({
    async plan(schema, context) {
      capturedContext = context;
      assert.throws(() => { context.runId = 'hacked'; }, TypeError);
      assert.throws(() => { context.config.key = 'hacked'; }, TypeError);
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() { return { 'out.txt': 'ok' }; },
  });

  const result = await runner.run([plugin], {});
  assert.equal(result.success, true);
  assert.ok(capturedContext);
  assert.equal(capturedContext.config.key, 'value');
});

test('PluginRunner — determinism: same plugin + schema → identical artifacts', async () => {
  const runner = makeRunner();
  let callCount = 0;
  const plugin = makePlugin({
    async plan() { return { artifacts: [{ path: 'det.txt' }] }; },
    async generate() { callCount++; return { 'det.txt': 'deterministic' }; },
  });

  const r1 = await runner.run([plugin], { sdl: 'same' });
  const r2 = await runner.run([plugin], { sdl: 'same' });

  assert.equal(callCount, 2);
  assert.deepEqual(r1.results[0].artifacts, r2.results[0].artifacts);
});

test('PluginRunner — empty generate() return {} is valid (no-op plugin)', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    async plan() { return { artifacts: [] }; },
    async generate() { return {}; },
  });

  const result = await runner.run([plugin], {});
  assert.equal(result.success, true);
  assert.equal(result.results[0].artifactCount, 0);
});

test('PluginRunner — undeclared artifact paths → logged as warning', async () => {
  const { logger, warnings } = collectingLogger();
  const runner = makeRunner({ logger });

  const plugin = makePlugin({
    async plan() { return { artifacts: [{ path: 'a.txt' }] }; },
    async generate() { return { 'a.txt': 'ok', 'b.txt': 'undeclared' }; },
  });

  const result = await runner.run([plugin], {});
  assert.equal(result.success, true);
  assert.ok(warnings.length > 0, 'expected a warning for undeclared artifact path');
  const warnText = JSON.stringify(warnings);
  assert.ok(warnText.includes('b.txt'), 'warning should mention undeclared path');
});

test('PluginRunner — runId present in results', async () => {
  const runner = makeRunner();
  const result = await runner.run([makePlugin()], {});
  assert.ok(typeof result.runId === 'string');
  assert.ok(result.runId.length > 0);
});

test('PluginRunner — init failure in default mode throws with pluginResults', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    init() { throw new Error('init-boom'); },
  });

  const err = await catchReject(() => runner.run([plugin], {}));
  assert.equal(err.code, 'WPLY002');
  assert.equal(err.phase, 'init');
  assert.ok(Array.isArray(err.pluginResults));
});

test('PluginRunner — generate failure in default mode throws with phase generate', async () => {
  const runner = makeRunner();
  const plugin = makePlugin({
    async generate() { throw new Error('gen-boom'); },
  });

  const err = await catchReject(() => runner.run([plugin], {}));
  assert.equal(err.code, 'WPLY002');
  assert.equal(err.phase, 'generate');
});

test('PluginRunner — best-effort all fail → success=false', async () => {
  const runner = makeRunner({ bestEffort: true });
  const plugin = makePlugin({
    async plan() { throw new Error('boom'); },
  });

  const result = await runner.run([plugin], {});
  assert.equal(result.success, false);
});

test('SUPPORTED_API_VERSIONS contains "1"', () => {
  assert.ok(SUPPORTED_API_VERSIONS.has('1'));
  assert.equal(SUPPORTED_API_VERSIONS.size, 1);
});

test('GeneratorPlugin abstract methods throw', () => {
  const base = new GeneratorPlugin();
  assert.throws(() => base.apiVersion, /must be implemented/);
  assert.throws(() => base.name, /must be implemented/);
  assert.throws(() => base.plan(), /must be implemented/);
  assert.throws(() => base.generate(), /must be implemented/);
  // init() is no-op by default — does not throw
  assert.doesNotThrow(() => base.init({}));
});
