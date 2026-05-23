import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverPlugins } from '../../src/application/PluginDiscovery.mjs';
import {
  validateConfig,
  KNOWN_EXPERIMENTAL_FLAGS
} from '../../src/application/ConfigValidator.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture a thrown error (sync or async). */
async function catchReject(fn) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error('Expected function to throw');
}

/** Minimal valid plain-object plugin */
function makeFakePlugin(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'fake-plugin',
    init() {},
    async plan() {
      return { artifacts: [{ path: 'out.txt' }] };
    },
    async generate() {
      return { 'out.txt': 'hello' };
    },
    ...overrides
  };
}

/** No-op logger for test use */
const nullLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return nullLogger;
  },
  setLevel() {},
  async flush() {}
};

/** Collecting logger that stores warn/debug calls */
function collectingLogger() {
  const warnings = [];
  const debugs = [];
  const logger = {
    info() {},
    warn(...args) {
      warnings.push(args);
    },
    error() {},
    debug(...args) {
      debugs.push(args);
    },
    child() {
      return logger;
    },
    setLevel() {},
    async flush() {}
  };
  return { logger, warnings, debugs };
}

/**
 * Create a mock resolve function that maps package names to module objects.
 * @param {Record<string, object>} registry - Map of package name -> module namespace
 */
function mockResolve(registry) {
  return async (specifier) => {
    if (specifier in registry) {
      return registry[specifier];
    }
    throw new Error(`Module not found: ${specifier}`);
  };
}

// ===========================================================================
// validateConfig
// ===========================================================================

test('validateConfig — accepts empty config (no generators, no experimental)', () => {
  const result = validateConfig({});
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateConfig — accepts valid generators array', () => {
  const result = validateConfig({
    generators: [
      { package: '@example/generator', config: { key: 'val' } },
      { package: './my-plugin', enabled: false }
    ]
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateConfig — rejects non-array generators', () => {
  const result = validateConfig({ generators: 'bad' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('array')));
});

test('validateConfig — rejects generator entry missing package', () => {
  const result = validateConfig({ generators: [{ config: {} }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('package')));
});

test('validateConfig — rejects generator entry with empty package', () => {
  const result = validateConfig({ generators: [{ package: '  ' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('package')));
});

test('validateConfig — rejects null generator entry', () => {
  const result = validateConfig({ generators: [null] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('non-null')));
});

test('validateConfig — rejects non-boolean enabled', () => {
  const result = validateConfig({ generators: [{ package: 'x', enabled: 'yes' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('enabled')));
});

test('validateConfig — rejects non-object config field', () => {
  const result = validateConfig({ generators: [{ package: 'x', config: 'bad' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('config')));
});

test('validateConfig — accepts valid experimental flags', () => {
  const result = validateConfig({ experimental: { irV2: true, rawLe: false } });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0);
});

test('validateConfig — warns on unknown experimental flag', () => {
  const result = validateConfig({ experimental: { unknownFlag: true } });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes('unknownFlag')));
});

test('validateConfig — rejects non-boolean experimental value', () => {
  const result = validateConfig({ experimental: { irV2: 'yes' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('irV2')));
});

test('validateConfig — rejects non-object experimental', () => {
  const result = validateConfig({ experimental: 'nope' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('experimental')));
});

test('validateConfig — rejects non-object config at top level', () => {
  const result = validateConfig(null);
  assert.equal(result.valid, false);
});

test('KNOWN_EXPERIMENTAL_FLAGS is frozen', () => {
  assert.throws(() => {
    KNOWN_EXPERIMENTAL_FLAGS.push('x');
  }, TypeError);
});

// ===========================================================================
// discoverPlugins
// ===========================================================================

test('discoverPlugins — loads two generators, both returned', async () => {
  const pluginA = makeFakePlugin({ name: 'alpha' });
  const pluginB = makeFakePlugin({ name: 'beta' });
  const resolve = mockResolve({
    'pkg-alpha': { default: pluginA },
    'pkg-beta': { default: pluginB }
  });

  const config = {
    generators: [{ package: 'pkg-alpha' }, { package: 'pkg-beta' }]
  };

  const result = await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(result.plugins.length, 2);
  assert.equal(result.plugins[0].name, 'alpha');
  assert.equal(result.plugins[1].name, 'beta');
});

test('discoverPlugins — enabled: false skips generator entirely', async () => {
  const pluginA = makeFakePlugin({ name: 'alpha' });
  const pluginB = makeFakePlugin({ name: 'beta' });
  const resolve = mockResolve({
    'pkg-alpha': { default: pluginA },
    'pkg-beta': { default: pluginB }
  });

  const config = {
    generators: [{ package: 'pkg-alpha', enabled: false }, { package: 'pkg-beta' }]
  };

  const result = await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].name, 'beta');
});

test('discoverPlugins — missing package produces clear error with package name', async () => {
  const resolve = mockResolve({});
  const config = { generators: [{ package: '@wesley/nonexistent' }] };

  const err = await catchReject(() => discoverPlugins(config, { resolve, logger: nullLogger }));
  assert.equal(err.code, 'WCFG002');
  assert.ok(err.message.includes('@wesley/nonexistent'));
});

test('discoverPlugins — plugin config forwarded to init() verbatim', async () => {
  let receivedConfig;
  const plugin = makeFakePlugin({
    name: 'cfg-test',
    init(config) {
      receivedConfig = config;
    }
  });
  const resolve = mockResolve({ 'pkg-cfg': { default: plugin } });

  const pluginConfig = { key: 'value', nested: { a: 1 } };
  const config = { generators: [{ package: 'pkg-cfg', config: pluginConfig }] };

  await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.deepEqual(receivedConfig, pluginConfig);
});

test('discoverPlugins — init() is NOT called when no config provided', async () => {
  let initCalled = false;
  const plugin = makeFakePlugin({
    name: 'no-cfg',
    init() {
      initCalled = true;
    }
  });
  const resolve = mockResolve({ 'pkg-nocfg': { default: plugin } });

  const config = { generators: [{ package: 'pkg-nocfg' }] };
  await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(initCalled, false);
});

test('discoverPlugins — experimental flags parsed and validated', async () => {
  const config = {
    generators: [],
    experimental: { irV2: true, rawLe: false, join: false }
  };

  const result = await discoverPlugins(config, {
    resolve: mockResolve({}),
    logger: nullLogger
  });

  assert.equal(result.experimental.irV2, true);
  assert.equal(result.experimental.rawLe, false);
  assert.equal(result.experimental.join, false);
});

test('discoverPlugins — unknown experimental flag produces warning', async () => {
  const { logger, warnings } = collectingLogger();
  const config = {
    generators: [],
    experimental: { irV2: true, newThing: true }
  };

  const result = await discoverPlugins(config, {
    resolve: mockResolve({}),
    logger
  });

  // Warning from validateConfig propagated to result
  assert.ok(result.warnings.some((w) => w.includes('newThing')));
  // irV2 enabled warning logged
  assert.ok(warnings.some((args) => JSON.stringify(args).includes('irV2')));
});

test('discoverPlugins — experimental defaults to all-false when absent', async () => {
  const config = { generators: [] };
  const result = await discoverPlugins(config, {
    resolve: mockResolve({}),
    logger: nullLogger
  });

  for (const flag of KNOWN_EXPERIMENTAL_FLAGS) {
    assert.equal(result.experimental[flag], false, `${flag} should default to false`);
  }
});

test('discoverPlugins — supports class-based plugin via default export', async () => {
  class TestPlugin {
    get apiVersion() {
      return '1';
    }
    get name() {
      return 'class-plugin';
    }
    async plan() {
      return { artifacts: [] };
    }
    async generate() {
      return {};
    }
  }

  const resolve = mockResolve({ 'pkg-class': { default: TestPlugin } });
  const config = { generators: [{ package: 'pkg-class' }] };

  const result = await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].name, 'class-plugin');
});

test('discoverPlugins — supports named "plugin" export', async () => {
  const plugin = makeFakePlugin({ name: 'named-export' });
  const resolve = mockResolve({ 'pkg-named': { plugin } });

  const config = { generators: [{ package: 'pkg-named' }] };
  const result = await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].name, 'named-export');
});

test('discoverPlugins — supports named "Plugin" export (capital P)', async () => {
  class MyPlugin {
    get apiVersion() {
      return '1';
    }
    get name() {
      return 'capital-p';
    }
    async plan() {
      return { artifacts: [] };
    }
    async generate() {
      return {};
    }
  }
  const resolve = mockResolve({ 'pkg-cap': { Plugin: MyPlugin } });

  const config = { generators: [{ package: 'pkg-cap' }] };
  const result = await discoverPlugins(config, { resolve, logger: nullLogger });
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].name, 'capital-p');
});

test('discoverPlugins — module with no recognized export produces clear error', async () => {
  const resolve = mockResolve({ 'pkg-empty': { someOtherExport: 42 } });
  const config = { generators: [{ package: 'pkg-empty' }] };

  const err = await catchReject(() => discoverPlugins(config, { resolve, logger: nullLogger }));
  assert.equal(err.code, 'WCFG002');
  assert.ok(err.message.includes('pkg-empty'));
});

test('discoverPlugins — invalid plugin contract produces WCFG004', async () => {
  const badPlugin = { apiVersion: '1', name: 'bad' }; // missing plan/generate
  const resolve = mockResolve({ 'pkg-bad': { default: badPlugin } });
  const config = { generators: [{ package: 'pkg-bad' }] };

  const err = await catchReject(() => discoverPlugins(config, { resolve, logger: nullLogger }));
  assert.equal(err.code, 'WCFG004');
  assert.ok(err.message.includes('pkg-bad'));
});

test('discoverPlugins — invalid config shape throws WCFG001', async () => {
  const err = await catchReject(() =>
    discoverPlugins({ generators: 'bad' }, { resolve: mockResolve({}), logger: nullLogger })
  );
  assert.equal(err.code, 'WCFG001');
});

test('discoverPlugins — throws on missing resolve dependency', async () => {
  const err = await catchReject(() => discoverPlugins({}, { logger: nullLogger }));
  assert.match(err.message, /resolve/);
});

test('discoverPlugins — throws on missing logger dependency', async () => {
  const err = await catchReject(() => discoverPlugins({}, { resolve: async () => ({}) }));
  assert.match(err.message, /logger/);
});

test('discoverPlugins — empty generators array returns empty plugins', async () => {
  const result = await discoverPlugins(
    { generators: [] },
    { resolve: mockResolve({}), logger: nullLogger }
  );
  assert.equal(result.plugins.length, 0);
});

test('discoverPlugins — no generators key is valid (defaults to empty)', async () => {
  const result = await discoverPlugins({}, { resolve: mockResolve({}), logger: nullLogger });
  assert.equal(result.plugins.length, 0);
  assert.equal(result.warnings.length, 0);
});

test('discoverPlugins — enabled: false logs debug message', async () => {
  const { logger, debugs } = collectingLogger();
  const resolve = mockResolve({});
  const config = { generators: [{ package: 'skipped-pkg', enabled: false }] };

  await discoverPlugins(config, { resolve, logger });
  assert.ok(debugs.some((args) => JSON.stringify(args).includes('skipped-pkg')));
});

test('discoverPlugins — class instantiation failure produces WCFG003', async () => {
  class BadConstructor {
    constructor() {
      throw new Error('constructor boom');
    }
  }
  const resolve = mockResolve({ 'pkg-boom': { default: BadConstructor } });
  const config = { generators: [{ package: 'pkg-boom' }] };

  const err = await catchReject(() => discoverPlugins(config, { resolve, logger: nullLogger }));
  assert.equal(err.code, 'WCFG003');
  assert.ok(err.message.includes('pkg-boom'));
});
