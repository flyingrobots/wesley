/**
 * BLADE - One-shot pipeline wrapper
 * Boring, Lock‑Aware, Audited Deployments, Effortless.
 * Runs: transform → plan --explain → rehearse → cert-create → [sign] → [verify]
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { TransformPipelineCommand } from './transform.mjs';
import { PlanCommand } from './plan.mjs';
import { RehearseCommand } from './rehearse.mjs';
import { CertCreateCommand } from './cert-create.mjs';
import { CertSignCommand } from './cert-sign.mjs';
import { CertVerifyCommand } from './cert-verify.mjs';
import { CertBadgeCommand } from './cert-badge.mjs';
import { LEGACY_SUPABASE_TRANSMUTATION } from '../transmutations/legacy-supabase.mjs';
import { resolveRunMetadata } from '../utils/run-metadata.mjs';

export class BladeCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'blade', 'One-shot: transform → plan → rehearse → cert (BLADE)');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--out-dir <dir>', 'Output directory', 'out')
      .option('--dsn <url>', 'Database DSN for rehearsal')
      .option('--docker', 'Attempt to start docker compose service postgres')
      .option('--dry-run', 'Rehearse dry run (no DB)')
      .option('--radar', 'Show lock radar summary during plan')
      .option('--env <name>', 'Target environment', 'production')
      .option('--transmutation <name>', 'Transmutation to execute', LEGACY_SUPABASE_TRANSMUTATION)
      .option('--run-id <id>', 'Associate the full BLADE run with a specific run ID')
      .option('--sign-key <path>', 'Private key (PEM) for signing')
      .option('--pub <path>', 'Public key (PEM) for verification')
      .option('--signer <name>', 'Signer label', 'HOLMES')
      .option('--json', 'Emit JSON summary');
  }

  async executeCore(context) {
    const { options } = context;
    const logger = this.makeLogger(options, { phase: 'blade' });
    const outDir = options.outDir || 'out';
    const run = resolveRunMetadata(options);

    // 1) Transform
    logger.info('🗡️  BLADE: transform');
    const transform = new TransformPipelineCommand(this.ctx);
    await transform.execute({
      schema: options.schema,
      outDir,
      transmutation: run.transmutation,
      runId: run.runId,
      json: false
    });

    // 2) Plan (explain)
    logger.info('🛡️  BLADE: plan (explain)');
    const plan = new PlanCommand(this.ctx);
    await plan.execute({
      schema: options.schema,
      outDir,
      explain: true,
      radar: !!options.radar,
      transmutation: run.transmutation,
      runId: run.runId,
      json: false
    });

    // 3) Rehearse (shadow)
    logger.info('🕶️  BLADE: rehearse (shadow)');
    const rehearse = new RehearseCommand(this.ctx);
    await rehearse.execute({
      schema: options.schema,
      dsn: options.dsn,
      docker: !!options.docker,
      dryRun: !!options.dryRun,
      transmutation: run.transmutation,
      runId: run.runId,
      json: false
    });

    // 4) Cert create
    logger.info('📜 BLADE: certify');
    const certCreate = new CertCreateCommand(this.ctx);
    await certCreate.execute({
      env: options.env || 'production',
      out: '.wesley/SHIPME.md',
      transmutation: run.transmutation,
      runId: run.runId,
      json: false
    });

    // 5) Optional sign & verify
    if (options.signKey) {
      logger.info(`🔏 BLADE: sign (${options.signer || 'HOLMES'})`);
      const certSign = new CertSignCommand(this.ctx);
      await certSign.execute({ in: '.wesley/SHIPME.md', key: options.signKey, signer: options.signer || 'HOLMES' });
      if (options.pub) {
        logger.info('✅ BLADE: verify');
        const certVerify = new CertVerifyCommand(this.ctx);
        await certVerify.execute({ in: '.wesley/SHIPME.md', pub: [options.pub], json: false });
      }
    }

    // Badge output
    const badgeCmd = new CertBadgeCommand(this.ctx);
    const badge = await badgeCmd.execute({ in: '.wesley/SHIPME.md' });
    logger.info('🏁 BLADE badge: ' + (badge?.badge || 'n/a'));

    return { ok: true, transmutation: run.transmutation, runId: run.runId };
  }
}
