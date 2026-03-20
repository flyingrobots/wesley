/**
 * Runs Command - Inspect and replay persisted runtime runs
 */

import { buildRuntimeRunReport, createRuntimeStreamId, replayRuntimeRun, WesleyError } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class RunsCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'runs', 'Inspect and replay persisted runtime runs');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
    cmd
      .command('status')
      .description('List persisted runtime runs from the ledger')
      .option('--transmutation <name>', 'Filter runs by transmutation name')
      .option('--status <state>', 'Filter runs by status: pending|running|completed|failed|cancelled')
      .option('--limit <n>', 'Maximum number of runs to return', '20')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute({
          ...mergeCommandOptions(command),
          ...options,
          _runsSubcommand: 'status'
        }, command);
      });

    cmd
      .command('replay')
      .description('Replay a persisted runtime run from the ledger')
      .requiredOption('--run-id <id>', 'Run ID to replay')
      .option('--transmutation <name>', 'Transmutation name for direct stream lookup')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute({
          ...mergeCommandOptions(command),
          ...options,
          _runsSubcommand: 'replay'
        }, command);
      });

    cmd
      .command('inspect')
      .description('Inspect a persisted runtime run from the ledger')
      .requiredOption('--run-id <id>', 'Run ID to inspect')
      .option('--transmutation <name>', 'Transmutation name for direct stream lookup')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute({
          ...mergeCommandOptions(command),
          ...options,
          _runsSubcommand: 'inspect'
        }, command);
      });

    return cmd;
  }

  async executeCore(context) {
    if (context.options._runsSubcommand === 'status') {
      return this.executeStatus(context);
    }
    if (context.options._runsSubcommand === 'replay') {
      return this.executeReplay(context);
    }
    if (context.options._runsSubcommand === 'inspect') {
      return this.executeInspect(context);
    }

    context.command?.outputHelp?.();
    return;
  }

  async executeStatus({ options, logger }) {
    const eventStore = this.requireEventStore();
    const filters = {
      transmutation: normalizeOptionalString(options.transmutation),
      status: normalizeOptionalString(options.status),
      limit: parseLimit(options.limit)
    };
    if (filters.status && !RUNTIME_RUN_STATUSES.has(filters.status)) {
      throw new WesleyError(
        'EUSAGE',
        `Unsupported run status "${filters.status}". Expected one of: ${Array.from(RUNTIME_RUN_STATUSES).join(', ')}.`
      );
    }

    const runs = this.listRunReports(eventStore, filters);
    const payload = {
      count: runs.length,
      runs
    };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    if (runs.length === 0) {
      logger.info('No persisted runs found.');
      return payload;
    }

    logger.info(`Persisted runs: ${runs.length}`);
    for (const run of runs) {
      logger.info(
        `${run.runId}  ${run.transmutation || 'n/a'}  ${run.command || 'n/a'}  ${run.status}  events=${run.eventCount} artifacts=${run.artifactCount}`
      );
      if (run.lastEventAt) {
        logger.info(`  last=${run.lastEventAt} stream=${run.streamId}`);
      }
      if (run.failure?.code) {
        logger.info(`  failure=${run.failure.code}${run.failure.message ? ` ${run.failure.message}` : ''}`);
      }
    }

    return payload;
  }

  async executeReplay({ options, logger }) {
    const eventStore = this.requireEventStore();
    const runId = String(options.runId || '').trim();
    const transmutation = normalizeOptionalString(options.transmutation);
    if (!runId) {
      throw new WesleyError('EUSAGE', 'runs replay requires --run-id.');
    }

    const { streamId, events } = this.resolveRunStream(eventStore, runId, transmutation);
    const payload = {
      ...replayRuntimeRun(events, {
        runId,
        transmutation: transmutation || events[0]?.transmutation || null,
        streamId
      }),
      events
    };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    logger.info(`Run: ${payload.run.runId}`);
    logger.info(`Transmutation: ${payload.run.transmutation}`);
    logger.info(`Status: ${payload.run.status}`);
    logger.info(`Replay valid: ${payload.replay.integrity.valid ? 'yes' : 'no'}`);
    logger.info(`Applied events: ${payload.replay.appliedEventCount}/${payload.replay.eventCount}`);
    logger.info(`Terminal: ${payload.replay.terminal ? 'yes' : 'no'}`);
    logger.info(`Stream: ${payload.run.streamId}`);
    if (payload.replay.integrity.issues.length > 0) {
      logger.info('Replay issues:');
      for (const issue of payload.replay.integrity.issues) {
        logger.info(`  ${issue.code}: ${issue.message}`);
      }
    }

    return payload;
  }

  async executeInspect({ options, logger }) {
    const eventStore = this.requireEventStore();

    const runId = String(options.runId || '').trim();
    const transmutation = normalizeOptionalString(options.transmutation);
    if (!runId) {
      throw new WesleyError('EUSAGE', 'runs inspect requires --run-id.');
    }

    const { streamId, events } = this.resolveRunStream(eventStore, runId, transmutation);
    const run = buildRuntimeRunReport(events, {
      runId,
      transmutation: transmutation || events[0]?.transmutation || null,
      streamId
    });
    const payload = { run, events };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    logger.info(`Run: ${run.runId}`);
    logger.info(`Transmutation: ${run.transmutation}`);
    logger.info(`Command: ${run.command || 'n/a'}`);
    logger.info(`Status: ${run.status}`);
    logger.info(`Stream: ${run.streamId}`);
    logger.info(`Events: ${run.eventCount}`);
    logger.info(`Artifacts: ${run.artifactCount}`);
    if (run.startedAt) logger.info(`Started: ${run.startedAt}`);
    if (run.completedAt) logger.info(`Completed: ${run.completedAt}`);
    if (run.failure?.code) {
      logger.info(`Failure: ${run.failure.code}${run.failure.message ? ` - ${run.failure.message}` : ''}`);
    }

    return payload;
  }

  requireEventStore() {
    const eventStore = this.ctx?.eventStore;
    if (!eventStore || typeof eventStore.readStream !== 'function') {
      throw new WesleyError('NO_EVENT_STORE', 'No event store is configured for this runtime.');
    }
    return eventStore;
  }

  listRunReports(eventStore, filters = {}) {
    const streamIds = typeof eventStore.listStreams === 'function'
      ? eventStore.listStreams()
      : [];

    const runs = [];
    for (const streamId of streamIds) {
      const events = eventStore.readStream(streamId);
      if (events.length === 0) continue;
      const first = events[0] || {};
      const last = events.at(-1) || {};
      const run = buildRuntimeRunReport(events, {
        runId: last.runId ?? first.runId ?? null,
        transmutation: last.transmutation ?? first.transmutation ?? null,
        streamId
      });
      if (!run.runId) continue;
      if (filters.transmutation && run.transmutation !== filters.transmutation) continue;
      if (filters.status && run.status !== filters.status) continue;
      runs.push(run);
    }

    runs.sort((left, right) => compareRunsDescending(left, right));
    if (Number.isInteger(filters.limit) && filters.limit >= 0) {
      return runs.slice(0, filters.limit);
    }
    return runs;
  }

  resolveRunStream(eventStore, runId, transmutation) {
    if (transmutation) {
      const streamId = createRuntimeStreamId({ transmutation, runId });
      const events = eventStore.readStream(streamId);
      if (events.length === 0) {
        throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for ${transmutation}/${runId}.`);
      }
      return { streamId, events };
    }

    const streamIds = typeof eventStore.listStreams === 'function'
      ? eventStore.listStreams()
      : [];
    const matches = [];

    for (const streamId of streamIds) {
      const events = eventStore.readStream(streamId);
      if (events.some(event => event.runId === runId)) {
        matches.push({ streamId, events });
      }
    }

    if (matches.length === 0) {
      throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for runId ${runId}.`);
    }
    if (matches.length > 1) {
      throw new WesleyError('RUN_AMBIGUOUS', `Multiple persisted runs match ${runId}; pass --transmutation.`);
    }

    return matches[0];
  }
}

const RUNTIME_RUN_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'cancelled']);

function compareRunsDescending(left, right) {
  return compareTimestampDescending(
    left.lastEventAt || left.completedAt || left.startedAt,
    right.lastEventAt || right.completedAt || right.startedAt
  ) || String(right.runId || '').localeCompare(String(left.runId || ''));
}

function compareTimestampDescending(left, right) {
  const leftTs = Date.parse(left || '');
  const rightTs = Date.parse(right || '');
  if (Number.isNaN(leftTs) && Number.isNaN(rightTs)) return 0;
  if (Number.isNaN(leftTs)) return 1;
  if (Number.isNaN(rightTs)) return -1;
  return rightTs - leftTs;
}

function parseLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mergeCommandOptions(command) {
  if (!command) return {};
  if (typeof command.optsWithGlobals === 'function') {
    return command.optsWithGlobals();
  }

  const merged = {};
  let current = command;
  while (current) {
    if (typeof current.opts === 'function') {
      Object.assign(merged, current.opts());
    }
    current = current.parent;
  }
  return merged;
}
