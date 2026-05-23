#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const bundleDir = process.env.SHIPME_BUNDLE_DIR || '.wesley-cache';
const outDir = process.env.SHIPME_OUT_DIR || 'out';
const evidenceDir = join(bundleDir, 'shipme-fixture');
const schemaEvidencePath = join(evidenceDir, 'schema.sql');
const testsEvidencePath = join(evidenceDir, 'tests.sql');
const fixtureSha = process.env.GITHUB_SHA || 'abcdef1234567890abcdef1234567890abcdef12';
const timestamp = '2026-01-01T00:00:00.000Z';

const scores = {
  version: '1.0.0',
  scores: {
    scs: 0.95,
    tci: 0.9,
    mri: 0.1
  },
  readiness: {
    verdict: 'ELEMENTARY'
  },
  breakdown: {
    scs: {
      sql: { score: 1, earnedWeight: 1, totalWeight: 1 },
      types: { score: 1, earnedWeight: 1, totalWeight: 1 },
      validation: { score: 1, earnedWeight: 1, totalWeight: 1 },
      tests: { score: 1, earnedWeight: 1, totalWeight: 1 }
    },
    tci: {
      unit_constraints: { score: 1, covered: 1, total: 1 },
      unit_rls: { score: 1, covered: 1, total: 1 },
      integration_relations: { score: 1, covered: 1, total: 1 },
      e2e_ops: { score: 0.9, covered: 9, total: 10, note: 'fixture' }
    },
    mri: {
      drops: { score: 0, points: 0, count: 0 },
      renames_without_uid: { score: 0, points: 0, count: 0 },
      add_not_null_without_default: { score: 0.1, points: 1, count: 1 },
      non_concurrent_indexes: { score: 0, points: 0, count: 0 },
      totalPoints: 1
    }
  }
};

const bundle = {
  bundleVersion: '2.0.0',
  sha: fixtureSha,
  timestamp,
  testResults: {
    verifications: [{ name: 'schema-sql', status: 'passed', file: 'schema.sql' }],
    execution: [{ type: 'pgtap', status: 'passed', file: 'tests.sql' }],
    conclusions: [{ type: 'ship-readiness', result: 'passed' }]
  },
  scores,
  evidence: {
    evidence: {
      schema: {
        sql: [{ file: schemaEvidencePath, lines: '1-2', sha: fixtureSha }],
        tests: [{ file: testsEvidencePath, lines: '1-1', sha: fixtureSha }]
      }
    }
  }
};

const realm = {
  transmutation: 'null-generator',
  runId: 'run-shipme-cert-fixture',
  provider: 'fixture',
  verdict: 'PASS',
  duration_ms: 1,
  steps: 1,
  timestamp
};

mkdirSync(bundleDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(schemaEvidencePath, 'one\ntwo\nthree\n');
writeFileSync(testsEvidencePath, 'test line\nsecond test line\n');
writeFileSync(join(outDir, 'schema.sql'), 'one\ntwo\nthree\n');
writeFileSync(join(bundleDir, 'bundle.json'), JSON.stringify(bundle, null, 2));
writeFileSync(join(bundleDir, 'scores.json'), JSON.stringify(scores, null, 2));
writeFileSync(join(bundleDir, 'realm.json'), JSON.stringify(realm, null, 2));

console.log(`Prepared passing SHIPME certificate fixture in ${bundleDir}`);
