/**
 * Runs Command - Inspect and replay persisted runtime runs
 */

import {
  inspectRuntimeRunStreams,
  listRuntimeRunReports,
  readRuntimeRunRecord,
  resolveRuntimeRunStream,
  summarizeRuntimeRunDoctor,
  WesleyError
} from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class RunsCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'runs', 'Inspect and replay persisted runtime runs');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
    cmd
      .command('doctor')
      .description('Check persisted runtime runs for ledger health issues')
      .option('--transmutation <name>', 'Filter runs by transmutation name')
      .option('--limit <n>', 'Maximum number of streams to inspect', '100')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute(
          {
            ...mergeCommandOptions(command),
            ...options,
            _runsSubcommand: 'doctor'
          },
          command
        );
      });

    cmd
      .command('status')
      .description('List persisted runtime runs from the ledger')
      .option('--transmutation <name>', 'Filter runs by transmutation name')
      .option(
        '--status <state>',
        'Filter runs by status: pending|running|completed|failed|cancelled'
      )
      .option('--limit <n>', 'Maximum number of runs to return', '20')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute(
          {
            ...mergeCommandOptions(command),
            ...options,
            _runsSubcommand: 'status'
          },
          command
        );
      });

    cmd
      .command('replay')
      .description('Replay a persisted runtime run from the ledger')
      .requiredOption('--run-id <id>', 'Run ID to replay')
      .option('--transmutation <name>', 'Transmutation name for direct stream lookup')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute(
          {
            ...mergeCommandOptions(command),
            ...options,
            _runsSubcommand: 'replay'
          },
          command
        );
      });

    cmd
      .command('inspect')
      .description('Inspect a persisted runtime run from the ledger')
      .requiredOption('--run-id <id>', 'Run ID to inspect')
      .option('--transmutation <name>', 'Transmutation name for direct stream lookup')
      .option('--json', 'Emit JSON')
      .action((options, command) => {
        return this.execute(
          {
            ...mergeCommandOptions(command),
            ...options,
            _runsSubcommand: 'inspect'
          },
          command
        );
      });

    return cmd;
  }

  async executeCore(context) {
    if (context.options._runsSubcommand === 'doctor') {
      return this.executeDoctor(context);
    }
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

  async executeDoctor({ options, logger }) {
    const eventStore = this.requireEventStore();
    const filters = {
      transmutation: normalizeOptionalString(options.transmutation),
      limit: parseLimit(options.limit, 100)
    };
    const streams = this.inspectRunStreams(eventStore, filters);
    const summary = summarizeRuntimeRunDoctor(streams);
    const payload = { summary, streams };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    logger.info(
      `Ledger health: ${summary.healthyStreams}/${summary.streamCount} healthy, ${summary.unhealthyStreams} unhealthy`
    );
    if (summary.readErrorStreams > 0) {
      logger.info(`Read errors: ${summary.readErrorStreams}`);
    }
    if (summary.nonTerminalStreams > 0) {
      logger.info(`Non-terminal streams: ${summary.nonTerminalStreams}`);
    }
    if (summary.integrityIssueStreams > 0) {
      logger.info(`Integrity issue streams: ${summary.integrityIssueStreams}`);
    }

    for (const stream of streams.filter((entry) => !entry.healthy)) {
      logger.info(`Stream: ${stream.streamId}`);
      logger.info(
        `  run=${stream.run?.runId || 'n/a'} transmutation=${stream.run?.transmutation || 'n/a'} status=${stream.run?.status || 'unknown'}`
      );
      for (const finding of stream.findings) {
        logger.info(`  ${finding.code}: ${finding.message}`);
      }
    }

    return payload;
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
        logger.info(
          `  failure=${run.failure.code}${run.failure.message ? ` ${run.failure.message}` : ''}`
        );
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

    const { streamId } = resolveRuntimeRunStream(eventStore, { runId, transmutation });
    const record = readRuntimeRunRecord(eventStore, streamId, {
      runId,
      transmutation,
      includeEvents: true
    });
    const payload = {
      run: record.run,
      replay: record.replay,
      snapshot: record.snapshot,
      tailEvents: record.tailEvents,
      events: record.events
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
    logger.info(
      `Snapshot: ${payload.snapshot ? `yes (seq=${payload.snapshot.lastSequence})` : 'no'}`
    );
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

    const { streamId } = resolveRuntimeRunStream(eventStore, { runId, transmutation });
    const record = readRuntimeRunRecord(eventStore, streamId, {
      runId,
      transmutation,
      includeEvents: true
    });
    const payload = {
      run: record.run,
      snapshot: record.snapshot,
      tailEvents: record.tailEvents,
      events: record.events
    };

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return;
    }

    logger.info(`Run: ${record.run.runId}`);
    logger.info(`Transmutation: ${record.run.transmutation}`);
    logger.info(`Command: ${record.run.command || 'n/a'}`);
    logger.info(`Status: ${record.run.status}`);
    logger.info(`Stream: ${record.run.streamId}`);
    logger.info(`Events: ${record.run.eventCount}`);
    logger.info(`Artifacts: ${record.run.artifactCount}`);
    logger.info(
      `Snapshot: ${record.snapshot ? `yes (seq=${record.snapshot.lastSequence})` : 'no'}`
    );
    if (record.run.startedAt) logger.info(`Started: ${record.run.startedAt}`);
    if (record.run.completedAt) logger.info(`Completed: ${record.run.completedAt}`);
    if (record.run.failure?.code) {
      logger.info(
        `Failure: ${record.run.failure.code}${record.run.failure.message ? ` - ${record.run.failure.message}` : ''}`
      );
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
    return listRuntimeRunReports(eventStore, filters);
  }

  inspectRunStreams(eventStore, filters = {}) {
    return inspectRuntimeRunStreams(eventStore, filters);
  }
}
const RUNTIME_RUN_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'cancelled']);

function parseLimit(value, fallback = 20) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
