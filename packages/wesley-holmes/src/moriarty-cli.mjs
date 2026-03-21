#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

import { Moriarty } from './Moriarty.mjs';
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
  const defaultHistory = path.join(bundleDir ?? '.wesley', 'history.json');
  const resolved = resolvePath(historyPath, path.resolve(defaultHistory));
  try {
    return JSON.parse(readFileSync(resolved, 'utf8'));
  } catch {
    return { points: [] };
  }
}

function loadMoriartyContext(bundleDir) {
  try {
    const contextPath = resolvePath(null, path.join(bundleDir ?? '.wesley', 'moriarty-context.json'));
    return JSON.parse(readFileSync(contextPath, 'utf8'));
  } catch {
    return {};
  }
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
    .option('--bundle-dir <path>', 'Path to Wesley bundle directory', '.wesley')
    .option('--history-file <path>', 'Path to MORIARTY history file')
    .option('--json <file>', 'Write prediction JSON to file')
    .option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
    .option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
    .option('--counterfactual [baseRef]', 'Analyze a git-warp counterfactual lane against a base ref')
    .option('--explain', 'Show resolved refs, digests, and counterfactual details')
    .option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
    .action(async options => {
      const bundleDir = resolvePath(options.bundleDir, '.wesley');
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
      if (options.json) {
        writeFileSync(options.json, JSON.stringify(data, null, 2));
      }
      console.log(moriarty.renderPrediction(data));
    });

  await program.parseAsync(process.argv);
}

function collectRepeatableOption(value, previous = []) {
  previous.push(value);
  return previous;
}

main().catch(error => {
  console.error('Prediction failed:', error.message);
  process.exit(1);
});
