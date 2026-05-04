import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createModuleCapabilityRegistry } from '@wesley/core';

import {
  COUNTERFACTUAL_CURRENT_PATH,
  analyzeCounterfactual,
  defaultCounterfactualPolicy
} from '../src/index.mjs';
import { buildMoriartyPrediction } from '../src/moriarty-predict-workflow.mjs';

const fixtureModulePath = fileURLToPath(new URL('./fixtures/counterfactual-provider-module.mjs', import.meta.url));

async function withTempRepo(callback) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-counterfactual-'));
  try {
    return await callback(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function createRegistryWithProviders(providers) {
  return createModuleCapabilityRegistry([
    {
      apiVersion: '1',
      name: 'counterfactual-test-module',
      capabilities: {
        holmes: {
          counterfactualProviders: providers
        }
      }
    }
  ]);
}

function createProvider(name, overrides = {}) {
  return {
    name,
    providerPackageVersion: `${name}-1.0.0`,
    async analyze({ lane, includeTransferPlan, surface, moduleName }) {
      return {
        providerPackageVersion: `${name}-1.0.0`,
        surfaceVersion: `${name}-surface-v1`,
        laneFingerprint: `${name}-${lane.composition}-${includeTransferPlan ? 'with-transfer' : 'without-transfer'}`,
        composition: lane.composition,
        requested: {
          baseRef: lane.baseRef,
          headRef: lane.headRef,
          braidRefs: lane.braidRefs
        },
        resolved: {
          baseRef: lane.baseRef,
          baseSha: 'a'.repeat(40),
          headRef: lane.headRef,
          headSha: 'b'.repeat(40),
          braidRefs: lane.braidRefs.map((ref) => ({ ref, sha: 'c'.repeat(40) })),
          liveWorkspace: lane.headRef === 'HEAD'
        },
        facts: {
          comparison: null,
          transferPlan: null,
          normalizedScope: lane.scope || null
        },
        judgment: {
          status: 'clean',
          signals: [
            `provider:${name}`,
            ...(lane.braidRefs.length > 0 ? ['braid_present'] : [])
          ],
          riskClass: 'none',
          confidenceAdjustment: 0,
          gate: 'pass',
          wouldFail: false,
          reasons: [
            `Provider ${name} ran for ${moduleName}.`,
            `Surface keys: ${Object.keys(surface || {}).sort().join(',')}`
          ]
        },
        ...overrides
      };
    }
  };
}

test('default counterfactual policy does not name a built-in provider', () => {
  const policy = defaultCounterfactualPolicy();

  assert.equal(policy.counterfactual.provider, null);
});

test('analyzeCounterfactual returns an unsupported report when no provider module is loaded', async () => {
  await withTempRepo(async (tempDir) => {
    const policy = defaultCounterfactualPolicy();
    policy.counterfactual.enabled = true;
    policy.counterfactual.gateMode = 'audit';

    const report = await analyzeCounterfactual({
      repoRoot: tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: ['support'],
        composition: 'braid'
      },
      policy,
      env: {}
    });

    assert.equal(report.provider, 'none');
    assert.equal(report.providerPackageVersion, 'module-capability-unavailable');
    assert.equal(report.composition, 'braid');
    assert.deepEqual(report.requested.braidRefs, ['support']);
    assert.equal(report.facts.comparison, null);
    assert.equal(report.judgment.status, 'unsupported');
    assert.equal(report.judgment.gate, 'audit');
    assert.ok(report.judgment.signals.includes('provider_unavailable'));
    assert.ok(report.judgment.signals.includes('braid_present'));
    assert.match(report.judgment.reasons[0], /No counterfactual provider capabilities/);

    const currentPath = path.join(tempDir, COUNTERFACTUAL_CURRENT_PATH);
    assert.equal(existsSync(currentPath), true);
    assert.deepEqual(JSON.parse(readFileSync(currentPath, 'utf8')), report);
  });
});

test('analyzeCounterfactual dispatches to the sole module counterfactual provider', async () => {
  await withTempRepo(async (tempDir) => {
    const registry = createRegistryWithProviders([createProvider('alpha')]);
    const policy = defaultCounterfactualPolicy();
    policy.counterfactual.enabled = true;

    const report = await analyzeCounterfactual({
      repoRoot: tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      includeTransferPlan: false,
      policy,
      moduleCapabilityRegistry: registry,
      surface: {
        bundleDir: '.wesley-cache',
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    assert.equal(report.provider, 'alpha');
    assert.equal(report.providerModuleName, 'counterfactual-test-module');
    assert.equal(report.providerPackageVersion, 'alpha-1.0.0');
    assert.equal(report.surfaceVersion, 'alpha-surface-v1');
    assert.equal(report.laneFingerprint, 'alpha-merge-without-transfer');
    assert.equal(report.judgment.status, 'clean');
    assert.ok(report.judgment.reasons[1].includes('bundleDir,outDir,schemaPath'));

    const currentPath = path.join(tempDir, COUNTERFACTUAL_CURRENT_PATH);
    assert.equal(JSON.parse(readFileSync(currentPath, 'utf8')).provider, 'alpha');
  });
});

test('analyzeCounterfactual honors policy-selected provider names', async () => {
  await withTempRepo(async (tempDir) => {
    const registry = createRegistryWithProviders([
      createProvider('alpha'),
      createProvider('beta')
    ]);
    const policy = defaultCounterfactualPolicy();
    policy.counterfactual.enabled = true;
    policy.counterfactual.provider = 'beta';

    const report = await analyzeCounterfactual({
      repoRoot: tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      moduleCapabilityRegistry: registry
    });

    assert.equal(report.provider, 'beta');
    assert.ok(report.judgment.signals.includes('provider:beta'));
  });
});

test('analyzeCounterfactual reports missing selected providers without throwing', async () => {
  await withTempRepo(async (tempDir) => {
    const registry = createRegistryWithProviders([createProvider('alpha')]);
    const policy = defaultCounterfactualPolicy();
    policy.counterfactual.enabled = true;
    policy.counterfactual.provider = 'beta';
    policy.counterfactual.gateMode = 'hard';

    const report = await analyzeCounterfactual({
      repoRoot: tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      moduleCapabilityRegistry: registry
    });

    assert.equal(report.provider, 'beta');
    assert.equal(report.judgment.status, 'unsupported');
    assert.equal(report.judgment.gate, 'fail');
    assert.match(report.judgment.reasons[0], /provider "beta" is not available/i);
  });
});

test('analyzeCounterfactual loads counterfactual providers from wesley.config.mjs', async () => {
  await withTempRepo(async (tempDir) => {
    writeFileSync(
      path.join(tempDir, 'wesley.config.mjs'),
      `export default { modules: [${JSON.stringify(fixtureModulePath)}] };\n`
    );

    const policy = defaultCounterfactualPolicy();
    policy.counterfactual.enabled = true;

    const report = await analyzeCounterfactual({
      repoRoot: tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: ['support'],
        composition: 'braid'
      },
      policy,
      env: {}
    });

    assert.equal(report.provider, 'fixture-counterfactual');
    assert.equal(report.providerModuleName, 'holmes-counterfactual-fixture-module');
    assert.equal(report.composition, 'braid');
    assert.equal(report.resolved.braidRefs.length, 1);
    assert.ok(report.judgment.signals.includes('braid_present'));
  });
});

test('buildMoriartyPrediction forwards env module entries into counterfactual analysis', async () => {
  await withTempRepo(async (tempDir) => {
    const bundleDir = path.join(tempDir, '.wesley-cache');
    const historyFile = path.join(bundleDir, 'history.json');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(historyFile, JSON.stringify({
      points: [
        { day: 1, scs: 0.4, tci: 0.3, mri: 0.2 },
        { day: 2, scs: 0.82, tci: 0.74, mri: 0.12 }
      ]
    }, null, 2));

    const result = await buildMoriartyPrediction({
      bundleDir,
      historyFile,
      counterfactual: 'main',
      explain: true,
      env: {
        MORIARTY_USE_GIT: '0',
        WESLEY_MODULES: fixtureModulePath
      }
    });

    assert.equal(result.data.counterfactual.provider, 'fixture-counterfactual');
    assert.equal(result.data.counterfactual.providerModuleName, 'holmes-counterfactual-fixture-module');
    assert.equal(result.data.explain.readiness.counterfactual.status, 'clean');
  });
});
