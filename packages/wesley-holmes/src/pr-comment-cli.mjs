#!/usr/bin/env node

import {
  buildHolmesSuiteComment,
  loadHolmesSuiteReports
} from './pr-comment.mjs';

const options = parseArgs(process.argv.slice(2));
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

function parseArgs(argv) {
  const options = {
    holmesStatus: 'unknown',
    watsonStatus: 'unknown',
    moriartyStatus: 'unknown'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      fail(`Unexpected argument: ${token}`);
    }

    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`Missing value for --${name}`);
    }

    switch (name) {
    case 'reports-dir':
      options.reportsDir = value;
      break;
    case 'pr-number':
      options.prNumber = value;
      break;
    case 'holmes-status':
      options.holmesStatus = value;
      break;
    case 'watson-status':
      options.watsonStatus = value;
      break;
    case 'moriarty-status':
      options.moriartyStatus = value;
      break;
    default:
      fail(`Unknown option: --${name}`);
    }

    index += 1;
    // Advance past the consumed value token.
  }

  if (!options.reportsDir) {
    fail('Missing required option: --reports-dir <path>');
  }
  if (!options.prNumber) {
    fail('Missing required option: --pr-number <number>');
  }

  return options;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
