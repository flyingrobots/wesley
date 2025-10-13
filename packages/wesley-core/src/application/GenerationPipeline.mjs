/**
 * Generation Pipeline - Core orchestration logic
 * Platform-agnostic, pure business logic
 */

import { EvidenceMap } from './EvidenceMap.mjs';
import { ScoringEngine } from './Scoring.mjs';
import { DirectiveProcessor } from '../domain/Directives.mjs';

const BUNDLE_VERSION = '2.0.0';

export class GenerationPipeline {
  constructor(ports) {
    this.parser = ports.parser;
    this.sqlGenerator = ports.sqlGenerator;
    this.typeGenerator = ports.typeGenerator;
    this.testGenerator = ports.testGenerator;
    this.diffEngine = ports.diffEngine;
    this.fileSystem = ports.fileSystem;
    this.logger = ports.logger;
  }

  /**
   * Main generation pipeline - pure orchestration
   */
  async execute(schemaContent, options = {}) {
    const evidenceMap = new EvidenceMap();
    evidenceMap.setSha(options.sha || 'uncommitted');
    
    // 1. Parse schema
    this.logger?.info('Parsing schema...');
    const schema = await this.parser.parse(schemaContent);
    
    // 2. Load previous schema for diffing
    const previousSchema = await this.loadPreviousSchema();
    
    // 3. Calculate diff
    const diff = await this.diffEngine.diff(previousSchema, schema);
    
    // 4. Generate artifacts
    const artifacts = await this.generateArtifacts(schema, {
      evidenceMap,
      diff,
      ...options
    });
    
    // 5. Calculate scores
    const scoringEngine = new ScoringEngine(evidenceMap);
    const scores = scoringEngine.exportScores(
      schema,
      diff.steps || [],
      options.testResults || {}
    );
    
    // 6. Create bundle
    const bundle = this.createBundle({
      schema,
      evidenceMap,
      scores,
      artifacts,
      sha: options.sha,
      timestamp: new Date().toISOString()
    });
    
    return bundle;
  }

  /**
   * Generate all artifacts
   */
  async generateArtifacts(schema, options) {
    const artifacts = {};
    
    // SQL
    if (this.sqlGenerator) {
      this.logger?.info('Generating SQL...');
      artifacts.sql = await this.sqlGenerator.generate(schema, options.evidenceMap);
    }
    
    // TypeScript
    if (this.typeGenerator) {
      this.logger?.info('Generating TypeScript...');
      artifacts.typescript = await this.typeGenerator.generate(schema, options.evidenceMap);
    }
    
    // Tests
    if (this.testGenerator) {
      this.logger?.info('Generating tests...');
      artifacts.tests = await this.testGenerator.generate(schema, {
        evidenceMap: options.evidenceMap,
        migrationSteps: options.diff?.steps,
        supabase: options.supabase
      });
    }
    
    // Migration
    if (options.diff?.steps?.length > 0) {
      this.logger?.info('Generating migration...');
      artifacts.migration = await this.diffEngine.generateMigration(options.diff);
    }
    
    return artifacts;
  }

  /**
   * Create the evidence bundle
   */
  createBundle(data) {
    const { schema, evidenceMap, scores, artifacts, sha, timestamp } = data;
    
    return {
      sha,
      timestamp,
      bundleVersion: BUNDLE_VERSION,
      schema: schema.toJSON(),
      evidence: evidenceMap.toJSON(),
      scores,
      artifacts: {
        sql: artifacts.sql ? true : false,
        typescript: artifacts.typescript ? true : false,
        tests: artifacts.tests ? true : false,
        migration: artifacts.migration ? true : false
      },
      generated: artifacts
    };
  }

  /**
   * Load previous schema (delegates to port)
   */
  async loadPreviousSchema() {
    if (!this.fileSystem) {
      return { tables: {} };
    }
    
    try {
      const content = await this.fileSystem.read('.wesley/snapshot.json');
      return JSON.parse(content);
    } catch {
      return { tables: {} };
    }
  }
}
