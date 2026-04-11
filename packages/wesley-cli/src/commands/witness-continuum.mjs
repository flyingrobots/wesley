import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import {
  configureContinuumWitnessCommander,
  executeContinuumWitnessCommand,
  resolveContinuumWitnessOptions
} from './witness.mjs';

export class WitnessContinuumCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness-continuum',
      'Verify current Continuum minimum-surface coherence and receipt-family witness scopes (compatibility alias for "wesley witness")'
    );
  }

  configureCommander(cmd) {
    return configureContinuumWitnessCommander(cmd);
  }

  async executeCore({ options, logger }) {
    const resolved = resolveContinuumWitnessOptions(options);
    return executeContinuumWitnessCommand({
      ctx: this.ctx,
      options,
      logger,
      resolved,
      successLabel: 'Continuum witness'
    });
  }
}

export {
  CURRENT_MINIMUM_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
