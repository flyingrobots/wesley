/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { createRunId } from '@wesley/core';
import {
  ensureGeneratePreconditions,
  runSequentialGeneration,
  runTasksAndSlapsGeneration
} from './generate-execution.mjs';
import {
  assertTransmutationPrerequisites,
  formatTransmutationChoices,
  getDefaultTransmutationName,
  resolveTransmutationName
} from '../transmutations/registry.mjs';
import {
  assertResumeRequestedRunId,
  buildShortCircuitedResumeResult,
  resolveResumeState
} from '../utils/runtime-resume.mjs';
import {
  attachRunFailure,
  createCommandEventCollector,
  createCommandEventScope,
  emitRunFailed,
  emitRunRequested,
  emitSourcesResolved
} from '../utils/runtime-events.mjs';

export class GeneratePipelineCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'generate', 'Generate artifacts from GraphQL schema through registered transmutations');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--emit-bundle', 'Emit .wesley-cache/ evidence bundle')
      .option('--out-dir <dir>', 'Output directory', 'out')
      .option('--dry-run', 'Show what would be generated without writing files')
      .option('--allow-dirty', 'Allow running with a dirty git working tree (not recommended)')
      .option('--i-know-what-im-doing', 'Acknowledge hazardous flags in CI environments')
      .option('--transmutation <name>', `Transmutation to execute (${formatTransmutationChoices()})`, getDefaultTransmutationName())
      .option('--run-id <id>', 'Associate this execution with a specific run ID')
      .option('--resume', 'Resume a previously started run with the same transmutation and run ID')
      .option('--debug', 'Debug output with stack traces')
      .option('-q, --quiet', 'Silence logs (level=silent)')
      .option('--json', 'Emit newline-delimited JSON logs')
      .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
      .option('--show-plan', 'Display execution plan before running')
      .option('--unit <units...>', 'Compilation unit IDs to generate for (repeatable or comma-separated)')
      .option('--schema-root <dir>', 'Root directory for resolving @wes_import paths')
      .option('--print-composed-sdl', 'Print the composed/mangled SDL to stdout (debug)')
      .option('--print-ir', 'Print the parsed IR as JSON to stdout (debug)');
  }

  async executeCore(context) {
    const { schemaPath, options, logger } = context;
    options.commandName = options.commandName || this.name;
    const commandName = options.commandName;
    const outDir = options.outDir || this.ctx?.config?.paths?.output || 'out';
    options.outDir = outDir;
    const requestedTransmutation = String(options.transmutation || getDefaultTransmutationName()).trim() || getDefaultTransmutationName();
    const requestedRunId = typeof options.runId === 'string' && options.runId.trim()
      ? options.runId.trim()
      : createRunId();
    assertResumeRequestedRunId(options);

    if (options.stdin) {
      options.schema = '-';
    }
    try {
      options.transmutation = resolveTransmutationName(requestedTransmutation);
      options.runId = requestedRunId;
    } catch (error) {
      const run = {
        transmutation: requestedTransmutation,
        runId: requestedRunId
      };
      const scope = createCommandEventScope(run, commandName);
      const eventCollector = createCommandEventCollector(this.ctx, run);
      emitRunRequested(eventCollector, scope, {
        command: commandName,
        schemaPath,
        outDir,
        dryRun: Boolean(options.dryRun)
      });
      emitSourcesResolved(eventCollector, scope, {
        schemaPath
      });
      emitRunFailed(eventCollector, scope, {
        command: commandName,
        code: error.code || 'UNKNOWN_TRANSMUTATION',
        message: error.message
      });
      throw attachRunFailure(error, eventCollector, run);
    }

    const registration = assertTransmutationPrerequisites(options.transmutation, this.ctx);

    const resumeState = options.resume
      ? resolveResumeState(this.ctx?.eventStore, {
        runId: options.runId,
        transmutation: options.transmutation,
        command: commandName
      })
      : null;
    if (resumeState?.shortCircuited) {
      return buildShortCircuitedResumeResult(resumeState);
    }
    if (resumeState) {
      context.resumeState = resumeState;
    }

    await ensureGeneratePreconditions({
      env: this.ctx.env || {},
      options,
      shell: this.ctx.shell
    });

    const debugDump = options.printComposedSdl || options.printIr;
    if (!debugDump) {
      logger.info({ schema: schemaPath }, 'Parsing schema...');
    }

    const { planner, runner } = this.ctx;

    const needsSequentialPipeline =
      options.unit ||
      options.dryRun ||
      options.printIr ||
      options.printComposedSdl ||
      registration.supportsTasksRunner !== true;
    const useExperimentalTasksRunner = String(this.ctx?.env?.WESLEY_EXPERIMENTAL_TASKS || '') === '1';
    if (planner && runner && planner.buildPlan && runner.run && useExperimentalTasksRunner && !needsSequentialPipeline && !options.resume) {
      return this.executeWithTasksAndSlaps(context);
    }

    return runSequentialGeneration({
      ctx: this.ctx,
      context
    });
  }

  async executeWithTasksAndSlaps(context) {
    return runTasksAndSlapsGeneration({
      ctx: this.ctx,
      context
    });
  }
}
