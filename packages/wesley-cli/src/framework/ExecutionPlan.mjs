export class ExecutionPlan {
  constructor(stages = []) {
    this.stages = stages; // [{name?, steps:[{label, run:()=>Promise<any>}]}]
  }

  visualize() {
    const lines = [];
    lines.push('🧭 Execution Plan:');
    this.stages.forEach((stage, idx) => {
      const title = stage.name ? `${idx + 1}. ${stage.name}` : `${idx + 1}. Stage`;
      lines.push(`  • ${title}`);
      stage.steps.forEach((s) => {
        lines.push(`     - ${s.label}`);
      });
    });
    return lines.join('\n');
  }

  async run() {
    for (const stage of this.stages) {
      await Promise.all(stage.steps.map((s) => s.run()));
    }
  }
}

export default ExecutionPlan;

