import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyzeCounterfactual
} from '../src/index.mjs';
import { MergePlanner } from '../src/merge/Planner.mjs';
import { MergeTreeStrategy } from '../src/merge/MergeTreeStrategy.mjs';
import { WorktreeStrategy } from '../src/merge/WorktreeStrategy.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function writeSchema(repoDir, body) {
  writeFileSync(path.join(repoDir, 'schema.graphql'), `${body.trim()}\n`);
}

function commitAll(repoDir, message) {
  git(repoDir, 'add', '.');
  git(repoDir, 'commit', '-m', message);
}

function createRemoteFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'holmes-projection-regression-'));
  const seed = path.join(root, 'seed');
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');

  mkdirSync(seed, { recursive: true });
  git(seed, 'init', '--initial-branch=main');
  git(seed, 'config', 'user.email', 'wesley-tests@example.com');
  git(seed, 'config', 'user.name', 'Wesley Tests');
  writeSchema(seed, `
type Query {
  hello: String
}
  `);
  commitAll(seed, 'base');

  git(root, 'init', '--bare', origin);
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-u', 'origin', 'main');
  git(origin, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(root, 'clone', origin, work);
  git(work, 'config', 'user.email', 'wesley-tests@example.com');
  git(work, 'config', 'user.name', 'Wesley Tests');
  git(work, 'checkout', '-b', 'feature');

  return {
    root,
    seed,
    origin,
    work,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    }
  };
}

function applyCleanFeatureChange(fixture) {
  writeSchema(fixture.work, `
type Query {
  hello: String
  world: String
}
  `);
  commitAll(fixture.work, 'feature clean change');
}

function applyConflictChanges(fixture) {
  writeSchema(fixture.work, `
type Query {
  hello: Int
}
  `);
  commitAll(fixture.work, 'feature conflicting change');

  writeSchema(fixture.seed, `
type Query {
  hello: Boolean
}
  `);
  commitAll(fixture.seed, 'main conflicting change');
  git(fixture.seed, 'push', 'origin', 'main');
}

function runLegacyProjection(repoRoot, baseRef = 'main') {
  const plan = new MergePlanner({ repoRoot }).plan({ baseRef });
  return {
    plan,
    mergeTree: new MergeTreeStrategy({ repoRoot }).execute(plan),
    worktree: new WorktreeStrategy({ repoRoot }).execute(plan)
  };
}

async function runCounterfactual(repoRoot, baseRef = 'main') {
  const policy = {
    counterfactual: {
      enabled: true,
      provider: 'external-counterfactual',
      gateMode: 'audit',
      penalties: {
        divergence: 10,
        destructiveTransfer: 30,
        providerUnavailable: 50
      }
    }
  };
  const counterfactual = await analyzeCounterfactual({
    repoRoot,
    lane: {
      baseRef,
      headRef: 'HEAD',
      braidRefs: [],
      composition: 'merge'
    },
    includeTransferPlan: true,
    policy
  });
  return {
    counterfactual
  };
}

test('legacy projection harness matches counterfactual compatibility on a clean lane', async () => {
  const fixture = createRemoteFixture();
  applyCleanFeatureChange(fixture);

  try {
    const legacy = runLegacyProjection(fixture.work);
    const modern = await runCounterfactual(fixture.work);

    assert.equal(legacy.plan.baseRef, 'main');
    assert.equal(legacy.worktree.status, 'clean');
    assert.ok(['clean', 'error'].includes(legacy.mergeTree.status));
    assert.equal(modern.counterfactual.judgment.status, 'unsupported');
    assert.notEqual(modern.counterfactual.judgment.gate, 'fail');
    assert.equal(modern.counterfactual.requested.baseRef, legacy.plan.baseRef);
    assert.equal(modern.counterfactual.composition, 'merge');
  } finally {
    fixture.cleanup();
  }
});

test('legacy projection harness keeps conflict fixtures visible beside counterfactual output', async () => {
  const fixture = createRemoteFixture();
  applyConflictChanges(fixture);

  try {
    const legacy = runLegacyProjection(fixture.work);
    const modern = await runCounterfactual(fixture.work);

    assert.equal(legacy.worktree.status, 'conflicts');
    assert.equal(modern.counterfactual.judgment.status, 'unsupported');
    assert.ok(Array.isArray(modern.counterfactual.judgment.reasons));
    assert.ok(modern.counterfactual.judgment.reasons.length > 0);
  } finally {
    fixture.cleanup();
  }
});
