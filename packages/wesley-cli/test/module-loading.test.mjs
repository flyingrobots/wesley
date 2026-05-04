import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  WESLEY_MODULE_CAPABILITY_COLLECTIONS,
  listModuleCapabilities
} from '@wesley/core';

import { program } from '../src/program.mjs';
import {
  discoverAndRegisterWesleyCliModules,
  loadWesleyCliModuleEntries
} from '../src/framework/module-loader.mjs';

const fixtureModulePath = fileURLToPath(new URL('./fixtures/modules/test-extension-module.mjs', import.meta.url));

const expectedFixtureCapabilityNames = Object.freeze({
  wesley: {
    directives: 'fixture-directive',
    targets: 'fixture-target',
    generators: 'fixture-generator',
    bundleProfiles: 'fixture-bundle-profile',
    realizationVerifiers: 'fixture-realization-verifier'
  },
  holmes: {
    scopes: 'fixture-scope',
    checks: 'fixture-check',
    evidenceCollectors: 'fixture-evidence-collector',
    counterfactualProviders: 'fixture-counterfactual-provider'
  },
  watson: {
    verifiers: 'fixture-verifier',
    auditProfiles: 'fixture-audit-profile'
  },
  moriarty: {
    policyProfiles: 'fixture-policy-profile',
    judgmentProfiles: 'fixture-judgment-profile',
    predictors: 'fixture-predictor'
  },
  blade: {
    scenarios: 'fixture-scenario',
    fixtures: 'fixture-blade-fixture',
    envSetups: 'fixture-env-setup',
    tests: 'fixture-blade-test',
    gates: 'fixture-gate',
    certificationProfiles: 'fixture-certification-profile'
  },
  cli: {
    commands: 'fixture-hello'
  }
});

const nullLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  }
};

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

async function withFixtureCapabilityRegistry(prefix, callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));

  try {
    const ctx = {
      cwd: tempDir,
      env: {
        WESLEY_MODULES: fixtureModulePath
      },
      logger: nullLogger
    };

    const result = await discoverAndRegisterWesleyCliModules({
      ctx,
      cwd: tempDir,
      env: ctx.env,
      logger: ctx.logger
    });

    return await callback({ ctx, result, tempDir });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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
        logger: nullLogger
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
  await withFixtureCapabilityRegistry('wesley-module-capabilities-', async ({ ctx, result }) => {
    const registry = result.capabilityRegistry;

    assert.equal(ctx.moduleCapabilityRegistry, registry);
    assert.deepEqual(registry.modules, [
      { name: 'test-extension-module', apiVersion: '1' }
    ]);
    assert.deepEqual(Object.keys(registry.capabilities), Object.keys(WESLEY_MODULE_CAPABILITY_COLLECTIONS));

    for (const [area, collections] of Object.entries(WESLEY_MODULE_CAPABILITY_COLLECTIONS)) {
      assert.deepEqual(Object.keys(registry.capabilities[area]), collections, area);

      for (const collection of collections) {
        const entries = listModuleCapabilities(registry, area, collection);
        assert.equal(entries.length, 1, `${area}.${collection}`);
        assert.equal(entries[0].moduleName, 'test-extension-module', `${area}.${collection}`);
        assert.equal(
          entries[0].value.name,
          expectedFixtureCapabilityNames[area][collection],
          `${area}.${collection}`
        );
      }
    }

    assert.equal(
      typeof listModuleCapabilities(registry, 'wesley', 'targets')[0].value.compile,
      'function'
    );
    assert.equal(
      typeof listModuleCapabilities(registry, 'blade', 'envSetups')[0].value.setup,
      'function'
    );
    assert.equal(
      typeof listModuleCapabilities(registry, 'blade', 'tests')[0].value.run,
      'function'
    );
    assert.equal(
      typeof listModuleCapabilities(registry, 'blade', 'gates')[0].value.evaluate,
      'function'
    );
  });
});

test('fixture BLADE capabilities expose local environment, test, and gate hooks', async () => {
  await withFixtureCapabilityRegistry('wesley-module-blade-capabilities-', async ({ result }) => {
    const registry = result.capabilityRegistry;
    const envSetup = listModuleCapabilities(registry, 'blade', 'envSetups')[0].value;
    const bladeTest = listModuleCapabilities(registry, 'blade', 'tests')[0].value;
    const gate = listModuleCapabilities(registry, 'blade', 'gates')[0].value;

    assert.deepEqual(await envSetup.setup({ environment: 'contract-fixture' }), {
      kind: 'fixture.blade.env-setup.v1',
      environment: 'contract-fixture',
      ready: true
    });
    assert.deepEqual(await bladeTest.run(), {
      kind: 'fixture.blade.test.v1',
      status: 'pass'
    });
    assert.deepEqual(await bladeTest.run({ shouldFail: true }), {
      kind: 'fixture.blade.test.v1',
      status: 'fail'
    });
    assert.deepEqual(await gate.evaluate(), {
      kind: 'fixture.blade.gate.v1',
      status: 'pass'
    });
    await assert.rejects(() => gate.evaluate({ passed: false }), (error) => {
      assert.equal(error.code, 'FIXTURE_GATE_REJECTED');
      assert.match(error.message, /fixture gate rejected fixture input/);
      return true;
    });
  });
});

test('program dispatches compile through a fixture module target', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'wesley-module-compile-target-'));
  const io = createIo();

  try {
    writeFileSync(path.join(tempDir, 'schema.graphql'), 'type Todo { id: ID! }\n');

    const exitCode = await program(
      [
        'node',
        'wesley',
        '--json',
        'compile',
        '--schema',
        'schema.graphql',
        '--target',
        'fixture-target',
        '--out-dir',
        'out',
        '--dry-run'
      ],
      {
        cwd: tempDir,
        env: {
          WESLEY_MODULES: fixtureModulePath
        },
        fs: {
          async read(targetPath) {
            return readFileSync(path.resolve(tempDir, targetPath), 'utf8');
          }
        },
        stdout: io.stdout,
        stderr: io.stderr,
        logger: nullLogger
      }
    );

    assert.equal(exitCode, 0);
    const payload = JSON.parse(io.readStdout());
    assert.equal(payload.success, true);
    assert.deepEqual(payload.result.targets, ['fixture-target']);
    assert.equal(payload.result.generatedTargets['fixture-target'].moduleName, 'test-extension-module');
    assert.equal(
      payload.result.generatedTargets['fixture-target'].result.kind,
      'fixture.compile-target.v1'
    );
    assert.equal(payload.result.generatedTargets['fixture-target'].result.outDir, 'out/fixture-target');
    assert.equal(payload.result.generatedTargets['fixture-target'].result.dryRun, true);
    assert.equal(io.readStderr(), '');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
