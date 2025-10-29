import { ExecutionPlan } from './ExecutionPlan.mjs';
import { CommandFactory } from './CommandFactory.mjs';

export class PlanBuilder {
  constructor(rootName, options) {
    this.rootName = rootName;
    this.options = options || {};
  }

  build() {
    // For now, one stage per command. Future: compose multiple commands.
    const cmd = CommandFactory.create(this.rootName, this.options);
    const plan = new ExecutionPlan([
      {
        name: `${cmd.name} stage`,
        steps: [
          {
            label: cmd.description || cmd.name,
            run: () => cmd.execute(this.options)
          }
        ]
      }
    ]);
    return plan;
  }
}

export default PlanBuilder;

