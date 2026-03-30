#!/usr/bin/env node

import { Command } from 'commander';
import {
  buildHolmesSuiteComment,
  loadHolmesSuiteReports
} from './pr-comment.mjs';

const program = new Command();

program
  .requiredOption('--reports-dir <path>', 'Directory containing Holmes suite report artifacts')
  .requiredOption('--pr-number <number>', 'Pull request number')
  .option('--holmes-status <status>', 'Workflow status for Holmes', 'unknown')
  .option('--watson-status <status>', 'Workflow status for Watson', 'unknown')
  .option('--moriarty-status <status>', 'Workflow status for Moriarty', 'unknown')
  .showHelpAfterError();

program.parse(process.argv);

const options = program.opts();
const reports = loadHolmesSuiteReports(options.reportsDir, {
  holmes: options.holmesStatus,
  watson: options.watsonStatus,
  moriarty: options.moriartyStatus
});

const body = buildHolmesSuiteComment({
  pullRequestNumber: options.prNumber,
  ...reports
});

process.stdout.write(`${body}\n`);
