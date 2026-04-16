import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTINUUM_CONTRACT_PROFILE,
  defaultContinuumContractBundleOutDir,
  getContinuumContractBundleDefinition,
  getContinuumContractConsumerDefinition,
  resolveContinuumContractBundleProfile
} from '../src/index.mjs';

test('contract bundle profile resolves release roots and consumer metadata', () => {
  const profile = resolveContinuumContractBundleProfile({
    family: 'receipt-family',
    release: '0.1.0',
    schemaPath: '../continuum/schemas/continuum-receipt-family.graphql',
    authorityRepository: 'flyingrobots/continuum',
    authorityRef: 'release/v0.1.0'
  });

  assert.equal(profile.profile, CONTINUUM_CONTRACT_PROFILE);
  assert.equal(profile.scope, 'receipt-family');
  assert.equal(profile.bundleRoot, '.wesley-cache/contracts/continuum/receipt-family/0.1.0');
  assert.equal(profile.targetsRoot, '.wesley-cache/contracts/continuum/receipt-family/0.1.0/targets');
  assert.equal(profile.bundleManifestPath, '.wesley-cache/contracts/continuum/receipt-family/0.1.0/bundle.json');
  assert.equal(profile.authority.repository, 'flyingrobots/continuum');
  assert.equal(profile.authority.ref, 'release/v0.1.0');
  assert.deepEqual(profile.consumers.map((consumer) => consumer.consumer), ['warp-ttd', 'echo']);
});

test('contract bundle definitions expose stable targets and semver output roots', () => {
  const receipt = getContinuumContractBundleDefinition('receipt-family');
  const settlement = getContinuumContractBundleDefinition('settlement-family');

  assert.deepEqual(receipt.targets, ['warp-ttd', 'echo']);
  assert.equal(settlement.defaultSchemaPath, 'schemas/continuum-settlement-family.graphql');
  assert.equal(
    defaultContinuumContractBundleOutDir({ family: 'settlement-family', release: '0.1.0' }),
    '.wesley-cache/contracts/continuum/settlement-family/0.1.0'
  );
});

test('contract consumer definitions keep sync conventions in the product package', () => {
  const warp = getContinuumContractConsumerDefinition('warp-ttd');
  const echo = getContinuumContractConsumerDefinition('echo');

  assert.equal(warp.projections[0].fromRoot, 'targets/warp-ttd/manifest');
  assert.equal(warp.projections[1].toRoot, 'typescript');
  assert.equal(echo.projections[0].to, 'packages/ttd-protocol-ts/index.ts');

  echo.projections[0].to = 'mutated';
  assert.equal(
    getContinuumContractConsumerDefinition('echo').projections[0].to,
    'packages/ttd-protocol-ts/index.ts'
  );
});
