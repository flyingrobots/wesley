/**
 * Runs Command - Inspect persisted runtime runs
 */

import { buildRuntimeRunReport, createRuntimeStreamId, WesleyError } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class RunsCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'runs', 'Inspect persisted runtime runs');
    this.requiresSchema = false;
  }

  configureCommander(cmd) {
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
    if (context.options._runsSubcommand === 'inspect') {
      return this.executeInspect(context);
    }

    context.command?.outputHelp?.();
    return;
  }

  async executeInspect({ options, logger }) {
    const eventStore = this.ctx?.eventStore;
    if (!eventStore || typeof eventStore.readStream !== 'function') {
      throw new WesleyError('NO_EVENT_STORE', 'No event store is configured for this runtime.');
    }

    const runId = String(options.runId || '').trim();
    const transmutation = typeof options.transmutation === 'string' && options.transmutation.trim()
      ? options.transmutation.trim()
      : null;
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
