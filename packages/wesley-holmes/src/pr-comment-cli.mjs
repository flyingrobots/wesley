#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  buildHolmesMultiSchemaComment,
  buildHolmesSuiteComment,
  loadHolmesSuiteReportSets,
  loadHolmesSuiteReports
} from './pr-comment.mjs';

if (isDirectExecution()) {
  main();
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const statuses = {
    holmes: options.holmesStatus,
    watson: options.watsonStatus,
    moriarty: options.moriartyStatus
  };
  const reportSets = loadHolmesSuiteReportSets(options.reportsDir, statuses, {
    schemaSetIds: options.schemaSetIds
  });
  const reports = loadHolmesSuiteReports(options.reportsDir, statuses);

  const body =
    reportSets.length > 1 || reportSets[0]?.id !== 'default'
      ? buildHolmesMultiSchemaComment({
          pullRequestNumber: options.prNumber,
          headSha: options.headSha,
          statuses,
          schemaReports: reportSets
        })
      : buildHolmesSuiteComment({
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
    moriartyStatus: 'unknown',
    schemaSetIds: []
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
      case 'schema-sets-json':
        options.schemaSetIds = parseSchemaSetIds(value);
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

function parseSchemaSetIds(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    fail(
      `Invalid --schema-sets-json value: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!Array.isArray(parsed)) {
    fail('Invalid --schema-sets-json value: expected a JSON array');
  }

  const ids = [];
  const seen = new Set();
  for (const entry of parsed) {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (typeof id !== 'string' || !id.trim()) {
      fail('Invalid --schema-sets-json value: every entry must have a non-empty id');
    }
    const normalized = id.trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
