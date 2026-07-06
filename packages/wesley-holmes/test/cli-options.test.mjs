import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createRuntimeStreamId, GitWarpEventStore } from '../src/support/runtime-ledger.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
const cliPath = path.join(repoRoot, 'packages', 'wesley-holmes', 'src', 'cli.mjs');
const moriartyCliPath = path.join(repoRoot, 'packages', 'wesley-holmes', 'src', 'moriarty-cli.mjs');
const counterfactualModulePath = fileURLToPath(
  new URL('./fixtures/counterfactual-provider-module.mjs', import.meta.url)
);

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
          sql: {
            score: 0.9,
            totalWeight: 10,
            coveredWeight: 9,
            total: 10,
            covered: 9,
            contribution: 0.9,
            points: 90
          },
          types: {
            score: 0.8,
            totalWeight: 8,
            coveredWeight: 6,
            total: 8,
            covered: 6,
            contribution: 0.8,
            points: 64
          },
          validation: {
            score: 0.75,
            totalWeight: 6,
            coveredWeight: 4,
            total: 6,
            covered: 4,
            contribution: 0.75,
            points: 45
          },
          tests: {
            score: 0.7,
            totalWeight: 5,
            coveredWeight: 3,
            total: 5,
            covered: 3,
            contribution: 0.7,
            points: 35
          }
        },
        tci: {
          unitConstraints: {
            score: 0.7,
            totalWeight: 6,
            coveredWeight: 4,
            total: 6,
            covered: 4,
            contribution: 0.7,
            points: 42
          },
          rls: {
            score: 0.65,
            totalWeight: 4,
            coveredWeight: 3,
            total: 4,
            covered: 3,
            contribution: 0.65,
            points: 26
          },
          integrationRelations: {
            score: 0.8,
            totalWeight: 5,
            coveredWeight: 4,
            total: 5,
            covered: 4,
            contribution: 0.8,
            points: 40
          },
          e2eOps: {
            score: 0.6,
            totalWeight: 3,
            coveredWeight: 2,
            total: 3,
            covered: 2,
            contribution: 0.6,
            points: 18
          }
        },
        mri: {
          drops: {
            score: 0.95,
            totalWeight: 2,
            coveredWeight: 2,
            total: 2,
            covered: 2,
            contribution: 0.95,
            points: 19
          },
          renames: {
            score: 0.9,
            totalWeight: 2,
            coveredWeight: 2,
            total: 2,
            covered: 2,
            contribution: 0.9,
            points: 18
          },
          defaults: {
            score: 0.85,
            totalWeight: 3,
            coveredWeight: 3,
            total: 3,
            covered: 3,
            contribution: 0.85,
            points: 25
          },
          typeChanges: {
            score: 0.8,
            totalWeight: 3,
            coveredWeight: 2,
            total: 3,
            covered: 2,
            contribution: 0.8,
            points: 24
          },
          indexes: {
            score: 0.88,
            totalWeight: 2,
            coveredWeight: 2,
            total: 2,
            covered: 2,
            contribution: 0.88,
            points: 18
          },
          other: {
            score: 0.9,
            totalWeight: 2,
            coveredWeight: 2,
            total: 2,
            covered: 2,
            contribution: 0.9,
            points: 18
          }
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

function createFixture({
  includeBundle = true,
  includeHistory = true,
  corruptBundle = false
} = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-cli-'));
  const bundleDir = path.join(tempDir, '.wesley-cache');
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
  writeFileSync(
    path.join(tempDir, '.wesley-cache', 'plan-report.json'),
    JSON.stringify(
      {
        plan: { phases: [{ phase: 1 }] },
        explain: { steps: [{ op: 'alter_table' }] }
      },
      null,
      2
    )
  );
  const bundle = JSON.parse(
    readFileSync(path.join(tempDir, '.wesley-cache', 'bundle.json'), 'utf8')
  );
  bundle.evidence.evidence['artifact:out/schema.sql'] = {
    sql: [{ file: 'out/schema.sql', lines: '1-1' }]
  };
  writeFileSync(
    path.join(tempDir, '.wesley-cache', 'bundle.json'),
    JSON.stringify(bundle, null, 2)
  );
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
  assert.deepEqual(extraArgs, [], 'persistTransformRun no longer shells through legacy Node CLI');
  const outDir = path.join(fixture.tempDir, 'out');
  mkdirSync(outDir, { recursive: true });
  const transmutation = 'null-generator';
  const streamId = createRuntimeStreamId({ transmutation, runId });
  const eventStore = new GitWarpEventStore({
    rootDir: path.join(fixture.tempDir, '.wesley-cache', 'ledger')
  });
  const command = 'transform';
  const baseEvent = {
    streamId,
    schemaVersion: '1.0.0',
    timestamp: '2026-01-01T00:00:00.000Z',
    causationId: null,
    correlationId: runId,
    runId,
    transmutation
  };

  for (const event of [
    {
      ...baseEvent,
      eventId: `${streamId}:1`,
      type: 'RunRequested',
      sequence: 1,
      idempotencyKey: `${streamId}:requested`,
      payload: { command }
    },
    {
      ...baseEvent,
      eventId: `${streamId}:2`,
      type: 'TaskStarted',
      sequence: 2,
      idempotencyKey: `${streamId}:main:started`,
      payload: { command }
    },
    {
      ...baseEvent,
      eventId: `${streamId}:3`,
      type: 'TaskCompleted',
      sequence: 3,
      idempotencyKey: `${streamId}:main:completed`,
      payload: { command }
    },
    {
      ...baseEvent,
      eventId: `${streamId}:4`,
      type: 'RunCompleted',
      sequence: 4,
      idempotencyKey: `${streamId}:completed`,
      payload: { command, verdict: 'PASS' }
    }
  ]) {
    eventStore.append(event);
  }
}

function runCli(
  command,
  { jsonName = `${command}-report`, extraArgs = [], fixtureOptions = {}, expectSuccess = true } = {}
) {
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
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
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

function inspectPersistedRun(fixture, runId, transmutation) {
  const result = spawnSync(
    process.execPath,
    [cliPath, 'runs', 'inspect', '--run-id', runId, '--transmutation', transmutation, '--json'],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env }
    }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function listPersistedRuns(fixture, transmutation, status = null) {
  const args = [
    cliPath,
    'runs',
    'status',
    '--transmutation',
    transmutation,
    '--limit',
    '10',
    '--json'
  ];
  if (status) {
    args.push('--status', status);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runHolmesRunsStatus(fixture, extraArgs = []) {
  const result = spawnSync(process.execPath, [cliPath, 'runs', 'status', '--json', ...extraArgs], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runHolmesRunsInspect(fixture, runId, transmutation) {
  const result = spawnSync(
    process.execPath,
    [cliPath, 'runs', 'inspect', '--run-id', runId, '--transmutation', transmutation, '--json'],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
    }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runWeights(options = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'holmes-weights-'));
  const weightsPath = path.join(tempDir, 'weights.json');
  const jsonPath = path.join(tempDir, 'weights-output.json');
  if (options.writeWeights) {
    writeFileSync(weightsPath, JSON.stringify(options.writeWeights, null, 2));
  }

  const args = [cliPath, 'weights', '--file', weightsPath];
  if (options.jsonOutput) {
    args.push('--json', jsonPath);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  try {
    let jsonOutput;
    if (options.expectSuccess !== false) {
      assert.equal(result.status, 0, `weights exited with ${result.status}: ${result.stderr}`);
      assert.ok(result.stdout.includes('weights configuration valid'));
      if (options.jsonOutput) {
        assert.ok(existsSync(jsonPath), 'weights --json should write the requested output file');
        jsonOutput = JSON.parse(readFileSync(jsonPath, 'utf8'));
      }
    } else {
      assert.notEqual(result.status, 0, 'weights command should fail');
    }
    return { ...result, jsonOutput };
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

test('moriarty entry point runs independently of holmes CLI', () => {
  const fixture = createFixture();
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-standalone.json');
  const result = spawnSync(process.execPath, [moriartyCliPath, '--json', jsonPath], {
    cwd: fixture.tempDir,
    encoding: 'utf8',
    env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('Professor Moriarty'));
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.status, 'OK');
    assert.equal(json.commandRun.run.transmutation, 'moriarty-predict');
    const inspected = inspectPersistedRun(
      fixture,
      json.commandRun.run.runId,
      json.commandRun.run.transmutation
    );
    assert.equal(inspected.run.command, 'predict');
    assert.equal(inspected.run.status, 'completed');
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI report emits combined JSON with overrides', () => {
  const { stdout, json } = runCli('report', { jsonName: 'combined-report' });
  assert.ok(stdout.includes('The Case of Schema Investigation'));
  assert.ok(json?.holmes, 'Combined report should include HOLMES data');
  assert.ok(json?.watson, 'Combined report should include WATSON data');
  assert.ok(json?.moriarty, 'Combined report should include MORIARTY data');
});

test('holmes CLI report passes braid refs through to combined moriarty output', () => {
  const fixture = createFixture();
  initGitFixture(fixture.tempDir);
  runGit(fixture.tempDir, 'checkout', '-b', 'support', 'main');
  writeFileSync(
    path.join(fixture.tempDir, 'schema.graphql'),
    'type Query { hello: String support: String }\n'
  );
  runGit(fixture.tempDir, 'add', 'schema.graphql');
  runGit(fixture.tempDir, 'commit', '-m', 'support lane');
  runGit(fixture.tempDir, 'checkout', 'feature');

  const jsonPath = path.join(fixture.schemaDir, 'combined-braid-report.json');
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'report',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      jsonPath,
      '--counterfactual',
      'main',
      '--counterfactual-braid',
      'support'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
    }
  );

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.moriarty.counterfactual.composition, 'braid');
    assert.equal(json.moriarty.counterfactual.resolved.braidRefs.length, 1);
    assert.ok(json.moriarty.counterfactual.judgment.signals.includes('braid_present'));
    assert.ok(result.stdout.includes('Counterfactual Analysis'));
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI predict emits counterfactual report without projection alias', () => {
  const fixture = createFixture();
  initGitFixture(fixture.tempDir);
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-counterfactual.json');
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      jsonPath,
      '--counterfactual',
      'main'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
    }
  );

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.ok(json.counterfactual, 'Counterfactual data should be present');
    assert.equal('projection' in json, false, 'Projection compatibility alias should be removed');
    assert.ok(
      json.explain?.readiness?.counterfactual,
      'Counterfactual readiness signal should be present in Moriarty EXPLAIN'
    );
    assert.equal(typeof json.explain.readiness.counterfactual.pass, 'boolean');
    assert.ok(result.stdout.includes('Counterfactual Analysis'));
    assert.ok(result.stdout.includes('Counterfactual gate must be pass'));
    assert.equal(result.stdout.includes('Projection Compatibility'), false);
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI predict accepts braid refs on the public counterfactual lane', () => {
  const fixture = createFixture();
  initGitFixture(fixture.tempDir);
  runGit(fixture.tempDir, 'checkout', '-b', 'support', 'main');
  writeFileSync(
    path.join(fixture.tempDir, 'schema.graphql'),
    'type Query { hello: String support: String }\n'
  );
  runGit(fixture.tempDir, 'add', 'schema.graphql');
  runGit(fixture.tempDir, 'commit', '-m', 'support lane');
  runGit(fixture.tempDir, 'checkout', 'feature');

  const jsonPath = path.join(fixture.schemaDir, 'moriarty-braid.json');
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      jsonPath,
      '--counterfactual',
      'main',
      '--counterfactual-braid',
      'support'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0', WESLEY_MODULES: counterfactualModulePath }
    }
  );

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.counterfactual.composition, 'braid');
    assert.equal(json.counterfactual.resolved.braidRefs.length, 1);
    assert.ok(json.counterfactual.judgment.signals.includes('braid_present'));
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI rejects removed project-merge flag', () => {
  const fixture = createFixture();
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--project-merge',
      'main'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

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

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      jsonPath,
      '--run-id',
      'run-holmes-ledger-123',
      '--transmutation',
      'null-generator'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.metadata.runId, 'run-holmes-ledger-123');
    assert.equal(json.metadata.transmutation, 'null-generator');
    assert.equal(json.runtime.run.runId, 'run-holmes-ledger-123');
    assert.equal(json.runtime.run.status, 'completed');
    assert.equal(json.runtime.replay.valid, true);
    assert.notEqual(json.commandRun.run.runId, 'run-holmes-ledger-123');
    assert.equal(json.commandRun.run.transmutation, 'moriarty-predict');
    assert.ok(result.stdout.includes('Runtime Run Context'));
    const inspected = inspectPersistedRun(
      fixture,
      json.commandRun.run.runId,
      json.commandRun.run.transmutation
    );
    assert.equal(inspected.run.command, 'predict');
    assert.equal(inspected.run.status, 'completed');
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI investigate emits its own command run into the shared ledger', () => {
  const fixture = createFixture();
  const jsonPath = path.join(fixture.schemaDir, 'holmes-investigation.json');
  const result = spawnSync(
    process.execPath,
    [cliPath, 'investigate', '--bundle-dir', fixture.bundleDir, '--json', jsonPath],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

  try {
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(json.commandRun.run.transmutation, 'holmes-investigate');
    const inspected = inspectPersistedRun(
      fixture,
      json.commandRun.run.runId,
      json.commandRun.run.transmutation
    );
    assert.equal(inspected.run.command, 'investigate');
    assert.equal(inspected.run.status, 'completed');
  } finally {
    fixture.cleanup();
  }
});

test('holmes runs status defaults to holmes-family runs and can inspect them natively', () => {
  const fixture = createFixture();
  persistTransformRun(fixture, 'run-holmes-native-status');

  const investigateJsonPath = path.join(fixture.schemaDir, 'holmes-native-investigate.json');
  const predictJsonPath = path.join(fixture.schemaDir, 'holmes-native-predict.json');

  const investigate = spawnSync(
    process.execPath,
    [cliPath, 'investigate', '--bundle-dir', fixture.bundleDir, '--json', investigateJsonPath],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );
  const predict = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      predictJsonPath
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

  try {
    assert.equal(investigate.status, 0, investigate.stderr);
    assert.equal(predict.status, 0, predict.stderr);

    const status = runHolmesRunsStatus(fixture);
    assert.equal(status.count, 2);
    assert.deepEqual(status.runs.map((run) => run.transmutation).sort(), [
      'holmes-investigate',
      'moriarty-predict'
    ]);

    const inspect = runHolmesRunsInspect(
      fixture,
      status.runs.find((run) => run.transmutation === 'holmes-investigate').runId,
      'holmes-investigate'
    );
    assert.equal(inspect.run.command, 'investigate');
    assert.equal(inspect.run.status, 'completed');

    const allStatus = runHolmesRunsStatus(fixture, ['--all']);
    assert.ok(allStatus.runs.some((run) => run.transmutation === 'null-generator'));
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI investigate records failed command runs on bundle errors', () => {
  const fixture = createFixture({ includeBundle: false });
  const result = spawnSync(
    process.execPath,
    [cliPath, 'investigate', '--bundle-dir', fixture.bundleDir],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

  try {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes('No Wesley bundle found'));
    assert.ok(result.stderr.includes('holmes-investigate/'));
    const status = listPersistedRuns(fixture, 'holmes-investigate', 'failed');
    assert.equal(status.count, 1);
    assert.equal(status.runs[0].command, 'investigate');
    assert.equal(status.runs[0].status, 'failed');
  } finally {
    fixture.cleanup();
  }
});

test('holmes CLI predict fails when requested runtime run is missing', () => {
  const fixture = createFixture();
  const jsonPath = path.join(fixture.schemaDir, 'moriarty-runtime-missing.json');
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'predict',
      '--bundle-dir',
      fixture.bundleDir,
      '--history-file',
      fixture.historyPath,
      '--json',
      jsonPath,
      '--run-id',
      'run-holmes-missing',
      '--transmutation',
      'null-generator'
    ],
    {
      cwd: fixture.tempDir,
      encoding: 'utf8',
      env: { ...process.env, MORIARTY_USE_GIT: '0' }
    }
  );

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

test('weights command writes normalized JSON output', () => {
  const result = runWeights({
    writeWeights: {
      default: 6,
      substrings: { Email: 9 },
      directives: { '@PrimaryKey': 11 },
      overrides: { 'User.password': 13 }
    },
    jsonOutput: true,
    expectSuccess: true
  });

  assert.deepEqual(result.jsonOutput, {
    default: 6,
    substrings: {
      password: 10,
      email: 9,
      id: 7,
      user: 6,
      created: 5,
      theme: 2
    },
    directives: {
      primarykey: 11
    },
    overrides: {
      'User.password': 13
    }
  });
});

test('weights command fails when file missing', () => {
  const result = runWeights({ expectSuccess: false });
  assert.ok(
    result.stderr.includes('Weight configuration invalid'),
    'Missing weights should report failure'
  );
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
