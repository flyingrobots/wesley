import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import { joinPath } from './path-utils.mjs';
import {
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';

export class WitnessCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness',
      'Verify generated contract legs against one shared Continuum witness scope'
    );
  }

  configureCommander(cmd) {
    return configureContinuumWitnessCommander(cmd);
  }

  async executeCore({ options, logger }) {
    const resolved = resolveGenericContinuumWitnessOptions(options);
    return executeContinuumWitnessCommand({
      ctx: this.ctx,
      options,
      logger,
      resolved,
      successLabel: 'Continuum witness'
    });
  }
}

export function configureContinuumWitnessCommander(cmd) {
  return cmd
    .option('--schema <path>', 'Shared authored GraphQL schema path for all selected targets')
    .option('-o, --out-dir <dir>', 'Root output directory')
    .option('--report-out <path>', 'Conformance witness output path (defaults under <out-dir>/witness/conformance.json)')
    .option('--scope <scope>', 'Witness scope', CURRENT_MINIMUM_SCOPE)
    .option('--ttd-schema <path>', 'TTD schema path')
    .option('--ttd-dir <dir>', 'TTD output directory')
    .option('--echo-schema <path>', 'Echo schema path')
    .option('--echo-dir <dir>', 'Echo output directory')
    .option('--receipt-family-fixture-dir <dir>', 'Receipt-family fixture directory')
    .option('--settlement-family-fixture-dir <dir>', 'Settlement-family fixture directory')
    .option('--out <path>', 'Deprecated alias for the conformance witness output path')
    .option('--dry-run', 'Compute the witness without writing the conformance file');
}

export function resolveGenericContinuumWitnessOptions(options) {
  const scope = options.scope ?? CURRENT_MINIMUM_SCOPE;
  const outDir = options.outDir ?? defaultOutDirForScope(scope);
  const sharedSchemaPath = normalizeOptionalPath(options.schema);

  return {
    ...resolveContinuumWitnessOptions({
      ...options,
      scope,
      ttdSchema: options.ttdSchema ?? sharedSchemaPath ?? undefined,
      ttdDir: options.ttdDir ?? joinPath(outDir, 'warp-ttd'),
      echoSchema: options.echoSchema ?? sharedSchemaPath ?? undefined,
      echoDir: options.echoDir ?? joinPath(outDir, 'echo'),
      out: options.reportOut ?? options.out ?? joinPath(outDir, 'witness', 'conformance.json')
    }),
    outDir,
    realizationRoot: joinPath(outDir, 'realization')
  };
}

export async function executeContinuumWitnessCommand({
  ctx,
  options,
  logger,
  resolved,
  successLabel
}) {
  const report = await buildContinuumWitnessReport({
    fs: ctx.fs,
    crypto: ctx.crypto,
    ...resolved
  });

  if (!options.dryRun) {
    await ctx.fs.write(resolved.outputPath, JSON.stringify(report, null, 2) + '\n');
  }

  if (report.status === 'fail') {
    const guidance = options.dryRun
      ? ' No report file was written because --dry-run was set.'
      : ` See ${resolved.outputPath}.`;
    throw new WesleyError(
      'CONTINUUM_WITNESS_FAILED',
      `${successLabel} failed ${report.summary.failed} check(s).${guidance}`
    );
  }

  if (!options.quiet && !options.json) {
    logger?.info?.(`${successLabel} passed (${report.summary.passed}/${report.summary.totalChecks} checks)`);
    if (options.dryRun) {
      logger?.info?.('Witness report not written because --dry-run was set.');
    } else {
      logger?.info?.(`Witness report: ${resolved.outputPath}`);
    }
  }

  return report;
}

function defaultOutDirForScope(scope) {
  if (scope === SETTLEMENT_FAMILY_SCOPE) {
    return '.wesley-cache/continuum/settlement-family';
  }
  return scope === RECEIPT_FAMILY_SCOPE
    ? '.wesley-cache/continuum/receipt-family'
    : '.wesley-cache/continuum/local-inspect';
}

function normalizeOptionalPath(value) {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length === 0 ? undefined : text;
}

export {
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
