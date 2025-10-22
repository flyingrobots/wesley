import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
const cliPath = path.join(repoRoot, 'packages', 'wesley-holmes', 'src', 'cli.mjs');
function runCli(command, jsonName) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-cli-'));
  const bundleDir = path.join(tempDir, '.wesley');
  const jsonPath = path.join(tempDir, `${jsonName}.json`);

  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(path.join(bundleDir, 'bundle.json'), JSON.stringify({
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    timestamp: '2025-10-22T00:00:00Z',
    bundleVersion: '1.0.0',
    evidence: {
      evidence: {
        'Document.title': {
          sql: [{ file: 'schema.graphql', lines: '10-12' }],
          tests: [{ file: 'tests/document.pgtap', lines: '5-8' }]
        }
      }
    },
    scores: {
      scores: {
        scs: 0.85,
        tci: 0.72,
        mri: 0.18,
        breakdown: {
          scs: {
            sql: { score: 0.9, totalWeight: 10, coveredWeight: 9, total: 10, covered: 9, contribution: 0.9, points: 90 },
            types: { score: 0.8, totalWeight: 8, coveredWeight: 6, total: 8, covered: 6, contribution: 0.8, points: 64 },
            validation: { score: 0.75, totalWeight: 6, coveredWeight: 4, total: 6, covered: 4, contribution: 0.75, points: 45 },
            tests: { score: 0.7, totalWeight: 5, coveredWeight: 3, total: 5, covered: 3, contribution: 0.7, points: 35 }
          },
          tci: {
            unitConstraints: { score: 0.7, totalWeight: 6, coveredWeight: 4, total: 6, covered: 4, contribution: 0.7, points: 42 },
            rls: { score: 0.65, totalWeight: 4, coveredWeight: 3, total: 4, covered: 3, contribution: 0.65, points: 26 },
            integrationRelations: { score: 0.8, totalWeight: 5, coveredWeight: 4, total: 5, covered: 4, contribution: 0.8, points: 40 },
            e2eOps: { score: 0.6, totalWeight: 3, coveredWeight: 2, total: 3, covered: 2, contribution: 0.6, points: 18 }
          },
          mri: {
            drops: { score: 0.95, totalWeight: 2, coveredWeight: 2, total: 2, covered: 2, contribution: 0.95, points: 19 },
            renames: { score: 0.9, totalWeight: 2, coveredWeight: 2, total: 2, covered: 2, contribution: 0.9, points: 18 },
            defaults: { score: 0.85, totalWeight: 3, coveredWeight: 3, total: 3, covered: 3, contribution: 0.85, points: 25 },
            typeChanges: { score: 0.8, totalWeight: 3, coveredWeight: 2, total: 3, covered: 2, contribution: 0.8, points: 24 },
            indexes: { score: 0.88, totalWeight: 2, coveredWeight: 2, total: 2, covered: 2, contribution: 0.88, points: 18 },
            other: { score: 0.9, totalWeight: 2, coveredWeight: 2, total: 2, covered: 2, contribution: 0.9, points: 18 }
          }
        }
      },
      readiness: {
        verdict: 'ELEMENTARY'
      }
    },
    schema: {}
  }, null, 2));

  writeFileSync(path.join(bundleDir, 'history.json'), JSON.stringify({
    points: [
      { day: 0, scs: 0.1, tci: 0.05, mri: 0.3 },
      { day: 1, scs: 0.4, tci: 0.25, mri: 0.25 },
      { day: 2, scs: 0.7, tci: 0.5, mri: 0.2 }
    ]
  }, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    command,
    '--bundle-dir',
    bundleDir,
    '--history-file',
    path.join(bundleDir, 'history.json'),
    '--json',
    jsonPath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  try {
    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('#'), 'CLI output should include markdown content');
    assert.ok(existsSync(jsonPath), 'JSON report file should be written');
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.ok(typeof parsed === 'object' && parsed !== null, 'JSON output should be an object');
    return result.stdout;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('holmes CLI investigate accepts explicit bundle directory', () => {
  const stdout = runCli('investigate', 'holmes-report');
  assert.ok(stdout.includes('SHA-lock HOLMES'), 'Investigation output should mention HOLMES');
});

test('holmes CLI predict accepts explicit history file', () => {
  const stdout = runCli('predict', 'moriarty-report');
  assert.ok(stdout.includes('Professor Moriarty'), 'Prediction output should mention Moriarty');
});
