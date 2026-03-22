import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { GENERATED_ARTIFACT_DIR } from '@wesley/core';

import {
  analyzeCounterfactual,
  defaultCounterfactualPolicy
} from '../src/index.mjs';

function createRepoFixture({ withBraid = false, prebuildSurface = true } = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-counterfactual-'));
  mkdirSync(path.join(tempDir, GENERATED_ARTIFACT_DIR), { recursive: true });
  mkdirSync(path.join(tempDir, 'out'), { recursive: true });

  writeFileSync(path.join(tempDir, 'schema.graphql'), [
    'type User @wes_table {',
    '  id: ID! @wes_pk',
    '}',
    ''
  ].join('\n'));
  writeFileSync(path.join(tempDir, GENERATED_ARTIFACT_DIR, 'history.json'), JSON.stringify({
    points: [
      { day: 0, scs: 0.3, tci: 0.2, mri: 0.2 },
      { day: 1, scs: 0.5, tci: 0.4, mri: 0.2 }
    ]
  }, null, 2));
  if (prebuildSurface) {
    writeSurface(tempDir, {
      sql: 'create table users (id text primary key);',
      plan: { plan: { phases: [] }, explain: { steps: [] } }
    });
  }

  git(tempDir, 'init', '--initial-branch=main');
  git(tempDir, 'config', 'user.email', 'wesley-tests@example.com');
  git(tempDir, 'config', 'user.name', 'Wesley Tests');
  git(tempDir, 'add', '.');
  git(tempDir, 'commit', '-m', 'base');

  if (withBraid) {
    git(tempDir, 'checkout', '-b', 'support');
    writeFileSync(path.join(tempDir, 'schema.graphql'), [
      'type User @wes_table {',
      '  id: ID! @wes_pk',
      '  support: String',
      '}',
      ''
    ].join('\n'));
    writeSurface(tempDir, {
      sql: 'create table users (id text primary key, support text);',
      plan: { plan: { phases: [{ phase: 1 }] }, explain: { steps: [{ op: 'support' }] } }
    });
    git(tempDir, 'add', '.');
    git(tempDir, 'commit', '-m', 'support');
    git(tempDir, 'checkout', 'main');
  }

  git(tempDir, 'checkout', '-b', 'feature');
  writeFileSync(path.join(tempDir, 'schema.graphql'), [
    'type User @wes_table {',
    '  id: ID! @wes_pk',
    '  email: String!',
    '}',
    ''
  ].join('\n'));
  if (prebuildSurface) {
    writeSurface(tempDir, {
      sql: 'create table users (id text primary key, email text not null);',
      plan: { plan: { phases: [{ phase: 1 }] }, explain: { steps: [{ op: 'alter_table' }] } }
    });
  }
  git(tempDir, 'add', '.');
  git(tempDir, 'commit', '-m', 'feature');

  return {
    tempDir,
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function writeSurface(repoRoot, { sql, plan }) {
  writeFileSync(path.join(repoRoot, 'out', 'schema.sql'), sql);
  writeFileSync(path.join(repoRoot, GENERATED_ARTIFACT_DIR, 'bundle.json'), JSON.stringify({
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    timestamp: '2026-03-20T00:00:00.000Z',
    bundleVersion: '1.0.0',
    evidence: {
      evidence: {
        'artifact:out/schema.sql': {
          sql: [{ file: 'out/schema.sql', lines: '1-1' }]
        }
      }
    },
    scores: { scores: { scs: 0.5, tci: 0.4, mri: 0.2 } }
  }, null, 2));
  writeFileSync(path.join(repoRoot, GENERATED_ARTIFACT_DIR, 'plan-report.json'), JSON.stringify(plan, null, 2));
}

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

test('analyzeCounterfactual persists canonical fact bytes and judgment metadata', async () => {
  const fixture = createRepoFixture();
  const policy = defaultCounterfactualPolicy();
  policy.counterfactual.enabled = true;
  policy.counterfactual.gateMode = 'audit';

  try {
    const report = await analyzeCounterfactual({
      repoRoot: fixture.tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      surface: {
        bundleDir: GENERATED_ARTIFACT_DIR,
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    assert.equal(report.provider, 'git-warp');
    assert.equal(report.composition, 'merge');
    assert.equal(report.resolved.baseRef, 'main');
    assert.ok(report.facts.comparison.factDigest);
    assert.ok(report.judgment.signals.includes('visible_state_delta'));
    assert.ok(report.judgment.signals.includes('transfer_ops_present'));
    assert.equal(report.judgment.gate, 'pass');

    const comparisonPath = path.join(fixture.tempDir, report.facts.comparison.file);
    const transferPath = path.join(fixture.tempDir, report.facts.transferPlan.file);
    const summaryPath = path.join(
      fixture.tempDir,
      GENERATED_ARTIFACT_DIR,
      'counterfactual',
      report.laneFingerprint,
      'summary.json'
    );
    const leasePath = path.join(
      fixture.tempDir,
      GENERATED_ARTIFACT_DIR,
      'counterfactual',
      'store',
      'lease.json'
    );
    const comparisonBytes = readFileSync(comparisonPath, 'utf8');
    const transferBytes = readFileSync(transferPath, 'utf8');
    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    const lease = JSON.parse(readFileSync(leasePath, 'utf8'));

    assert.equal(
      createHash('sha256').update(comparisonBytes).digest('hex'),
      report.facts.comparison.factDigest
    );
    assert.equal(
      createHash('sha256').update(transferBytes).digest('hex'),
      report.facts.transferPlan.factDigest
    );
    assert.equal(summary.cache.storeLeaseVersion, 1);
    assert.ok(Array.isArray(summary.cache.surfaceKeys));
    assert.ok(summary.cache.surfaceKeys.length >= 2);
    assert.equal(lease.graphName, 'wesley-counterfactual-v1');
    assert.equal(lease.providerPackageVersion, '14.16.2');
  } finally {
    fixture.cleanup();
  }
});

test('analyzeCounterfactual supports braid lanes and marks braid signals', async () => {
  const fixture = createRepoFixture({ withBraid: true });
  const policy = defaultCounterfactualPolicy();
  policy.counterfactual.enabled = true;
  policy.counterfactual.gateMode = 'audit';

  try {
    const report = await analyzeCounterfactual({
      repoRoot: fixture.tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: ['support'],
        composition: 'braid'
      },
      policy,
      surface: {
        bundleDir: GENERATED_ARTIFACT_DIR,
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    assert.equal(report.composition, 'braid');
    assert.equal(report.resolved.braidRefs.length, 1);
    assert.ok(report.judgment.signals.includes('braid_present'));
  } finally {
    fixture.cleanup();
  }
});

test('analyzeCounterfactual materializes missing workspace artifacts in process', async () => {
  const fixture = createRepoFixture({ prebuildSurface: false });
  const policy = defaultCounterfactualPolicy();
  policy.counterfactual.enabled = true;

  try {
    const report = await analyzeCounterfactual({
      repoRoot: fixture.tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      surface: {
        bundleDir: GENERATED_ARTIFACT_DIR,
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    assert.ok(report.facts.comparison.factDigest);
    assert.equal(
      readFileSync(path.join(fixture.tempDir, GENERATED_ARTIFACT_DIR, 'bundle.json'), 'utf8').includes('"bundleVersion": "2.0.0"'),
      true
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(fixture.tempDir, GENERATED_ARTIFACT_DIR, 'plan-report.json'), 'utf8')).transmutation,
      'legacy-supabase'
    );
    assert.equal(
      readFileSync(path.join(fixture.tempDir, 'out', 'schema.sql'), 'utf8').includes('CREATE TABLE IF NOT EXISTS'),
      true
    );
  } finally {
    fixture.cleanup();
  }
});

test('analyzeCounterfactual prunes expired lane summaries and resets expired store leases', async () => {
  const fixture = createRepoFixture();
  const policy = defaultCounterfactualPolicy();
  policy.counterfactual.enabled = true;

  try {
    await analyzeCounterfactual({
      repoRoot: fixture.tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      surface: {
        bundleDir: GENERATED_ARTIFACT_DIR,
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    const counterfactualRoot = path.join(fixture.tempDir, GENERATED_ARTIFACT_DIR, 'counterfactual');
    const staleLaneDir = path.join(counterfactualRoot, 'stale-lane');
    const staleStoreLeasePath = path.join(counterfactualRoot, 'store', 'lease.json');
    const staleSurfacePath = path.join(counterfactualRoot, 'store', 'surfaces', 'stale.json');

    mkdirSync(staleLaneDir, { recursive: true });
    mkdirSync(path.dirname(staleStoreLeasePath), { recursive: true });
    mkdirSync(path.dirname(staleSurfacePath), { recursive: true });
    writeFileSync(path.join(staleLaneDir, 'summary.json'), JSON.stringify({
      cache: {
        expiresAt: '2000-01-01T00:00:00.000Z'
      }
    }, null, 2));
    writeFileSync(staleStoreLeasePath, JSON.stringify({
      leaseVersion: 1,
      expiresAt: '2000-01-01T00:00:00.000Z'
    }, null, 2));
    writeFileSync(staleSurfacePath, JSON.stringify({ stale: true }, null, 2));

    await analyzeCounterfactual({
      repoRoot: fixture.tempDir,
      lane: {
        baseRef: 'main',
        headRef: 'HEAD',
        braidRefs: [],
        composition: 'merge'
      },
      policy,
      surface: {
        bundleDir: GENERATED_ARTIFACT_DIR,
        outDir: 'out',
        schemaPath: 'schema.graphql'
      }
    });

    assert.equal(existsSync(staleLaneDir), false);
    assert.equal(existsSync(staleSurfacePath), false);
    const lease = JSON.parse(readFileSync(staleStoreLeasePath, 'utf8'));
    assert.equal(lease.leaseVersion, 1);
    assert.notEqual(lease.expiresAt, '2000-01-01T00:00:00.000Z');
  } finally {
    fixture.cleanup();
  }
});
