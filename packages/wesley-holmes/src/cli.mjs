#!/usr/bin/env node
/**
 * SHA-lock HOLMES CLI - Sidecar intelligence for Wesley
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { Holmes } from './Holmes.mjs';
import { Watson } from './Watson.mjs';
import { Moriarty } from './Moriarty.mjs';
import { readWeightConfig } from './weight-config.mjs';
import {
  holmesReportSchema,
  watsonReportSchema,
  moriartyReportSchema,
  validateReport
} from './report-schemas.mjs';

function parseArgs(raw) {
  const args = [...raw];
  const options = {};
  const positionals = [];
  while (args.length) {
    const token = args.shift();
    if (token === '--json') {
      options.json = args.shift();
      continue;
    }
    if (token === '--file' || token === '-f') {
      options.file = args.shift();
      continue;
    }
    positionals.push(token);
  }
  return { command: positionals.shift(), options, rest: positionals };
}

function loadBundle() {
  try {
    return JSON.parse(readFileSync('.wesley/bundle.json', 'utf8'));
  } catch (error) {
    console.error('❌ No Wesley bundle found. Run "wesley generate --emit-bundle" first.');
    process.exit(1);
  }
}

function loadHistory() {
  try {
    return JSON.parse(readFileSync('.wesley/history.json', 'utf8'));
  } catch {
    return { points: [] };
  }
}

function validateOrExit(label, schema, data) {
  const { valid, errors } = validateReport(schema, data);
  if (!valid) {
    const detail = errors.map(err => ` - ${err}`).join('\n');
    console.error(`[${label}] Report validation failed:\n${detail}`);
    process.exit(1);
  }
}

async function main() {
  const { command, options, rest } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'investigate': {
      const bundle = loadBundle();
      const holmes = new Holmes(bundle);
      const data = holmes.investigationData();
      validateOrExit('HOLMES', holmesReportSchema, data);
      if (options.json) {
        writeFileSync(options.json, JSON.stringify(data, null, 2));
      }
      console.log(holmes.renderInvestigation(data));
      break;
    }

    case 'verify': {
      const bundle = loadBundle();
      const watson = new Watson(bundle);
      const data = watson.verificationData();
      validateOrExit('WATSON', watsonReportSchema, data);
      if (options.json) {
        writeFileSync(options.json, JSON.stringify(data, null, 2));
      }
      console.log(watson.renderVerification(data));
      break;
    }

    case 'predict': {
      const history = loadHistory();
      const moriarty = new Moriarty(history);
      const data = moriarty.predictionData();
      validateOrExit('MORIARTY', moriartyReportSchema, data);
      if (options.json) {
        writeFileSync(options.json, JSON.stringify(data, null, 2));
      }
      console.log(moriarty.renderPrediction(data));
      break;
    }

    case 'weights:validate':
    case 'weights-validate':
    case 'weights': {
      const target = options.file || rest[0] || '.wesley/weights.json';
      try {
        const { config } = readWeightConfig(target, { required: true });
        // eslint-disable-next-line no-console
        console.log('✅ weights configuration valid');
        if (options.json) {
          writeFileSync(options.json, JSON.stringify(config, null, 2));
        }
      } catch (error) {
        console.error('❌ Weight configuration invalid:', error?.message);
        process.exit(1);
      }
      break;
    }

    case 'report': {
      // Combined report
      const bundle = loadBundle();
      const history = loadHistory();
      const holmes = new Holmes(bundle);
      const watson = new Watson(bundle);
      const moriarty = new Moriarty(history);
      const holmesData = holmes.investigationData();
      const watsonData = watson.verificationData();
      const moriartyData = moriarty.predictionData();

      validateOrExit('HOLMES', holmesReportSchema, holmesData);
      validateOrExit('WATSON', watsonReportSchema, watsonData);
      validateOrExit('MORIARTY', moriartyReportSchema, moriartyData);

      if (options.json) {
        writeFileSync(options.json, JSON.stringify({
          holmes: holmesData,
          watson: watsonData,
          moriarty: moriartyData
        }, null, 2));
      }

      console.log('# 🔍 The Case of Schema Investigation\n');
      console.log(holmes.renderInvestigation(holmesData));
      console.log('\n---\n');
      console.log(watson.renderVerification(watsonData));
      console.log('\n---\n');
      console.log(moriarty.renderPrediction(moriartyData));
      
      break;
    }
    
    default:
      console.log(`
SHA-lock HOLMES - Wesley Schema Intelligence

Usage:
  holmes investigate    Run HOLMES investigation on .wesley/bundle
  holmes verify        Run WATSON verification
  holmes predict       Run MORIARTY predictions
  holmes report        Generate complete report (all three)
  holmes weights:validate [--file path]  Validate .wesley/weights.json structure

Requires:
  .wesley/bundle.json   Generated by: wesley generate --emit-bundle
  .wesley/history.json  Built over time by multiple generations

"When you have eliminated the impossible, whatever remains,
 however improbable, must be the deployable."
      `);
  }
}

main().catch(error => {
  console.error('💥 Investigation failed:', error.message);
  process.exit(1);
});
