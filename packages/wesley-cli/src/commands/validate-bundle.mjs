#!/usr/bin/env node

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class ValidateBundleCommand extends WesleyCommand {
  constructor() {
    super('validate-bundle', 'Validate Wesley bundle against JSON schemas');
  }

  configureCommander(cmd) {
    return cmd
      .option('--bundle <path>', 'Bundle path', '.wesley')
      .option('--schemas <path>', 'Schemas path', './schemas')
      .option('--show-plan', 'Display execution plan before running');
  }

  async executeCore({ options }) {
    const fs = this.ctx.fs;
    const cwd = await fs.resolve('.');
    const bundlePath = options.bundle || '.wesley';
    const schemasPath = options.schemas || await fs.join(cwd, 'schemas');
    
    try {
      // Dynamic import of Ajv
      const { default: Ajv } = await import('ajv');
      const { default: addFormats } = await import('ajv-formats');
      
      const ajv = new Ajv({ strict: false, allErrors: true });
      addFormats(ajv);
      
      // Load schemas
      const evidenceMapSchema = JSON.parse(
        await fs.readFile(await fs.join(schemasPath, 'evidence-map.schema.json'), 'utf8')
      );
      const scoresSchema = JSON.parse(
        await fs.readFile(await fs.join(schemasPath, 'scores.schema.json'), 'utf8')
      );
      
      // Load bundle files
      const evidenceMap = JSON.parse(
        await fs.readFile(await fs.join(bundlePath, 'evidence-map.json'), 'utf8')
      );
      const scores = JSON.parse(
        await fs.readFile(await fs.join(bundlePath, 'scores.json'), 'utf8')
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
        const config = await import(await fs.resolve(options.config));
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

// Auto-register this command by creating an instance
new ValidateBundleCommand();
