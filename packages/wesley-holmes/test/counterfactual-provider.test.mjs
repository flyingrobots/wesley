import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import {
  analyzeCounterfactual,
  defaultCounterfactualPolicy
} from '../src/index.mjs';

function createRepoFixture({ withBraid = false } = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-counterfactual-'));
  mkdirSync(path.join(tempDir, '.wesley'), { recursive: true });
  mkdirSync(path.join(tempDir, 'out'), { recursive: true });

  writeFileSync(path.join(tempDir, 'schema.graphql'), [
    'type User @wes_table {',
    '  id: ID! @wes_pk',
    '}',
    ''
  ].join('\n'));
  writeFileSync(path.join(tempDir, '.wesley', 'history.json'), JSON.stringify({
    points: [
      { day: 0, scs: 0.3, tci: 0.2, mri: 0.2 },
      { day: 1, scs: 0.5, tci: 0.4, mri: 0.2 }
    ]
  }, null, 2));
  writeSurface(tempDir, {
    sql: 'create table users (id text primary key);',
    plan: { plan: { phases: [] }, explain: { steps: [] } }
  });

  git(tempDir, 'init', '--initial-branch=main');
  git(tempDir, 'config', 'user.email', 'wesley-tests@example.com');
  git(tempDir, 'config', 'user.name', 'Wesley Tests');
  git(tempDir, 'add', '.');
  git(tempDir, 'commit', '-m', 'base');

  if (withBraid) {
    git(tempDir, 'checkout', '-b', 'support');
    writeSurface(tempDir, {
      sql: 'create table users (id text primary key, support text);',
      plan: { plan: { phases: [{ phase: 1 }] }, explain: { steps: [{ op: 'support' }] } }
    });
    git(tempDir, 'add', '.');
    git(tempDir, 'commit', '-m', 'support');
    git(tempDir, 'checkout', 'main');
  }

  git(tempDir, 'checkout', '-b', 'feature');
  writeSurface(tempDir, {
    sql: 'create table users (id text primary key, email text not null);',
    plan: { plan: { phases: [{ phase: 1 }] }, explain: { steps: [{ op: 'alter_table' }] } }
  });
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
  writeFileSync(path.join(repoRoot, '.wesley', 'bundle.json'), JSON.stringify({
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
  writeFileSync(path.join(repoRoot, '.wesley', 'plan-report.json'), JSON.stringify(plan, null, 2));
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
        bundleDir: '.wesley',
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
    const comparisonBytes = readFileSync(comparisonPath, 'utf8');
    const transferBytes = readFileSync(transferPath, 'utf8');

    assert.equal(
      createHash('sha256').update(comparisonBytes).digest('hex'),
      report.facts.comparison.factDigest
    );
    assert.equal(
      createHash('sha256').update(transferBytes).digest('hex'),
      report.facts.transferPlan.factDigest
    );
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
        bundleDir: '.wesley',
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
