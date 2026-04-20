import { WesleyModule } from '@wesley/core';

import { ContractCommand } from '../commands/contract.mjs';
import { DriftWatchCommand } from '../commands/drift-watch.mjs';
import { ObserverPlanCommand } from '../commands/observer-plan.mjs';
import { WitnessCommand } from '../commands/witness.mjs';
import { WitnessContinuumCommand } from '../commands/witness-continuum.mjs';

export class ContinuumCliModule extends WesleyModule {
  get apiVersion() {
    return '1';
  }

  get name() {
    return 'continuum';
  }

  async registerCliCommands(ctx) {
    new ContractCommand(ctx);
    new DriftWatchCommand(ctx);
    new ObserverPlanCommand(ctx);
    new WitnessCommand(ctx);
    new WitnessContinuumCommand(ctx);
  }
}

export const wesleyModule = new ContinuumCliModule();

export default wesleyModule;
