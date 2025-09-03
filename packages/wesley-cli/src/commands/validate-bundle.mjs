#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class ValidateBundleCommand extends WesleyCommand {
  constructor() {
    super('validate-bundle', 'Validate Wesley bundle against JSON schemas');
  }

  async executeCore({ options }) {
    const bundlePath = options.bundle || '.wesley';
    const schemasPath = options.schemas || path.join(process.cwd(), 'schemas');
    
    try {
      // Dynamic import of Ajv
      const { default: Ajv } = await import('ajv');
      const { default: addFormats } = await import('ajv-formats');
      
      const ajv = new Ajv({ strict: false, allErrors: true });
      addFormats(ajv);
      
      // Load schemas
      const evidenceMapSchema = JSON.parse(
        await fs.readFile(path.join(schemasPath, 'evidence-map.schema.json'), 'utf8')
      );
      const scoresSchema = JSON.parse(
        await fs.readFile(path.join(schemasPath, 'scores.schema.json'), 'utf8')
      );
      
      // Load bundle files
      const evidenceMap = JSON.parse(
        await fs.readFile(path.join(bundlePath, 'evidence-map.json'), 'utf8')
      );
      const scores = JSON.parse(
        await fs.readFile(path.join(bundlePath, 'scores.json'), 'utf8')
      );
      
      // Check version
      if (!evidenceMap.version) {
        console.error('❌ Evidence map missing version field');
        process.exit(1);
      }
      
      // Validate evidence map
      const validateEvidenceMap = ajv.compile(evidenceMapSchema);
      const evidenceMapValid = validateEvidenceMap(evidenceMap);
      
      if (!evidenceMapValid) {
        console.error('❌ Evidence map validation failed:');
        console.error(JSON.stringify(validateEvidenceMap.errors, null, 2));
        process.exit(1);
      }
      
      // Validate scores
      const validateScores = ajv.compile(scoresSchema);
      const scoresValid = validateScores(scores);
      
      if (!scoresValid) {
        console.error('❌ Scores validation failed:');
        console.error(JSON.stringify(validateScores.errors, null, 2));
        process.exit(1);
      }
      
      console.log('✅ Bundle validation passed!');
      console.log(`  - Evidence map: ${bundlePath}/evidence-map.json`);
      console.log(`  - Scores: ${bundlePath}/scores.json`);
      
      // Check thresholds if config available
      if (options.config) {
        const config = await import(path.resolve(options.config));
        const thresholds = config.default?.thresholds || {};
        
        if (scores.scores.scs < thresholds.scs) {
          console.error(`❌ SCS below threshold: ${scores.scores.scs} < ${thresholds.scs}`);
          process.exit(1);
        }
        
        if (scores.scores.tci < thresholds.tci) {
          console.error(`❌ TCI below threshold: ${scores.scores.tci} < ${thresholds.tci}`);
          process.exit(1);
        }
        
        if (scores.scores.mri > thresholds.mri) {
          console.error(`❌ MRI above threshold: ${scores.scores.mri} > ${thresholds.mri}`);
          process.exit(1);
        }
        
        console.log('✅ All thresholds passed!');
      }
      
    } catch (error) {
      error.code = error.code || 'VALIDATION_FAILED';
      throw error;
    }
  }
}

export default ValidateBundleCommand;
