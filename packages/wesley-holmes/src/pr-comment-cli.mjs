#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  buildHolmesSuiteComment,
  loadHolmesSuiteReports
} from './pr-comment.mjs';

if (isDirectExecution()) {
  main();
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const reports = loadHolmesSuiteReports(options.reportsDir, {
    holmes: options.holmesStatus,
    watson: options.watsonStatus,
    moriarty: options.moriartyStatus
  });

  const body = buildHolmesSuiteComment({
    pullRequestNumber: options.prNumber,
    headSha: options.headSha,
    ...reports
  });

  process.stdout.write(`${body}\n`);
}

function isDirectExecution() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function parseArgs(argv) {
  const options = {
    headSha: '',
    holmesStatus: 'unknown',
    watsonStatus: 'unknown',
    moriartyStatus: 'unknown'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      fail(`Unexpected argument: ${token}`);
    }

    const rawName = token.slice(2);
    const separatorIndex = rawName.indexOf('=');
    const consumesNextToken = separatorIndex === -1;
    const name = consumesNextToken ? rawName : rawName.slice(0, separatorIndex);
    const value = consumesNextToken ? argv[index + 1] : rawName.slice(separatorIndex + 1);

    if (!value || (consumesNextToken && value.startsWith('--'))) {
      fail(`Missing value for --${name}`);
    }

    switch (name) {
    case 'reports-dir':
      options.reportsDir = value;
      break;
    case 'pr-number':
      options.prNumber = value;
      break;
    case 'head-sha':
      options.headSha = value;
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

    if (consumesNextToken) {
      index += 1;
      // Advance past the consumed value token.
    }
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
