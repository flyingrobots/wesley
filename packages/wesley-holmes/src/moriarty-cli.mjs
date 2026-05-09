#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import {
  attachCommandRun,
  formatCommandRunFailureLabel,
  formatCommandRunMarkdown,
  withCommandRun
} from './command-run.mjs';
import { buildMoriartyPrediction, resolveMoriartyExecutionPaths } from './moriarty-predict-workflow.mjs';

async function main() {
  const program = new Command();
  program
    .name('moriarty')
    .description('Professor Moriarty - Wesley deployment predictions')
    .showHelpAfterError()
    .option('--bundle-dir <path>', 'Path to Wesley bundle directory')
    .option('--history-file <path>', 'Path to MORIARTY history file')
    .option('--json <file>', 'Write prediction JSON to file')
    .option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
    .option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
    .option('--counterfactual [baseRef]', 'Analyze a module-provided counterfactual lane against a base ref')
    .option('--explain', 'Show resolved refs, digests, and counterfactual details')
    .option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
    .action(async options => {
      const paths = resolveMoriartyExecutionPaths({
        bundleDir: options.bundleDir,
        historyFile: options.historyFile
      });
      const bundleDir = paths.bundleDir;
      const execution = await withCommandRun({
        repoRoot: paths.repoRoot,
        command: 'predict',
        sources: {
          bundleDir,
          historyFile: paths.historyFile,
          requestedRunId: options.runId || null,
          requestedTransmutation: options.transmutation || null,
          counterfactual: typeof options.counterfactual !== 'undefined',
          braidCount: Array.isArray(options.counterfactualBraid) ? options.counterfactualBraid.length : 0
        },
        task: async () => buildMoriartyPrediction({
          bundleDir: paths.bundleDir,
          historyFile: paths.historyFile,
          runId: options.runId,
          transmutation: options.transmutation,
          counterfactual: options.counterfactual,
          braidRefs: options.counterfactualBraid,
          explain: Boolean(options.explain),
          env: process.env
        })
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
