import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

import {
  makeTempDir,
  writeHistory,
  writeContext,
  withFakeGit,
  buildLog,
  buildLogSeries,
  runPredict,
  nowSecs
} from './helpers/moriarty-test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');

function mkBundleDir() {
  const tmp = makeTempDir('moriarty-ws-');
  const wes = path.join(tmp, '.wesley');
  mkdirSync(wes, { recursive: true });
  return { tmp, wes };
}

function expectWithDump(cond, message, json) {
  try {
    assert.ok(cond, message);
  } catch (err) {
    // Dump the most relevant pieces for quick diagnosis
    // eslint-disable-next-line no-console
    console.error('\n— DEBUG: velocity.gitActivityIndex —', json?.velocity?.gitActivityIndex);
    // eslint-disable-next-line no-console
    console.error('— DEBUG: gitActivity —\n', JSON.stringify(json?.gitActivity, null, 2));
    throw err;
  }
}

test('scenario 1: tiny change after long quiet → plateau detected', () => {
  const { tmp, wes } = mkBundleDir();
  const day0 = Math.trunc((Date.now() - 3*86400000)/86400000);
  const day3 = day0 + 3;
  writeHistory(tmp, [
    { day: day0, scs: 0.82, tci: 0.75, mri: 0.2 },
    { day: day0 + 1, scs: 0.82, tci: 0.75, mri: 0.2 },
    { day: day3, scs: 0.82, tci: 0.75, mri: 0.2 },
  ]);
  writeContext(tmp, { ci: { stability: 0.95 }, timeframeHours: 168, baseRef: 'main' });

  const ts = nowSecs();
  const sinceLog = buildLog([
    { ts, files: [ { a: 1, d: 0, file: 'schema.graphql' } ] }
  ]);
  // For this scenario we only want recent-window activity, not PR-range amplification.
  const prLog = '';

  withFakeGit({ mergeBase: 'deadbeef', sinceLog, prLog }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main', MORIARTY_USE_GIT: '0' });
    // debug
    // console.log('scenario1 status:', json.status, 'history len:', json.history?.length);
    assert.equal(json.status, 'OK');
    assert.equal(json.plateauDetected, true);
    expectWithDump((json.velocity?.gitActivityIndex ?? 0) <= 0.35, 'activity should be low during plateau', json);
    assert.ok(!json.eta, 'ETA should be absent');
  });
});

test('scenario 2: one massive commit → no plateau, confidence penalized', () => {
  const { tmp } = mkBundleDir();
  const day0 = Math.trunc((Date.now() - 1*86400000)/86400000);
  const day1 = day0 + 1;
  writeHistory(tmp, [
    { day: day0, scs: 0.60, tci: 0.60, mri: 0.20 },
    { day: day0 + 0.5, scs: 0.60, tci: 0.60, mri: 0.20 },
    { day: day1, scs: 0.60, tci: 0.60, mri: 0.20 },
  ]);

  const ts = nowSecs();
  // Build two commits inside a short window: one massive schema/programmatic change + one tiny tweak
  const sinceLog = buildLog([
    { ts: ts-1800, files: [ { a: 5000, d: 100, file: 'out/ddl/schema.sql' }, { a: 200, d: 0, file: 'tests/foo.pgtap' } ] },
    { ts: ts-600, files: [ { a: 5, d: 0, file: 'schema.graphql' } ] }
  ]);
  const prLog = sinceLog;

  withFakeGit({ mergeBase: 'deadbeef', sinceLog, prLog }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main', MORIARTY_GIT_WINDOW_HOURS: '1' });
    // console.log('scenario2 status:', json.status, 'history len:', json.history?.length);
    assert.equal(json.status, 'OK');
    assert.equal(json.plateauDetected, false);
    expectWithDump((json.velocity?.gitActivityIndex ?? 0) > 0.5, 'expected high activity index', json);
    expectWithDump((json.gitActivity?.burstinessIndex ?? 0) > 0.2, 'expected noticeable burstiness', json);
    assert.ok(!json.eta, 'ETA should be absent (SCS unchanged)');
  });
});

test('scenario 4: many commits, SCS unchanged → no plateau, no ETA', () => {
  const { tmp } = mkBundleDir();
  const baseDay = Math.trunc((Date.now() - 1*86400000)/86400000);
  writeHistory(tmp, [
    { day: baseDay, scs: 0.60, tci: 0.60, mri: 0.20 },
    { day: baseDay+1, scs: 0.60, tci: 0.60, mri: 0.20 },
  ]);
  const ts = nowSecs();
  // Regular, modest commits — stable cadence; ensure deterministic spacing
  const log = buildLogSeries({
    count: 5,
    startTs: ts,
    intervalSec: 1200,
    makeFiles: () => ([{ a: 50, d: 10, file: 'out/ddl/schema.sql' }])
  });
  withFakeGit({ mergeBase: 'deadbeef', sinceLog: log, prLog: log }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main', MORIARTY_GIT_WINDOW_HOURS: '1' });
    assert.equal(json.plateauDetected, false);
    expectWithDump(!json.eta, 'ETA should be absent when SCS unchanged', json);
  });
});

test('scenario 13: SCS high, TCI low → TEST_LAG pattern and EXPLAIN TCI FAIL', () => {
  const { tmp } = mkBundleDir();
  const baseDay = Math.trunc((Date.now() - 5*86400000)/86400000);
  const pts = [
    { day: baseDay+0, scs: 0.70, tci: 0.60, mri: 0.20 },
    { day: baseDay+1, scs: 0.75, tci: 0.55, mri: 0.20 },
    { day: baseDay+2, scs: 0.80, tci: 0.50, mri: 0.20 },
    { day: baseDay+3, scs: 0.82, tci: 0.48, mri: 0.20 },
    { day: baseDay+4, scs: 0.85, tci: 0.45, mri: 0.20 },
  ];
  writeHistory(tmp, pts);
  const log = buildLog([{ ts: nowSecs(), files: [ { a: 5, d: 0, file: 'tests/foo.pgtap' } ] }]);
  withFakeGit({ mergeBase: 'deadbeef', sinceLog: log, prLog: log }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main' });
    const hasTestLag = Array.isArray(json.patterns) && json.patterns.some(p => p.type === 'TEST_LAG');
    assert.ok(hasTestLag, 'Expected TEST_LAG pattern');
    assert.ok(json.explain);
    assert.equal(json.explain.readiness.scs.pass, true);
    assert.equal(json.explain.readiness.tci.pass, false);
  });
});

test('scenario 25: High SCS/TCI but MRI spike → EXPLAIN MRI FAIL', () => {
  const { tmp } = mkBundleDir();
  const baseDay = Math.trunc((Date.now() - 2*86400000)/86400000);
  writeHistory(tmp, [
    { day: baseDay, scs: 0.85, tci: 0.80, mri: 0.20 },
    { day: baseDay+1, scs: 0.86, tci: 0.82, mri: 0.55 },
  ]);
  const log = buildLog([{ ts: nowSecs(), files: [ { a: 10, d: 200, file: 'out/ddl/schema.sql' } ] }]);
  withFakeGit({ mergeBase: 'deadbeef', sinceLog: log, prLog: log }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main' });
    assert.ok(json.explain);
    assert.equal(json.explain.readiness.scs.pass, true);
    assert.equal(json.explain.readiness.tci.pass, true);
    assert.equal(json.explain.readiness.mri.pass, false);
  });
});

test('scenario 8: velocity cliff pattern appears', () => {
  const { tmp } = mkBundleDir();
  const baseDay = Math.trunc((Date.now() - 5*86400000)/86400000);
  // Build increasing then flattening SCS to trigger velocity cliff check
  writeHistory(tmp, [
    { day: baseDay+0, scs: 0.20, tci: 0.30, mri: 0.20 },
    { day: baseDay+1, scs: 0.40, tci: 0.35, mri: 0.19 },
    { day: baseDay+2, scs: 0.55, tci: 0.40, mri: 0.18 },
    { day: baseDay+3, scs: 0.56, tci: 0.42, mri: 0.18 },
    { day: baseDay+4, scs: 0.57, tci: 0.44, mri: 0.18 },
  ]);
  const log = buildLog([{ ts: nowSecs(), files: [ { a: 20, d: 0, file: 'schema.graphql' } ] }]);
  withFakeGit({ mergeBase: 'deadbeef', sinceLog: log, prLog: log }, () => {
    const json = runPredict(repoRoot, tmp, { MORIARTY_BASE_REF: 'main' });
    const hasCliff = Array.isArray(json.patterns) && json.patterns.some(p => p.type === 'VELOCITY_CLIFF');
    assert.ok(hasCliff, 'Expected VELOCITY_CLIFF pattern');
  });
});
