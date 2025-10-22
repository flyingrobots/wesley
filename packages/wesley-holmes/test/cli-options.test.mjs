import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
const cliPath = path.join(repoRoot, 'packages', 'wesley-holmes', 'src', 'cli.mjs');

const sampleBundle = {
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
};

const sampleHistory = {
  points: [
    { day: 0, scs: 0.1, tci: 0.05, mri: 0.3 },
    { day: 1, scs: 0.4, tci: 0.25, mri: 0.25 },
    { day: 2, scs: 0.7, tci: 0.5, mri: 0.2 }
  ]
};

function createFixture({ includeBundle = true, includeHistory = true, corruptBundle = false } = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-cli-'));
  const bundleDir = path.join(tempDir, '.wesley');
  const schemaDir = path.join(tempDir, 'schema');
  const schemaPath = path.join(schemaDir, 'schema.graphql');

  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  writeFileSync(schemaPath, `type Query { hello: String }\\n`);

  if (includeBundle) {
    const bundlePath = path.join(bundleDir, 'bundle.json');
    const contents = corruptBundle ? '{ invalid json' : JSON.stringify(sampleBundle, null, 2);
    writeFileSync(bundlePath, contents);
  }

  let historyPath;
  if (includeHistory) {
    historyPath = path.join(bundleDir, 'history.json');
    writeFileSync(historyPath, JSON.stringify(sampleHistory, null, 2));
  }

  return {
    tempDir,
    bundleDir,
    historyPath,
    schemaDir,
    schemaPath,
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function runCli(command, {
  jsonName = `${command}-report`,
  extraArgs = [],
  fixtureOptions = {},
  expectSuccess = true
} = {}) {
  const fixture = createFixture(fixtureOptions);
  const args = [cliPath, command, '--bundle-dir', fixture.bundleDir];
  let jsonPath;

  if (fixture.historyPath) {
    args.push('--history-file', fixture.historyPath);
  }

  if (jsonName) {
    jsonPath = path.join(fixture.schemaDir, `${jsonName}.json`);
    args.push('--json', jsonPath);
  }

  args.push(...extraArgs);

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  let parsed = null;
  try {
    if (expectSuccess) {
      assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);
      assert.ok(result.stdout.includes('#'), 'CLI output should include markdown content');
      if (jsonName) {
        assert.ok(existsSync(jsonPath), 'JSON report file should be written');
        parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
        assert.ok(typeof parsed === 'object' && parsed !== null, 'JSON output should be an object');
      }
    } else {
      assert.notEqual(result.status, 0, 'CLI should fail');
    }

    return { stdout: result.stdout, stderr: result.stderr, json: parsed, status: result.status };
  } finally {
    fixture.cleanup();
  }
}

function runWeights(options = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-weights-'));
  const weightsPath = path.join(tempDir, 'weights.json');
  if (options.writeWeights) {
    writeFileSync(weightsPath, JSON.stringify(options.writeWeights, null, 2));
  }

  const args = [cliPath, 'weights', '--file', weightsPath];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  try {
    if (options.expectSuccess !== false) {
      assert.equal(result.status, 0, `weights exited with ${result.status}: ${result.stderr}`);
      assert.ok(result.stdout.includes('weights configuration valid'));
    } else {
      assert.notEqual(result.status, 0, 'weights command should fail');
    }
    return result;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('holmes CLI investigate accepts explicit bundle directory', () => {
  const { stdout } = runCli('investigate');
  assert.ok(stdout.includes('SHA-lock HOLMES'), 'Investigation output should mention HOLMES');
});

test('holmes CLI verify accepts explicit bundle directory', () => {
  const { stdout } = runCli('verify', { jsonName: 'watson-report' });
  assert.ok(stdout.includes('Dr. Watson'), 'Verification output should mention Watson');
});

test('holmes CLI predict accepts explicit history file', () => {
  const { stdout } = runCli('predict', { jsonName: 'moriarty-report' });
  assert.ok(stdout.includes('Professor Moriarty'), 'Prediction output should mention Moriarty');
});

test('holmes CLI report emits combined JSON with overrides', () => {
  const { stdout, json } = runCli('report', { jsonName: 'combined-report' });
  assert.ok(stdout.includes('The Case of Schema Investigation')); 
  assert.ok(json?.holmes, 'Combined report should include HOLMES data');
  assert.ok(json?.watson, 'Combined report should include WATSON data');
  assert.ok(json?.moriarty, 'Combined report should include MORIARTY data');
});

test('weights command validates custom configuration', () => {
  runWeights({ writeWeights: { default: 6, password: 12 }, expectSuccess: true });
});

test('weights command fails when file missing', () => {
  const result = runWeights({ expectSuccess: false });
  assert.ok(result.stderr.includes('Weight configuration invalid'), 'Missing weights should report failure');
});

test('holmes CLI fails when bundle missing', () => {
  const { stderr, status } = runCli('investigate', {
    expectSuccess: false,
    fixtureOptions: { includeBundle: false }
  });
  assert.ok(stderr.includes('No Wesley bundle found'), 'Should report missing bundle');
  assert.notEqual(status, 0);
});

test('holmes CLI fails when bundle JSON is invalid', () => {
  const { stderr, status } = runCli('investigate', {
    expectSuccess: false,
    fixtureOptions: { corruptBundle: true }
  });
  assert.ok(stderr.includes('Unable to read Wesley bundle'), 'Should report corrupted bundle');
  assert.notEqual(status, 0);
});
