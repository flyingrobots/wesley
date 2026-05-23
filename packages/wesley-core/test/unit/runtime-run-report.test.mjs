import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimeRunReport } from '../../src/application/RuntimeRunReport.mjs';
import { createRuntimeEventCollector } from '../../src/application/RuntimeEvents.mjs';

const fakeClock = {
  _i: 0,
  now() {
    const value =
      [
        '2026-03-20T03:00:00.000Z',
        '2026-03-20T03:00:01.000Z',
        '2026-03-20T03:00:02.000Z',
        '2026-03-20T03:00:03.000Z',
        '2026-03-20T03:00:04.000Z'
      ][this._i] || '2026-03-20T03:00:04.000Z';
    this._i += 1;
    return value;
  }
};

test('buildRuntimeRunReport summarizes a completed run stream', () => {
  fakeClock._i = 0;
  const collector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-report-001',
    transmutation: 'null-generator'
  });

  collector.emit('RunRequested', { command: 'plan', dryRun: true });
  collector.emit('TaskStarted', { taskId: 'null-generator:plan:build' });
  collector.emit('TaskCompleted', { taskId: 'null-generator:plan:build' });
  collector.emit('ArtifactsMaterialized', { artifactCount: 2 });
  collector.emit('RunCompleted', { command: 'plan', dryRun: true });

  const report = buildRuntimeRunReport(collector.events);

  assert.equal(report.runId, 'run-report-001');
  assert.equal(report.transmutation, 'null-generator');
  assert.equal(report.command, 'plan');
  assert.equal(report.status, 'completed');
  assert.equal(report.eventCount, 5);
  assert.equal(report.taskCounts.started, 1);
  assert.equal(report.taskCounts.completed, 1);
  assert.equal(report.artifactCount, 2);
  assert.equal(report.dryRun, true);
  assert.equal(report.startedAt, '2026-03-20T03:00:00.000Z');
  assert.equal(report.completedAt, '2026-03-20T03:00:04.000Z');
});

test('buildRuntimeRunReport summarizes a failed run stream', () => {
  fakeClock._i = 0;
  const collector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-report-002',
    transmutation: 'null-generator'
  });

  collector.emit('RunRequested', { command: 'rehearse' });
  collector.emit('TaskStarted', { taskId: 'null-generator:rehearse:apply' });
  collector.emit('TaskFailed', {
    taskId: 'null-generator:rehearse:apply',
    errorCode: 'NO_DSN',
    errorMessage: 'No DSN provided'
  });
  collector.emit('RunFailed', {
    command: 'rehearse',
    code: 'NO_DSN',
    message: 'No DSN provided'
  });

  const report = buildRuntimeRunReport(collector.events);

  assert.equal(report.status, 'failed');
  assert.equal(report.command, 'rehearse');
  assert.equal(report.taskCounts.failed, 1);
  assert.equal(report.failure.code, 'NO_DSN');
  assert.equal(report.failure.message, 'No DSN provided');
  assert.equal(report.completedAt, '2026-03-20T03:00:03.000Z');
});
