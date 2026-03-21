import path from 'node:path';
import {
  buildRuntimeRunReport,
  createRunId,
  createRuntimeEventCollector
} from '@wesley/core';
import { GitWarpEventStore, resolveLedgerRootDir } from '@wesley/runtime-node';

const COMMAND_TRANSMUTATIONS = Object.freeze({
  investigate: 'holmes-investigate',
  verify: 'watson-verify',
  predict: 'moriarty-predict',
  report: 'holmes-report'
});

export async function withCommandRun({
  repoRoot,
  command,
  env = process.env,
  clock = null,
  sources = {},
  task
}) {
  if (typeof task !== 'function') {
    throw new TypeError('withCommandRun requires a task function');
  }

  const context = await createCommandRunContext({
    repoRoot,
    command,
    env,
    clock
  });
  const scope = createCommandRunScope(context.run);
  const taskId = `${scope}:main`;

  emitLifecycleEvent(context.eventCollector, scope, 'RunRequested', {
    command: context.run.command
  }, 'requested');
  emitLifecycleEvent(context.eventCollector, scope, 'SourcesResolved', {
    command: context.run.command,
    ...sources
  }, 'sources');
  emitTaskEvent(context.eventCollector, taskId, 'TaskStarted', {
    command: context.run.command
  }, 'started');

  try {
    const result = await task(context);
    emitTaskEvent(context.eventCollector, taskId, 'TaskCompleted', {
      command: context.run.command
    }, 'completed');
    emitLifecycleEvent(context.eventCollector, scope, 'RunCompleted', {
      command: context.run.command,
      verdict: normalizeOptionalString(result?.verdict),
      dryRun: typeof result?.dryRun === 'boolean' ? result.dryRun : null
    }, 'completed');

    return {
      ...result,
      commandRun: buildCommandRunSummary(context)
    };
  } catch (error) {
    if (!isInjectedCrash(error)) {
      emitTaskEvent(context.eventCollector, taskId, 'TaskFailed', {
        command: context.run.command,
        errorCode: normalizeErrorCode(error),
        errorMessage: normalizeErrorMessage(error)
      }, 'failed');
      emitLifecycleEvent(context.eventCollector, scope, 'RunFailed', {
        command: context.run.command,
        code: normalizeErrorCode(error),
        message: normalizeErrorMessage(error)
      }, 'failed');
    }

    error.commandRun = buildCommandRunSummary(context, {
      failure: {
        code: normalizeErrorCode(error),
        message: normalizeErrorMessage(error)
      }
    });
    throw error;
  }
}

export function attachCommandRun(data, commandRun) {
  if (!data || typeof data !== 'object' || !commandRun) {
    return data;
  }
  data.commandRun = commandRun;
  data.metadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {};
  data.metadata.commandRunId = commandRun.run?.runId ?? null;
  data.metadata.commandTransmutation = commandRun.run?.transmutation ?? null;
  return data;
}

export function formatCommandRunMarkdown(commandRun) {
  if (!commandRun?.run?.runId) {
    return '';
  }

  const lines = [];
  lines.push('## 🧵 Command Run');
  lines.push('');
  lines.push(`- Run ID: ${commandRun.run.runId}`);
  lines.push(`- Transmutation: ${commandRun.run.transmutation || 'n/a'}`);
  lines.push(`- Command: ${commandRun.run.command || 'n/a'}`);
  lines.push(`- Status: ${commandRun.run.status}`);
  lines.push(`- Ledger: ${commandRun.ledgerDir}`);
  return lines.join('\n');
}

export function formatCommandRunFailureLabel(error) {
  const run = error?.commandRun?.run;
  if (!run?.runId) {
    return '';
  }
  return ` [${run.transmutation || 'n/a'}/${run.runId}]`;
}

async function createCommandRunContext({ repoRoot, command, env, clock }) {
  const normalizedCommand = normalizeCommand(command);
  const transmutation = COMMAND_TRANSMUTATIONS[normalizedCommand];
  const workspaceRoot = path.resolve(repoRoot || process.cwd());
  const ledgerDir = await resolveLedgerRootDir({ repoRoot: workspaceRoot, env });
  const eventStore = new GitWarpEventStore({ rootDir: ledgerDir });
  const run = {
    runId: createRunId(),
    transmutation,
    command: normalizedCommand
  };
  const eventCollector = createRuntimeEventCollector({
    clock: createCommandClock(clock),
    runId: run.runId,
    transmutation: run.transmutation,
    eventStore,
    crashAfterEvent: resolveCrashAfterEvent(env?.WESLEY_CRASH_AFTER_EVENT)
  });

  return {
    repoRoot: workspaceRoot,
    ledgerDir,
    eventStore,
    eventCollector,
    run
  };
}

function buildCommandRunSummary(context, seed = {}) {
  return {
    ledgerDir: context.ledgerDir,
    run: buildRuntimeRunReport(context.eventCollector.events, {
      runId: context.run.runId,
      transmutation: context.run.transmutation,
      streamId: context.eventCollector.streamId,
      command: context.run.command,
      ...seed
    })
  };
}

function createCommandRunScope(run) {
  return `${run.transmutation}:${run.command}`;
}

function emitLifecycleEvent(eventCollector, scope, type, payload, suffix) {
  return eventCollector.emit(type, payload, {
    idempotencyKey: `${scope}:${suffix}`
  });
}

function emitTaskEvent(eventCollector, taskId, type, payload, suffix) {
  return eventCollector.emit(type, payload, {
    idempotencyKey: `${taskId}:${suffix}`
  });
}

function createCommandClock(clock) {
  return {
    now() {
      const value = typeof clock?.now === 'function' ? clock.now() : new Date().toISOString();
      if (typeof value === 'string') return value;
      if (value && typeof value.toISOString === 'function') return value.toISOString();
      return new Date().toISOString();
    }
  };
}

function normalizeCommand(command) {
  const normalized = normalizeOptionalString(command);
  if (!normalized || !COMMAND_TRANSMUTATIONS[normalized]) {
    throw new TypeError(`Unsupported Holmes command run "${command}"`);
  }
  return normalized;
}

function normalizeErrorCode(error) {
  return normalizeOptionalString(error?.code) || 'COMMAND_FAILED';
}

function normalizeErrorMessage(error) {
  return normalizeOptionalString(error?.message) || String(error);
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveCrashAfterEvent(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isInjectedCrash(error) {
  return Boolean(error?.injectedCrash) && error?.code === 'PIPELINE_EXEC_FAILED';
}
