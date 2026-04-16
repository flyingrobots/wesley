/**
 * BLADE - One-shot pipeline wrapper
 * Boring, Lock‑Aware, Audited Deployments, Effortless.
 * Runs: transform → plan --explain → rehearse → cert-create → [sign] → [verify]
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { GENERATED_SHIPME_PATH } from '@wesley/core';
import { TransformPipelineCommand } from './transform.mjs';
import { PlanCommand } from './plan.mjs';
import { RehearseCommand } from './rehearse.mjs';
import { CertCreateCommand } from './cert-create.mjs';
import { CertSignCommand } from './cert-sign.mjs';
import { CertVerifyCommand } from './cert-verify.mjs';
import { CertBadgeCommand } from './cert-badge.mjs';
import { formatTransmutationChoices, getDefaultTransmutationName } from '../transmutations/registry.mjs';
import { resolveRunMetadata } from '../utils/run-metadata.mjs';
import { assertResumeRequestedRunId } from '../utils/runtime-resume.mjs';
import {
  assertCounterfactualGate,
  maybeAnalyzeCounterfactual
} from '../utils/counterfactual.mjs';

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
      .option('--transmutation <name>', `Transmutation to execute (${formatTransmutationChoices()})`, getDefaultTransmutationName())
      .option('--run-id <id>', 'Associate the full BLADE run with a specific run ID')
      .option('--resume', 'Resume a previously started BLADE run with the same transmutation and run ID')
      .option('--counterfactual [baseRef]', 'Analyze a git-warp counterfactual lane against a base ref')
      .option('--counterfactual-braid <ref>', 'Add a braid support ref for the counterfactual lane', collectValues, [])
      .option('--sign-key <path>', 'Private key (PEM) for signing')
      .option('--pub <path>', 'Public key (PEM) for verification')
      .option('--signer <name>', 'Signer label', 'HOLMES')
      .option('--json', 'Emit JSON summary');
  }

  async executeCore(context) {
    const { options } = context;
    const nestedQuiet = Boolean(options.quiet || options.json);
    const logger = this.makeLogger({ ...options, quiet: nestedQuiet }, { phase: 'blade' });
    const outDir = options.outDir || 'out';
    assertResumeRequestedRunId(options);
    const run = resolveRunMetadata(options);

    // 1) Transform
    logger.info('🗡️  BLADE: transform');
    const transform = new TransformPipelineCommand(this.ctx);
    const transformResult = await executeNestedCommand(transform, {
      schema: options.schema,
      outDir,
      transmutation: run.transmutation,
      runId: run.runId,
      emitBundle: typeof options.counterfactual !== 'undefined',
      resume: Boolean(options.resume),
      quiet: nestedQuiet,
      json: false
    });

    // 2) Plan (explain)
    logger.info('🛡️  BLADE: plan (explain)');
    const plan = new PlanCommand(this.ctx);
    const planResult = await executeNestedCommand(plan, {
      schema: options.schema,
      outDir,
      explain: true,
      radar: !!options.radar,
      transmutation: run.transmutation,
      runId: run.runId,
      resume: Boolean(options.resume),
      quiet: nestedQuiet,
      json: false
    });

    // 3) Rehearse (shadow)
    logger.info('🕶️  BLADE: rehearse (shadow)');
    const rehearse = new RehearseCommand(this.ctx);
    const rehearseResult = await executeNestedCommand(rehearse, {
      schema: options.schema,
      dsn: options.dsn,
      docker: !!options.docker,
      dryRun: !!options.dryRun,
      transmutation: run.transmutation,
      runId: run.runId,
      resume: Boolean(options.resume),
      quiet: nestedQuiet,
      json: false
    });

    let counterfactualResult = null;
    if (typeof options.counterfactual !== 'undefined' || Array.isArray(options.counterfactualBraid) && options.counterfactualBraid.length > 0) {
      logger.info('🪞 BLADE: counterfactual');
      counterfactualResult = await maybeAnalyzeCounterfactual({
        options,
        schemaPath: options.schema,
        outDir,
        transmutation: run.transmutation
      });
      assertCounterfactualGate(counterfactualResult);
    }

    // 4) Cert create
    logger.info('📜 BLADE: certify');
    const certCreate = new CertCreateCommand(this.ctx);
    const certCreateResult = await executeNestedCommand(certCreate, {
      env: options.env || 'production',
      out: GENERATED_SHIPME_PATH,
      transmutation: run.transmutation,
      runId: run.runId,
      resume: Boolean(options.resume),
      quiet: nestedQuiet,
      json: false
    });

    // 5) Optional sign & verify
    if (options.signKey) {
      logger.info(`🔏 BLADE: sign (${options.signer || 'HOLMES'})`);
      const certSign = new CertSignCommand(this.ctx);
      await certSign.execute({ in: GENERATED_SHIPME_PATH, key: options.signKey, signer: options.signer || 'HOLMES' });
      if (options.pub) {
        logger.info('✅ BLADE: verify');
        const certVerify = new CertVerifyCommand(this.ctx);
        await certVerify.execute({ in: GENERATED_SHIPME_PATH, pub: [options.pub], json: false });
      }
    }

    // Badge output
    const badgeCmd = new CertBadgeCommand(this.ctx);
    const badge = await executeNestedCommand(badgeCmd, { in: GENERATED_SHIPME_PATH, quiet: true });
    logger.info('🏁 BLADE badge: ' + (badge?.badge || 'n/a'));

    return {
      ok: true,
      transmutation: run.transmutation,
      runId: run.runId,
      resumed: Boolean(options.resume),
      badge: badge?.badge || null,
      stages: {
        transform: summarizeStageResult(transformResult),
        plan: summarizeStageResult(planResult),
        rehearse: summarizeStageResult(rehearseResult),
        counterfactual: summarizeCounterfactual(counterfactualResult),
        certCreate: summarizeStageResult(certCreateResult)
      }
    };
  }
}

function summarizeStageResult(result) {
  return {
    ok: result?.ok !== false,
    resumed: Boolean(result?.resumed),
    shortCircuited: Boolean(result?.shortCircuited),
    runId: result?.runId || null,
    transmutation: result?.transmutation || null,
    command: result?.run?.command || null,
    status: result?.run?.status || null
  };
}

function summarizeCounterfactual(result) {
  if (!result) return null;
  return {
    laneFingerprint: result.laneFingerprint,
    composition: result.composition,
    gate: result?.judgment?.gate || 'pass',
    wouldFail: Boolean(result?.judgment?.wouldFail),
    riskClass: result?.judgment?.riskClass || 'none',
    status: result?.judgment?.status || 'clean'
  };
}

function collectValues(value, previous) {
  previous.push(value);
  return previous;
}

async function executeNestedCommand(command, options) {
  try {
    return await command.execute(options);
  } catch (error) {
    if (error?.name === 'ExitError' && error.cause) {
      throw error.cause;
    }
    throw error;
  }
}
