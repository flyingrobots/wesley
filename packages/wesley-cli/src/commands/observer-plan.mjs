import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import {
  generateObserverPlanTypeScript,
  normalizeObserverSpec
} from '../utils/observer-plan.mjs';

export class ObserverPlanCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'observer-plan', 'Compile an app-authored observer spec into an observer plan');
  }

  configureCommander(cmd) {
    return cmd
      .requiredOption('--spec <path>', 'Path to the app-authored observer spec module')
      .option('--export <name>', 'Named export to load from the observer spec module', 'default')
      .option('--out-file <file>', 'Output file (prints to stdout if not specified)')
      .option('-v, --verbose', 'Verbose output (level=info)')
      .option('-d, --debug', 'Debug output (level=debug)')
      .option('-q, --quiet', 'Silence logs (level=silent)')
      .option('--json', 'Emit JSON result metadata');
  }

  async executeCore(context) {
    const { options, logger } = context;
    const specPath = resolve(options.spec);
    const exportName = options.export ?? 'default';
    const mod = await import(pathToFileURL(specPath).href);
    const exported = exportName === 'default' ? mod.default : mod[exportName];

    if (exported == null) {
      throw new Error(`Observer spec export not found: ${exportName}`);
    }

    const authoredSpec = typeof exported === 'function'
      ? await exported()
      : exported;
    const plan = normalizeObserverSpec(authoredSpec, {
      specPath: options.spec,
      exportName
    });
    const code = generateObserverPlanTypeScript(plan);
    const written = await this.writeOutput({
      code,
      outFile: options.outFile,
      options
    });

    if (!options.quiet && !options.json) {
      logger.info(`Generated observer plan: ${written}`);
    }

    return {
      outFile: written,
      observerName: plan.observerName,
      planId: plan.planId,
      specHash: plan.specHash
    };
  }
}
