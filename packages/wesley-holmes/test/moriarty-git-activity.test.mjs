import test from 'node:test';
import assert from 'node:assert/strict';

import { createMoriartyConfig } from '../src/moriarty-config.mjs';
import {
  analyzeMoriartyGitActivity,
  computeMoriartyBurstinessIndex,
  normalizeMoriartyGitActivity
} from '../src/moriarty-git-activity.mjs';
import { buildLog } from './helpers/moriarty-test-helpers.mjs';

test('analyzeMoriartyGitActivity combines PR and window activity through one seam', () => {
  const config = createMoriartyConfig({
    env: {
      MORIARTY_BASE_REF: 'main',
      MORIARTY_GIT_WINDOW_HOURS: '2'
    }
  });
  const clock = {
    nowMs: () => Date.parse('2026-03-24T00:00:00.000Z')
  };
  const fetches = [];
  const git = {
    isInsideWorkTree: () => true,
    fetch: (ref) => fetches.push(ref),
    mergeBase: () => 'deadbeef',
    log: ({ since, range }) => {
      if (since) {
        return buildLog([
          { ts: 1711230000, files: [{ a: 40, d: 10, file: 'schema.graphql' }] },
          { ts: 1711229400, files: [{ a: 5, d: 5, file: 'README.md' }] }
        ]);
      }
      if (range) {
        return buildLog([
          { ts: 1711228200, files: [{ a: 300, d: 20, file: 'out/ddl/schema.sql' }] },
          { ts: 1711227600, files: [{ a: 10, d: 0, file: 'tests/example.pgtap' }] }
        ]);
      }
      return '';
    }
  };

  const result = analyzeMoriartyGitActivity({ git, clock, config });

  assert.deepEqual(fetches, ['main']);
  assert.equal(result.gitActivity.window.commits, 2);
  assert.equal(result.gitActivity.window.relevantCommits, 1);
  assert.equal(result.gitActivity.pr.commits, 2);
  assert.equal(result.gitActivity.pr.relevantCommits, 2);
  assert.ok(result.activityIndex > 0);
  assert.ok(result.burstinessIndex > 0);
});

test('normalizeMoriartyGitActivity and burstiness helpers stay deterministic', () => {
  const config = createMoriartyConfig({ env: {} });
  const normalized = normalizeMoriartyGitActivity({
    windowHours: 4,
    commitsPerDay: 4,
    relevantCommits: 2,
    relevantLinesChanged: 200,
    uniqueRelevantFiles: 5
  }, config);

  assert.ok(normalized > 0 && normalized < 1);
  assert.equal(computeMoriartyBurstinessIndex([10, 10, 10]), 0);
  assert.ok(computeMoriartyBurstinessIndex([1, 100]) > 0.4);
});
