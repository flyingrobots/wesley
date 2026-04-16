import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTINUUM_JUDGMENT_PROFILE,
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE,
  buildContinuumPublicationBoundaryPlan,
  defaultContinuumOutDir,
  getContinuumJudgmentProfile,
  getContinuumScopeDefinition,
  resolveContinuumDriftWatchProfile,
  resolveContinuumWitnessProfile
} from '../src/index.mjs';

test('receipt-family witness profile resolves Continuum defaults', () => {
  const profile = resolveContinuumWitnessProfile({
    scope: RECEIPT_FAMILY_SCOPE,
    schemaPath: 'schemas/continuum-receipt-family.graphql'
  });

  assert.equal(profile.outDir, '.wesley-cache/continuum/receipt-family');
  assert.equal(profile.ttdDir, '.wesley-cache/continuum/receipt-family/warp-ttd');
  assert.equal(profile.echoDir, '.wesley-cache/continuum/receipt-family/echo');
  assert.equal(profile.outputPath, '.wesley-cache/continuum/receipt-family/witness/conformance.json');
  assert.match(profile.proves.join(' '), /round-trip operation vectors/);
});

test('drift-watch profile uses drift-watch report path and mirror roots', () => {
  const profile = resolveContinuumDriftWatchProfile({
    scope: SETTLEMENT_FAMILY_SCOPE,
    mirrorRoots: [' ../echo ', '../echo', null, '../warp-ttd']
  });

  assert.equal(profile.outputPath, '.wesley-cache/continuum/settlement-family/witness/drift-watch.json');
  assert.deepEqual(profile.mirrorRoots, ['../echo', '../warp-ttd']);
});

test('publication-boundary plan includes realization shell and family compat roots', () => {
  const plan = buildContinuumPublicationBoundaryPlan({
    scope: RECEIPT_FAMILY_SCOPE,
    ttdSchemaPath: 'schemas/continuum-receipt-family.graphql',
    ttdDir: 'out/warp-ttd',
    echoSchemaPath: 'schemas/continuum-receipt-family.graphql',
    echoDir: 'out/echo',
    realizationRoot: 'out/realization',
    ttdGeneratedArtifacts: ['manifest/schema.json', 'manifest/manifest.json'],
    echoGeneratedArtifacts: ['ir.json', 'mock/summary.json'],
    receiptFamilyFixtureDir: 'test/fixtures/continuum/receipt-family'
  });

  assert.equal(plan.rules.length, 1);
  assert.equal(plan.rules[0].id, 'receipt-family');
  assert.deepEqual(plan.rules[0].compatRoots, [
    'test/fixtures/continuum/receipt-family',
    'schemas/continuum-receipt-family.graphql'
  ]);
  assert.ok(plan.rules[0].generatedArtifactPaths.includes('realization/manifest.json'));
});

test('judgment profile keeps Continuum behavior in the product package', () => {
  const profile = getContinuumJudgmentProfile();

  assert.equal(profile.profilePackage, '@wesley/continuum');
  assert.equal(profile.enginePackage, '@wesley/holmes');
  assert.equal(profile.roles.holmes.role, 'current-state judgment');
  assert.equal(profile.roles.watson.role, 'independent verification');
  assert.equal(profile.roles.moriarty.role, 'forecast and counterfactual analysis');

  profile.roles.holmes.role = 'mutated';
  assert.equal(CONTINUUM_JUDGMENT_PROFILE.roles.holmes.role, 'current-state judgment');
});

test('scope helpers expose stable Continuum scope metadata', () => {
  assert.equal(defaultContinuumOutDir(CURRENT_MINIMUM_SCOPE), '.wesley-cache/continuum/local-inspect');
  assert.equal(getContinuumScopeDefinition(SETTLEMENT_FAMILY_SCOPE).defaultEchoSchemaPath, 'schemas/continuum-settlement-family.graphql');
});
