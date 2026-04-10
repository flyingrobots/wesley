import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import {
  CURRENT_MINIMUM_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';

export class WitnessContinuumCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness-continuum',
      'Verify current Continuum minimum-surface coherence and receipt-family witness scopes'
    );
  }

  configureCommander(cmd) {
    return cmd
      .option('--scope <scope>', 'Witness scope', CURRENT_MINIMUM_SCOPE)
      .option('--ttd-schema <path>', 'TTD schema path')
      .option('--ttd-dir <dir>', 'TTD output directory')
      .option('--echo-schema <path>', 'Echo schema path')
      .option('--echo-dir <dir>', 'Echo output directory')
      .option('--receipt-family-fixture-dir <dir>', 'Receipt-family fixture directory')
      .option('-o, --out <path>', 'Conformance witness output path')
      .option('--dry-run', 'Compute the witness without writing the conformance file');
  }

  async executeCore({ options, logger }) {
    const resolved = resolveContinuumWitnessOptions(options);
    const report = await buildContinuumWitnessReport({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      ...resolved
    });

    if (!options.dryRun) {
      await this.ctx.fs.write(resolved.outputPath, JSON.stringify(report, null, 2) + '\n');
    }

    if (report.status === 'fail') {
      const guidance = options.dryRun
        ? ' No report file was written because --dry-run was set.'
        : ` See ${resolved.outputPath}.`;
      throw new WesleyError(
        'CONTINUUM_WITNESS_FAILED',
        `Continuum witness failed ${report.summary.failed} check(s).${guidance}`
      );
    }

    if (!options.quiet && !options.json) {
      logger?.info?.(`Continuum witness passed (${report.summary.passed}/${report.summary.totalChecks} checks)`);
      if (options.dryRun) {
        logger?.info?.('Witness report not written because --dry-run was set.');
      } else {
        logger?.info?.(`Witness report: ${resolved.outputPath}`);
      }
    }

    return report;
  }
}

export {
  CURRENT_MINIMUM_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
