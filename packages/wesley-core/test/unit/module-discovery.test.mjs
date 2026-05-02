import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WESLEY_MODULE_CAPABILITY_AREAS,
  WESLEY_MODULE_CAPABILITY_COLLECTIONS,
  SUPPORTED_WESLEY_MODULE_API_VERSIONS,
  createModuleCapabilityRegistry,
  listModuleCapabilities,
  validateWesleyModule,
  discoverModules
} from '../../src/index.mjs';

function makeFakeModule(overrides = {}) {
  return {
    apiVersion: '1',
    name: 'fake-module',
    init() {},
    async registerCliCommands() {},
    ...overrides
  };
}

function makeCapabilityMatrix(prefix) {
  return Object.fromEntries(
    Object.entries(WESLEY_MODULE_CAPABILITY_COLLECTIONS).map(([area, collections]) => [
      area,
      Object.fromEntries(
        collections.map((collection) => [
          collection,
          [{ name: `${prefix}-${area}-${collection}` }]
        ])
      )
    ])
  );
}

const nullLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return nullLogger;
  }
};

function mockResolve(registry) {
  return async (specifier) => {
    if (specifier in registry) {
      return registry[specifier];
    }
    throw new Error(`Module not found: ${specifier}`);
  };
}

async function catchReject(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}

test('SUPPORTED_WESLEY_MODULE_API_VERSIONS is frozen', () => {
  assert.throws(() => {
    SUPPORTED_WESLEY_MODULE_API_VERSIONS.push('2');
  }, TypeError);
});

test('validateWesleyModule accepts a valid plain-object module', () => {
  assert.doesNotThrow(() => validateWesleyModule(makeFakeModule()));
});

test('validateWesleyModule accepts a module with structured capabilities', () => {
  assert.doesNotThrow(() => validateWesleyModule(makeFakeModule({
    capabilities: {
      wesley: {
        targets: [{ name: 'fixture-target' }]
      }
    }
  })));
});

test('WESLEY_MODULE_CAPABILITY_AREAS is frozen', () => {
  assert.throws(() => {
    WESLEY_MODULE_CAPABILITY_AREAS.push('product');
  }, TypeError);
});

test('WESLEY_MODULE_CAPABILITY_COLLECTIONS is frozen', () => {
  assert.throws(() => {
    WESLEY_MODULE_CAPABILITY_COLLECTIONS.wesley.push('productTargets');
  }, TypeError);
});

test('validateWesleyModule rejects a module with a blank name', () => {
  assert.throws(() => validateWesleyModule(makeFakeModule({ name: '   ' })), /non-empty string/);
});

test('discoverModules loads string and object entries', async () => {
  const resolve = mockResolve({
    alpha: { default: makeFakeModule({ name: 'alpha' }) },
    beta: { wesleyModule: makeFakeModule({ name: 'beta' }) }
  });

  const result = await discoverModules([
    'alpha',
    { specifier: 'beta', config: { answer: 42 } }
  ], {
    resolve,
    logger: nullLogger
  });

  assert.equal(result.modules.length, 2);
  assert.equal(result.modules[0].name, 'alpha');
  assert.equal(result.modules[1].name, 'beta');
  assert.deepEqual(result.capabilityRegistry.modules.map((module) => module.name), ['alpha', 'beta']);
});

test('discoverModules forwards config to init()', async () => {
  let received = null;
  const resolve = mockResolve({
    configured: {
      default: makeFakeModule({
        name: 'configured',
        init(config) {
          received = config;
        }
      })
    }
  });

  await discoverModules([
    { specifier: 'configured', config: { mode: 'test' } }
  ], {
    resolve,
    logger: nullLogger
  });

  assert.deepEqual(received, { mode: 'test' });
});

test('discoverModules skips disabled entries', async () => {
  const resolve = mockResolve({
    skipped: { default: makeFakeModule({ name: 'skipped' }) },
    loaded: { default: makeFakeModule({ name: 'loaded' }) }
  });

  const result = await discoverModules([
    { specifier: 'skipped', enabled: false },
    'loaded'
  ], {
    resolve,
    logger: nullLogger
  });

  assert.deepEqual(result.modules.map((module) => module.name), ['loaded']);
});

test('createModuleCapabilityRegistry aggregates structured capabilities with ownership', () => {
  const registry = createModuleCapabilityRegistry([
    makeFakeModule({
      name: 'alpha',
      capabilities: {
        wesley: {
          targets: [{ name: 'alpha-target' }],
          generators: [{ name: 'alpha-generator' }]
        },
        holmes: {
          scopes: [{ name: 'alpha-scope' }]
        },
        cli: {
          commands: [{ name: 'alpha-command' }]
        }
      }
    }),
    makeFakeModule({
      name: 'beta',
      capabilities: {
        wesley: {
          targets: [{ name: 'beta-target' }]
        },
        blade: {
          gates: [{ name: 'beta-gate' }]
        }
      }
    })
  ]);

  assert.deepEqual(
    listModuleCapabilities(registry, 'wesley', 'targets'),
    [
      { moduleName: 'alpha', value: { name: 'alpha-target' } },
      { moduleName: 'beta', value: { name: 'beta-target' } }
    ]
  );
  assert.deepEqual(
    listModuleCapabilities(registry, 'holmes', 'scopes'),
    [{ moduleName: 'alpha', value: { name: 'alpha-scope' } }]
  );
  assert.deepEqual(
    listModuleCapabilities(registry, 'blade', 'gates'),
    [{ moduleName: 'beta', value: { name: 'beta-gate' } }]
  );
  assert.deepEqual(listModuleCapabilities(registry, 'watson', 'verifiers'), []);
});

test('createModuleCapabilityRegistry normalizes every supported capability collection with ownership', () => {
  const registry = createModuleCapabilityRegistry([
    makeFakeModule({
      name: 'alpha',
      capabilities: makeCapabilityMatrix('alpha')
    })
  ]);

  assert.deepEqual(Object.keys(registry.capabilities), WESLEY_MODULE_CAPABILITY_AREAS);

  for (const [area, collections] of Object.entries(WESLEY_MODULE_CAPABILITY_COLLECTIONS)) {
    assert.deepEqual(Object.keys(registry.capabilities[area]), collections, area);

    for (const collection of collections) {
      assert.deepEqual(
        listModuleCapabilities(registry, area, collection),
        [{
          moduleName: 'alpha',
          value: { name: `alpha-${area}-${collection}` }
        }],
        `${area}.${collection}`
      );
    }
  }
});

test('createModuleCapabilityRegistry rejects unknown capability areas', () => {
  assert.throws(() => createModuleCapabilityRegistry([
    makeFakeModule({
      capabilities: {
        product: {
          targets: []
        }
      }
    })
  ]), (error) => {
    assert.equal(error.code, 'WMOD005');
    assert.match(error.message, /unknown area "product"/);
    return true;
  });
});

test('createModuleCapabilityRegistry rejects non-object capability areas', () => {
  assert.throws(() => createModuleCapabilityRegistry([
    makeFakeModule({
      capabilities: {
        holmes: []
      }
    })
  ]), (error) => {
    assert.equal(error.code, 'WMOD005');
    assert.match(error.message, /capabilities\.holmes must be a plain object/);
    return true;
  });
});

test('createModuleCapabilityRegistry rejects unknown capability collections', () => {
  assert.throws(() => createModuleCapabilityRegistry([
    makeFakeModule({
      capabilities: {
        blade: {
          deployments: []
        }
      }
    })
  ]), (error) => {
    assert.equal(error.code, 'WMOD005');
    assert.match(error.message, /capabilities\.blade contains unknown collection "deployments"/);
    return true;
  });
});

test('createModuleCapabilityRegistry rejects non-array capability collections', () => {
  assert.throws(() => createModuleCapabilityRegistry([
    makeFakeModule({
      capabilities: {
        wesley: {
          targets: { name: 'not-an-array' }
        }
      }
    })
  ]), (error) => {
    assert.equal(error.code, 'WMOD005');
    assert.match(error.message, /capabilities\.wesley\.targets must be an array/);
    return true;
  });
});

test('discoverModules rejects unresolved modules with a coded error', async () => {
  const error = await catchReject(() => discoverModules(['missing'], {
    resolve: mockResolve({}),
    logger: nullLogger
  }));

  assert.equal(error.code, 'WMOD003');
  assert.match(error.message, /missing/);
});

test('discoverModules rejects invalid module contracts with a coded error', async () => {
  const error = await catchReject(() => discoverModules(['broken'], {
    resolve: mockResolve({
      broken: { default: { apiVersion: '1', name: 'broken', registerCliCommands: true } }
    }),
    logger: nullLogger
  }));

  assert.equal(error.code, 'WMOD004');
  assert.match(error.message, /WesleyModule contract/);
});
