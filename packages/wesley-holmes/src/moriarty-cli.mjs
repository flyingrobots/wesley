#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  GENERATED_ARTIFACT_DIR,
  generatedArtifactPathCandidates
} from '@wesley/core';

import { Moriarty } from './Moriarty.mjs';
import {
  attachCommandRun,
  formatCommandRunFailureLabel,
  formatCommandRunMarkdown,
  withCommandRun
} from './command-run.mjs';
import { attachRuntimeRun, loadRuntimeRunRecord } from './runtime-run.mjs';
import {
  analyzeCounterfactual,
  loadHolmesCounterfactualPolicy,
  resolveCounterfactualLaneRequest
} from './index.mjs';
import { moriartyReportSchema, validateReport } from './report-schemas.mjs';

function resolvePath(target, fallback) {
  const chosen = target || fallback;
  return path.isAbsolute(chosen) ? chosen : path.resolve(chosen);
}

function loadHistory(historyPath, bundleDir) {
  const defaultHistory = path.join(bundleDir ?? GENERATED_ARTIFACT_DIR, 'history.json');
  const resolved = resolvePath(historyPath, path.resolve(defaultHistory));
  for (const candidate of generatedArtifactPathCandidates(resolved)) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return { points: [] };
}

function loadMoriartyContext(bundleDir) {
  const contextPath = resolvePath(null, path.join(bundleDir ?? GENERATED_ARTIFACT_DIR, 'moriarty-context.json'));
  for (const candidate of generatedArtifactPathCandidates(contextPath)) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return {};
}

function ensureValidReport(label, schema, data) {
  const { valid, errors } = validateReport(schema, data);
  if (!valid) {
    const detail = errors.map(err => ` - ${err}`).join('\n');
    throw new Error(`[${label}] report validation failed:\n${detail}`);
  }
}

async function attachCounterfactual(data, {
  bundleDir,
  outDir,
  schemaPath,
  transmutation,
  baseRef,
  braidRefs = [],
  explain = false
}) {
  const repoRoot = path.resolve(bundleDir, '..');
  const policy = await loadHolmesCounterfactualPolicy({ repoRoot, env: process.env });
  const lane = resolveCounterfactualLaneRequest({
    policy,
    baseRef,
    braidRefs
  });
  const counterfactual = await analyzeCounterfactual({
    repoRoot,
    lane,
    includeTransferPlan: true,
    policy,
    surface: {
      bundleDir,
      outDir,
      schemaPath,
      transmutation
    }
  });
  data.counterfactual = explain ? counterfactual : { ...counterfactual };
  data.warnings = Array.isArray(data.warnings) ? data.warnings : [];
  if (typeof data.confidence === 'number' && Number.isFinite(counterfactual?.judgment?.confidenceAdjustment)) {
    data.confidence = Math.max(0, Math.min(100, data.confidence + counterfactual.judgment.confidenceAdjustment));
  }
  if (counterfactual?.judgment?.status && counterfactual.judgment.status !== 'clean') {
    data.patterns = Array.isArray(data.patterns) ? data.patterns : [];
    data.patterns.push({
      type: 'COUNTERFACTUAL_ISSUE',
      description: counterfactual.judgment.reasons.join(' ')
    });
  }
}

async function attachRuntime(data, { bundleDir, runId, transmutation }) {
  if (typeof runId !== 'string' || !runId.trim()) {
    return null;
  }

  const runtimeRecord = await loadRuntimeRunRecord({
    repoRoot: path.resolve(bundleDir, '..'),
    runId,
    transmutation
  });
  attachRuntimeRun(data, runtimeRecord);
  return runtimeRecord;
}

async function main() {
  const program = new Command();
  program
    .name('moriarty')
    .description('Professor Moriarty - Wesley deployment predictions')
    .showHelpAfterError()
    .option('--bundle-dir <path>', 'Path to Wesley bundle directory', GENERATED_ARTIFACT_DIR)
    .option('--history-file <path>', 'Path to MORIARTY history file')
    .option('--json <file>', 'Write prediction JSON to file')
    .option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
    .option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
    .option('--counterfactual [baseRef]', 'Analyze a git-warp counterfactual lane against a base ref')
    .option('--explain', 'Show resolved refs, digests, and counterfactual details')
    .option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
    .action(async options => {
      const bundleDir = resolvePath(options.bundleDir, GENERATED_ARTIFACT_DIR);
      const execution = await withCommandRun({
        repoRoot: path.resolve(bundleDir, '..'),
        command: 'predict',
        sources: {
          bundleDir,
          historyFile: resolvePath(options.historyFile, path.join(bundleDir, 'history.json')),
          requestedRunId: options.runId || null,
          requestedTransmutation: options.transmutation || null,
          counterfactual: typeof options.counterfactual !== 'undefined',
          braidCount: Array.isArray(options.counterfactualBraid) ? options.counterfactualBraid.length : 0
        },
        task: async () => {
          const history = loadHistory(options.historyFile, bundleDir);
          const ctx = loadMoriartyContext(bundleDir);
          const moriarty = new Moriarty(history, ctx);
          const data = moriarty.predictionData();
          const runtime = await attachRuntime(data, {
            bundleDir,
            runId: options.runId,
            transmutation: options.transmutation
          });
          if (typeof options.counterfactual !== 'undefined') {
            const baseRef = typeof options.counterfactual === 'string' && options.counterfactual.length > 0
              ? options.counterfactual
              : (process.env.MORIARTY_BASE_REF || process.env.GITHUB_BASE_REF || 'main');
            await attachCounterfactual(data, {
              bundleDir,
              outDir: path.resolve(path.dirname(bundleDir), 'out'),
              schemaPath: path.resolve(path.dirname(bundleDir), 'schema.graphql'),
              transmutation: runtime?.run?.transmutation || options.transmutation,
              baseRef,
              braidRefs: options.counterfactualBraid,
              explain: Boolean(options.explain)
            });
          }
          ensureValidReport('MORIARTY', moriartyReportSchema, data);
          return {
            data,
            output: moriarty.renderPrediction(data)
          };
        }
      });
      attachCommandRun(execution.data, execution.commandRun);
      if (options.json) {
        writeFileSync(options.json, JSON.stringify(execution.data, null, 2));
      }
      console.log(execution.output);
      console.log('');
      console.log(formatCommandRunMarkdown(execution.commandRun));
    });

  await program.parseAsync(process.argv);
}

function collectRepeatableOption(value, previous = []) {
  previous.push(value);
  return previous;
}

main().catch(error => {
  console.error(`Prediction failed${formatCommandRunFailureLabel(error)}:`, error.message);
  process.exit(1);
});
