import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import {
  configureContinuumWitnessCommander,
  executeContinuumWitnessCommand,
  resolveGenericContinuumWitnessOptions
} from './witness.mjs';

export class WitnessContinuumCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness-continuum',
      'Compatibility alias for "wesley witness" across current-minimum, receipt-family, and settlement-family scopes'
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

export {
  CURRENT_MINIMUM_SCOPE,
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
