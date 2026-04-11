import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import { joinPath } from './path-utils.mjs';
import {
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';

const VALID_TARGETS = ['warp-ttd', 'echo'];
const LEGACY_TARGET_ALIASES = new Map([['ttd', 'warp-ttd']]);

export class WitnessCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness',
      'Verify generated contract legs against one shared Continuum witness scope'
    );
  }

  configureCommander(cmd) {
    return configureContinuumWitnessCommander(cmd)
      .option('--schema <path>', 'Shared authored GraphQL schema path for all selected targets')
      .option('-o, --out-dir <dir>', 'Root output directory')
      .option('-t, --target <targets>', 'Comma-separated targets: warp-ttd, echo', 'warp-ttd,echo')
      .option('--report-out <path>', 'Conformance witness output path (defaults under <out-dir>/witness/conformance.json)');
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
    .option('--scope <scope>', 'Witness scope', CURRENT_MINIMUM_SCOPE)
    .option('--ttd-schema <path>', 'TTD schema path')
    .option('--ttd-dir <dir>', 'TTD output directory')
    .option('--echo-schema <path>', 'Echo schema path')
    .option('--echo-dir <dir>', 'Echo output directory')
    .option('--receipt-family-fixture-dir <dir>', 'Receipt-family fixture directory')
    .option('--out <path>', 'Deprecated alias for the conformance witness output path')
    .option('--dry-run', 'Compute the witness without writing the conformance file');
}

export function resolveGenericContinuumWitnessOptions(options) {
  const scope = options.scope ?? CURRENT_MINIMUM_SCOPE;
  const outDir = options.outDir ?? defaultOutDirForScope(scope);
  const targets = parseTargets(options.target ?? 'warp-ttd,echo');
  const sharedSchemaPath = normalizeOptionalPath(options.schema);

  ensureRequiredTargets(targets, scope);

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
    realizationRoot: joinPath(outDir, 'realization'),
    targets
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

function parseTargets(rawTargets) {
  const targets = String(rawTargets)
    .split(',')
    .map((target) => LEGACY_TARGET_ALIASES.get(target.trim().toLowerCase()) ?? target.trim().toLowerCase())
    .filter(Boolean);

  if (targets.length === 0) {
    throw new WesleyError(
      'CONTINUUM_WITNESS_INVALID_TARGET',
      `At least one target is required. Valid targets: ${VALID_TARGETS.join(', ')}`
    );
  }

  for (const target of targets) {
    if (!VALID_TARGETS.includes(target)) {
      throw new WesleyError(
        'CONTINUUM_WITNESS_INVALID_TARGET',
        `Invalid target: "${target}". Valid targets: ${VALID_TARGETS.join(', ')}`
      );
    }
  }

  return [...new Set(targets)];
}

function ensureRequiredTargets(targets, scope) {
  const missingTargets = VALID_TARGETS.filter((target) => !targets.includes(target));
  if (missingTargets.length === 0) {
    return;
  }

  throw new WesleyError(
    'CONTINUUM_WITNESS_TARGETS_INCOMPLETE',
    `Witness scope "${scope}" currently requires both generated legs: ${VALID_TARGETS.join(', ')}.`,
    {
      requestedTargets: targets,
      requiredTargets: VALID_TARGETS,
      missingTargets
    }
  );
}

export {
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
