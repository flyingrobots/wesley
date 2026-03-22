import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { Holmes } from '../src/Holmes.mjs';
import { Watson } from '../src/Watson.mjs';

test('Holmes prefers exact citations over wildcard spans', () => {
  const sha = 'abcdef1234567890abcdef1234567890abcdef12';
  const holmes = new Holmes({
    sha,
    timestamp: '2026-03-21T00:00:00.000Z',
    bundleVersion: '2.0.0',
    evidence: {
      evidence: {
        schema: {
          sql: [{ file: 'ops/all_users.fn.sql', lines: '1-*', sha }],
          view: [{ file: 'ops/all_users.view.sql', lines: '4-4', sha }]
        }
      }
    },
    scores: {
      scores: { scs: 0.5, tci: 0.5, mri: 0.1 },
      readiness: { verdict: 'REQUIRES INVESTIGATION' }
    }
  });

  assert.equal(
    holmes.getCitation(holmes.evidence.evidence.schema),
    'ops/all_users.view.sql:4-4@abcdef1'
  );
  assert.equal(holmes.getEvidenceStrength(holmes.evidence.evidence.schema), 'exact');
});

test('Holmes prefers a narrow exact span over a whole-file span', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-citation-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(tempDir);
    writeFileSync('schema.sql', ['one', 'two', 'three', ''].join('\n'));
    writeFileSync('tests.sql', ['test line', 'second test line', ''].join('\n'));

    const sha = 'abcdef1234567890abcdef1234567890abcdef12';
    const holmes = new Holmes({
      sha,
      timestamp: '2026-03-21T00:00:00.000Z',
      bundleVersion: '2.0.0',
      evidence: {
        evidence: {
          schema: {
            sql: [{ file: 'schema.sql', lines: '1-3', sha }],
            tests: [{ file: 'tests.sql', lines: '1-1', sha }]
          }
        }
      },
      scores: {
        scores: { scs: 0.5, tci: 0.5, mri: 0.1 },
        readiness: { verdict: 'REQUIRES INVESTIGATION' }
      }
    });

    assert.equal(
      holmes.getCitation(holmes.evidence.evidence.schema),
      'tests.sql:1-1@abcdef1'
    );
    const data = holmes.investigationData();
    assert.deepEqual(data.metadata.citationQuality, {
      exact: 1,
      wholeFile: 1,
      coarse: 0
    });
    assert.equal(data.evidence[0].evidenceStrength, 'exact');
    assert.equal(data.evidence[0].status, '⚠️ Whole-file/mixed SQL & tests');
  } finally {
    process.chdir(previousCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Watson verifies the cited span instead of requiring the full file to match', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'watson-citation-'));
  const previousCwd = process.cwd();
  try {
    git(tempDir, 'init', '--initial-branch=main');
    git(tempDir, 'config', 'user.email', 'wesley-tests@example.com');
    git(tempDir, 'config', 'user.name', 'Wesley Tests');

    const target = path.join(tempDir, 'schema.sql');
    writeFileSync(target, ['before', 'exact line', 'after', ''].join('\n'));
    git(tempDir, 'add', 'schema.sql');
    git(tempDir, 'commit', '-m', 'base');
    const sha = git(tempDir, 'rev-parse', 'HEAD');

    writeFileSync(target, ['changed before', 'exact line', 'changed after', ''].join('\n'));

    process.chdir(tempDir);
    const watson = new Watson({
      sha,
      evidence: {
        evidence: {
          schema: {
            sql: [{ file: 'schema.sql', lines: '2-2', sha }]
          }
        }
      },
      scores: {
        scores: { scs: 0, tci: 0, mri: 0 }
      }
    });

    const citations = watson.verifyCitations();
    assert.deepEqual(citations, {
      total: 1,
      verified: 1,
      failed: 0,
      unverified: 0,
      exact: 1,
      wholeFile: 0,
      coarse: 0
    });
  } finally {
    process.chdir(previousCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Watson leaves wildcard citations unverified', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'watson-citation-'));
  const previousCwd = process.cwd();
  try {
    git(tempDir, 'init', '--initial-branch=main');
    git(tempDir, 'config', 'user.email', 'wesley-tests@example.com');
    git(tempDir, 'config', 'user.name', 'Wesley Tests');

    const target = path.join(tempDir, 'schema.sql');
    writeFileSync(target, ['before', 'exact line', 'after', ''].join('\n'));
    git(tempDir, 'add', 'schema.sql');
    git(tempDir, 'commit', '-m', 'base');
    const sha = git(tempDir, 'rev-parse', 'HEAD');

    process.chdir(tempDir);
    const watson = new Watson({
      sha,
      evidence: {
        evidence: {
          schema: {
            sql: [{ file: 'schema.sql', lines: '1-*', sha }]
          }
        }
      },
      scores: {
        scores: { scs: 0, tci: 0, mri: 0 }
      }
    });

    const citations = watson.verifyCitations();
    assert.deepEqual(citations, {
      total: 1,
      verified: 0,
      failed: 0,
      unverified: 1,
      exact: 0,
      wholeFile: 0,
      coarse: 1
    });
  } finally {
    process.chdir(previousCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}
