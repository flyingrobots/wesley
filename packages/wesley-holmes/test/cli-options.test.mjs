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
const wesleyCliPath = path.join(repoRoot, 'packages', 'wesley-host-node', 'bin', 'wesley.mjs');

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
  writeFileSync(schemaPath, 'type Query { hello: String }\n');

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

function initGitFixture(tempDir) {
  runGit(tempDir, 'init', '--initial-branch=main');
  runGit(tempDir, 'config', 'user.email', 'wesley-tests@example.com');
  runGit(tempDir, 'config', 'user.name', 'Wesley Tests');
  runGit(tempDir, 'add', '.');
  runGit(tempDir, 'commit', '-m', 'base');
  runGit(tempDir, 'checkout', '-b', 'feature');
  mkdirSync(path.join(tempDir, 'out'), { recursive: true });
  writeFileSync(path.join(tempDir, 'out', 'schema.sql'), '-- feature branch surface\n');
  writeFileSync(path.join(tempDir, '.wesley', 'plan-report.json'), JSON.stringify({
    plan: { phases: [{ phase: 1 }] },
    explain: { steps: [{ op: 'alter_table' }] }
  }, null, 2));
  const bundle = JSON.parse(readFileSync(path.join(tempDir, '.wesley', 'bundle.json'), 'utf8'));
  bundle.evidence.evidence['artifact:out/schema.sql'] = {
    sql: [{ file: 'out/schema.sql', lines: '1-1' }]
  };
  writeFileSync(path.join(tempDir, '.wesley', 'bundle.json'), JSON.stringify(bundle, null, 2));
  runGit(tempDir, 'add', '.');
  runGit(tempDir, 'commit', '-m', 'feature');
}

function runGit(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function persistTransformRun(fixture, runId, extraArgs = []) {
  const outDir = path.join(fixture.tempDir, 'out');
  mkdirSync(outDir, { recursive: true });
  const result = spawnSync(process.execPath, [
    wesleyCliPath,
    'transform',
    '--schema', fixture.schemaPath,
    '--out-dir', outDir,
    '--transmutation', 'legacy-supabase',
    '--run-id', runId,
    '--emit-bundle',
    '--json',
    '--quiet',
    ...extraArgs
  ], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
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
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0' }
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

test('holmes CLI predict emits counterfactual report without projection alias', () => {
  const fixture = createFixture();
  initGitFixture(fixture.tempDir);
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-counterfactual.json');
  const result = spawnSync(process.execPath, [
    cliPath,
    'predict',
    '--bundle-dir', fixture.bundleDir,
    '--history-file', fixture.historyPath,
    '--json', jsonPath,
    '--counterfactual', 'main'
  ], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0' }
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.ok(json.counterfactual, 'Counterfactual data should be present');
    assert.equal('projection' in json, false, 'Projection compatibility alias should be removed');
    assert.ok(result.stdout.includes('Counterfactual Analysis'));
    assert.equal(result.stdout.includes('Projection Compatibility'), false);
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI rejects removed project-merge flag', () => {
  const fixture = createFixture();
  const result = spawnSync(process.execPath, [
    cliPath,
    'predict',
    '--bundle-dir', fixture.bundleDir,
    '--history-file', fixture.historyPath,
    '--project-merge', 'main'
  ], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0' }
  });

  try {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes('unknown option'));
    assert.ok(result.stderr.includes('--project-merge'));
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI predict attaches persisted runtime run context', () => {
  const fixture = createFixture();
  persistTransformRun(fixture, 'run-holmes-ledger-123');
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-runtime.json');

  const result = spawnSync(process.execPath, [
    cliPath,
    'predict',
    '--bundle-dir', fixture.bundleDir,
    '--history-file', fixture.historyPath,
    '--json', jsonPath,
    '--run-id', 'run-holmes-ledger-123',
    '--transmutation', 'legacy-supabase'
  ], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0' }
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.metadata.runId, 'run-holmes-ledger-123');
    assert.equal(json.metadata.transmutation, 'legacy-supabase');
    assert.equal(json.runtime.run.runId, 'run-holmes-ledger-123');
    assert.equal(json.runtime.run.status, 'completed');
    assert.equal(json.runtime.replay.valid, true);
    assert.ok(result.stdout.includes('Runtime Run Context'));
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI predict fails when requested runtime run is missing', () => {
  const fixture = createFixture();
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-runtime-missing.json');
  const result = spawnSync(process.execPath, [
    cliPath,
    'predict',
    '--bundle-dir', fixture.bundleDir,
    '--history-file', fixture.historyPath,
    '--json', jsonPath,
    '--run-id', 'run-holmes-missing',
    '--transmutation', 'legacy-supabase'
  ], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0' }
  });

  try {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes('No persisted run found'));
  } finally {
    fixture.cleanup();
  }
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
