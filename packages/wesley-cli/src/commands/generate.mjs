/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, OpsError, createRunId } from '@wesley/core';
import {
  ensureGeneratePreconditions,
  runSequentialGeneration,
  runTasksAndSlapsGeneration
} from './generate-execution.mjs';
import { compileOpsIfRequested } from './generate-ops.mjs';
import { LEGACY_SUPABASE_TRANSMUTATION } from '../transmutations/legacy-supabase.mjs';
import { resolveTransmutationName } from '../transmutations/registry.mjs';
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
    super(ctx, 'generate', 'Generate SQL, tests, and more from GraphQL schema');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--ops <dir>', 'Experimental: directory containing *.op.json files to compile (omit to disable)')
      .option('--ops-manifest <path>', 'Path to ops manifest JSON file (auto-detected if omitted)')
      .option('--ops-schema <name>', 'Schema name for emitted ops SQL (default wes_ops)', 'wes_ops')
      .option('--ops-security <mode>', 'Security for emitted functions: invoker|definer', 'invoker')
      .option('--ops-search-path <list>', 'Comma-separated search_path for ops functions (e.g., "pg_catalog, wes_ops")')
      .option('--ops-target <platform>', 'Target platform for ops: postgres|supabase (affects auth variable compilation)', 'postgres')
      .option('--ops-explain <mode>', 'Emit EXPLAIN JSON snapshots for ops: mock', '')
      .option('--ops-allow-errors', 'Continue compiling remaining ops even if some fail validation (not allowed in CI without override)')
      .option('--emit-bundle', 'Emit .wesley/ evidence bundle')
      .option('--supabase', 'Enable Supabase features (RLS tests)')
      .option('--out-dir <dir>', 'Output directory', 'out')
      .option('--dry-run', 'Show what would be generated without writing files')
      .option('--allow-dirty', 'Allow running with a dirty git working tree (not recommended)')
      .option('--i-know-what-im-doing', 'Acknowledge hazardous flags in CI environments')
      .option('--transmutation <name>', 'Transmutation to execute', LEGACY_SUPABASE_TRANSMUTATION)
      .option('--run-id <id>', 'Associate this execution with a specific run ID')
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
    const outDir = options.outDir || this.ctx?.config?.paths?.output || 'out';
    options.outDir = outDir;
    const requestedTransmutation = String(options.transmutation || LEGACY_SUPABASE_TRANSMUTATION).trim() || LEGACY_SUPABASE_TRANSMUTATION;
    const requestedRunId = typeof options.runId === 'string' && options.runId.trim()
      ? options.runId.trim()
      : createRunId();

    const isCI = String(this.ctx?.env?.CI || '').toLowerCase() === 'true' || this.ctx?.env?.CI === '1';
    const canAllowErrors = !isCI || options.iKnowWhatImDoing;
    if (options.opsAllowErrors && !canAllowErrors) {
      throw new OpsError('OPS_ALLOW_ERRORS_FORBIDDEN', '--ops-allow-errors is disabled when CI=true; remove the flag or rerun with --i-know-what-im-doing.');
    }
    if (options.opsAllowErrors && isCI && options.iKnowWhatImDoing) {
      logger.warn({ opsAllowErrors: true }, '--ops-allow-errors acknowledged in CI due to override flag');
    }
    options.opsAllowErrors = Boolean(options.opsAllowErrors);

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
      const scope = createCommandEventScope(run, this.name);
      const eventCollector = createCommandEventCollector(this.ctx, run);
      emitRunRequested(eventCollector, scope, {
        command: this.name,
        schemaPath,
        outDir,
        dryRun: Boolean(options.dryRun)
      });
      emitSourcesResolved(eventCollector, scope, {
        schemaPath
      });
      emitRunFailed(eventCollector, scope, {
        command: this.name,
        code: error.code || 'UNKNOWN_TRANSMUTATION',
        message: error.message
      });
      throw attachRunFailure(error, eventCollector, run);
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

    const { generators, planner, runner } = this.ctx;
    if (!generators || !generators.sql) {
      throw new WesleyError('GENERATION_FAILED', 'SQL generator not available');
    }

    const needsSequentialPipeline = options.unit || options.dryRun || options.printIr || options.printComposedSdl;
    const useExperimentalTasksRunner = String(this.ctx?.env?.WESLEY_EXPERIMENTAL_TASKS || '') === '1';
    if (planner && runner && planner.buildPlan && runner.run && useExperimentalTasksRunner && !needsSequentialPipeline) {
      return this.executeWithTasksAndSlaps(context);
    }

    return runSequentialGeneration({
      ctx: this.ctx,
      context,
      compileOpsIfRequested
    });
  }

  async executeWithTasksAndSlaps(context) {
    return runTasksAndSlapsGeneration({
      ctx: this.ctx,
      context,
      compileOpsIfRequested
    });
  }

  async compileOpsIfRequested(context) {
    return compileOpsIfRequested({ ctx: this.ctx, context });
  }
}
