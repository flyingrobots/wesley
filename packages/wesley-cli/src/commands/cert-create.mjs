/**
 * Cert Create - Assemble SHIPME.md certificate from evidence/realm
 */
import { createHash } from 'node:crypto';
import {
  GENERATED_BUNDLE_PATH,
  GENERATED_SCORES_PATH,
  GENERATED_SHIPME_PATH,
  generatedArtifactPathCandidates,
  listEvidenceFiles,
  strongestEvidenceStrength,
  summarizeEvidenceQuality,
  totalEvidenceCitations
} from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { resolveRunMetadata } from '../utils/run-metadata.mjs';
import {
  applyResumeMetadata,
  assertResumeRequestedRunId,
  buildShortCircuitedResumeResult,
  resolveResumeState
} from '../utils/runtime-resume.mjs';
import { readRealmProjection } from '../utils/runtime-projections.mjs';
import {
  buildShipmeCounterfactualSummary,
  readCurrentCounterfactualSummary
} from '../utils/counterfactual.mjs';
import {
  attachRunFailure,
  buildCommandRunReport,
  createCommandEventCollector,
  createCommandEventScope,
  emitArtifactsMaterialized,
  emitCertificateIssued,
  emitRunCompleted,
  emitRunFailed,
  emitRunRequested,
  emitSourcesResolved,
  isInjectedCrash
} from '../utils/runtime-events.mjs';

export class CertCreateCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'cert-create', 'Create SHIPME.md certificate');
  }

  configureCommander(cmd) {
    return cmd
      .option('--env <name>', 'Target environment', 'production')
      .option('--out <file>', 'Output file', GENERATED_SHIPME_PATH)
      .option('--transmutation <name>', 'Transmutation to associate with this certificate')
      .option('--run-id <id>', 'Associate this certificate with a specific run ID')
      .option('--resume', 'Resume a previously started certificate run with the same transmutation and run ID')
      .option('--json', 'Emit JSON to stdout (no file)');
  }

  async executeCore({ options, logger }) {
    assertResumeRequestedRunId(options);
    const env = options.env || 'production';
    const now = new Date().toISOString();
    const sha = await gitSha(this.ctx) || 'uncommitted';

    const bundle = await readGeneratedJsonSafe(this.ctx, GENERATED_BUNDLE_PATH);
    const scores = await readGeneratedJsonSafe(this.ctx, GENERATED_SCORES_PATH);
    const realm = await readWithFallback(() => readRealmProjection(this.ctx.fs));
    const counterfactual = buildShipmeCounterfactualSummary(
      await readCurrentCounterfactualSummary(this.ctx.fs)
    );
    const evidence = await buildShipmeEvidenceSummary(this.ctx, bundle);
    const run = resolveRunMetadata(options, realm || {});
    const resumeState = options.resume
      ? resolveResumeState(this.ctx?.eventStore, { ...run, command: 'cert-create' })
      : null;
    if (resumeState?.shortCircuited) {
      return buildShortCircuitedResumeResult(resumeState);
    }
    const eventCollector = createCommandEventCollector(this.ctx, run);
    const scope = createCommandEventScope(run, 'cert-create');
    emitRunRequested(eventCollector, scope, {
      command: 'cert-create',
      environment: env,
      out: options.out,
      json: Boolean(options.json)
    });

    try {
      const artifacts = await hashArtifacts(this.ctx, this.ctx?.config?.paths?.output || 'out');
      emitSourcesResolved(eventCollector, scope, {
        hasRealm: Boolean(realm),
        hasScores: Boolean(scores?.scores),
        hasEvidence: Boolean(evidence),
        artifactCount: Object.keys(artifacts).length
      });

      const cert = applyResumeMetadata({
        version: '1.0.0',
        transmutation: run.transmutation,
        runId: run.runId,
        sha,
        environment: env,
        timestamp: now,
        scores: scores?.scores || null,
        evidence,
        realm: realm || null,
        counterfactual,
        artifacts,
        signatures: []
      }, resumeState);
      emitCertificateIssued(eventCollector, scope, {
        environment: env,
        artifactCount: Object.keys(artifacts).length,
        hasRealm: Boolean(realm),
        hasScores: Boolean(scores?.scores),
        exactCitations: evidence?.exact || 0,
        wholeFileCitations: evidence?.wholeFile || 0,
        coarseCitations: evidence?.coarse || 0
      });

      if (options.json) {
        emitRunCompleted(eventCollector, scope, {
          command: 'cert-create',
          json: true
        });
        this.ctx.stdout.write(JSON.stringify({
          ...cert,
          events: eventCollector.events,
          run: buildCommandRunReport(eventCollector, run)
        }, null, 2) + '\n');
        return;
      }

      const content = renderSHIPME(cert);
      await this.ctx.fs.write(options.out, content);
      emitArtifactsMaterialized(eventCollector, scope, {
        artifactCount: 1,
        path: options.out
      });
      emitRunCompleted(eventCollector, scope, {
        command: 'cert-create',
        json: false,
        file: options.out
      });
      if (!options.quiet) logger.info(`✍️  Wrote ${options.out}`);
      return {
        ok: true,
        file: options.out,
        transmutation: run.transmutation,
        runId: run.runId,
        resumed: Boolean(resumeState),
        shortCircuited: false,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      };
    } catch (error) {
      if (isInjectedCrash(error)) {
        throw attachRunFailure(error, eventCollector, run);
      }
      emitRunFailed(eventCollector, scope, {
        command: 'cert-create',
        code: error.code || 'CERT_CREATE_FAILED',
        message: error.message
      });
      throw attachRunFailure(error, eventCollector, run);
    }
  }
}

function renderSHIPME(cert) {
  const human = [
    '# SHIPME Certificate',
    '',
    `- Transmutation: ${cert.transmutation}`,
    `- Run ID: ${cert.runId}`,
    `- Commit: ${cert.sha}`,
    `- Environment: ${cert.environment}`,
    `- Timestamp: ${cert.timestamp}`,
    cert.realm ? `- REALM: ${cert.realm.verdict} (${cert.realm.duration_ms}ms)` : '- REALM: n/a',
    cert.scores ? `- Scores: SCS=${fmt(cert.scores.scs)} MRI=${fmt(cert.scores.mri)} TCI=${fmt(cert.scores.tci)}` : '- Scores: n/a',
    cert.evidence
      ? `- Evidence: ${cert.evidence.totalCitations} citations (${cert.evidence.exact} exact · ${cert.evidence.wholeFile} whole-file · ${cert.evidence.coarse} coarse; strongest ${cert.evidence.strongestCitation})`
      : '- Evidence: n/a',
    cert.counterfactual ? `- Counterfactual: ${cert.counterfactual.gate} (${cert.counterfactual.riskClass})` : '- Counterfactual: n/a',
    '',
    '<!-- WESLEY_CERT:BEGIN -->',
    '```json',
    JSON.stringify(cert, null, 2),
    '```',
    '<!-- WESLEY_CERT:END -->',
    ''
  ].join('\n');
  return human;
}

function fmt(v){ if (v==null) return 'n/a'; return typeof v==='number' ? Number(v).toFixed(2) : String(v); }

async function gitSha(ctx) {
  try {
    const out = await ctx.shell.exec('git rev-parse HEAD');
    const s = out?.stdout?.trim();
    return s || ctx.env?.GITHUB_SHA || null;
  } catch {
    return ctx.env?.GITHUB_SHA || null;
  }
}

async function readGeneratedJsonSafe(ctx, currentPath) {
  for (const candidate of generatedArtifactPathCandidates(currentPath)) {
    try {
      const content = await ctx.fs.read(candidate);
      return JSON.parse(content);
    } catch {
      continue;
    }
  }
  return null;
}

async function readWithFallback(fn) {
  try { return await fn(); } catch { return null; }
}

async function hashArtifacts(ctx, outDir) {
  const fs = ctx.fs;
  const res = {};
  for (const f of ['schema.sql']) {
    try {
      const p = `${outDir}/${f}`;
      const buf = await fs.read(p);
      const h = createHash('sha256').update(buf).digest('hex');
      res[f] = { sha256: h };
    } catch (e) {
      ctx.logger?.debug?.('hashArtifacts: could not hash %s: %s', f, e?.message || e);
    }
  }
  return res;
}

async function buildShipmeEvidenceSummary(ctx, bundle) {
  if (!bundle?.evidence) return null;

  const files = listEvidenceFiles(bundle.evidence);
  const contentByFile = new Map();
  for (const file of files) {
    try {
      contentByFile.set(file, await ctx.fs.read(file));
    } catch {
      continue;
    }
  }

  const citationQuality = summarizeEvidenceQuality(
    bundle.evidence,
    file => contentByFile.get(file) ?? null
  );
  const total = totalEvidenceCitations(citationQuality);
  if (total === 0) return null;

  return {
    totalCitations: total,
    exact: citationQuality.exact,
    wholeFile: citationQuality.wholeFile,
    coarse: citationQuality.coarse,
    strongestCitation: strongestEvidenceStrength(citationQuality)
  };
}
