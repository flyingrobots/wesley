import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { GENERATED_SHIPME_PATH } from '@wesley/core';
import { buildCertBadge, extractJsonBlock } from './_cert-utils.mjs';

export class CertBadgeCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-badge', 'Print SHIPME.md badge line');
  }
  configureCommander(cmd){
    return cmd
      .option('--in <file>', 'Certificate file', GENERATED_SHIPME_PATH)
      .option('--json', 'Emit JSON badge');
  }
  async executeCore({ options }){
    const md = await this.ctx.fs.read(options.in);
    const { json } = extractJsonBlock(md);
    const badge = buildCertBadge(json);
    if (!options.quiet && !options.json) {
      this.ctx.stdout.write(badge + '\n');
    }
    return { badge };
  }
}
