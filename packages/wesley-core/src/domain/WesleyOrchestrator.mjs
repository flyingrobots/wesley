/**
 * Wesley Orchestrator - Core domain logic for generation pipeline
 * Pure business logic, no file system dependencies
 */

import { EvidenceMap } from '../application/EvidenceMap.mjs';
import { Scoring } from '../application/Scoring.mjs';
import { PostgreSQLGenerator } from './generators/PostgreSQLGenerator.mjs';
import { PgTAPTestGenerator } from './generators/PgTAPTestGenerator.mjs';
import { RPCFunctionGeneratorV2 } from './generators/RPCFunctionGeneratorV2.mjs';
import { MigrationDiffer } from './generators/MigrationDiffer.mjs';
import { ZodGenerator } from './generators/ZodGenerator.mjs';

export class WesleyOrchestrator {
  constructor(options = {}) {
    this.generateSQL = options.generateSQL ?? true;  // Alpha Blocker #3: Separate SQL generation flag
    this.enableRLS = options.enableRLS ?? true;      // Only controls RLS policy emission
    this.enableRPC = options.enableRPC ?? true;
    this.enableTests = options.enableTests ?? true;
    this.enableMigrations = options.enableMigrations ?? true;
  }
  
  /**
   * Orchestrate the complete generation pipeline
   * Returns all artifacts as pure data (no file I/O)
   */
  async orchestrate(schema, previousSchema = null, options = {}) {
    const sha = options.sha || 'uncommitted';
    const timestamp = new Date().toISOString();
    
    // Create evidence map
    const evidenceMap = new EvidenceMap(sha);
    
    // Initialize generators with evidence map
    const sqlGenerator = new PostgreSQLGenerator(evidenceMap);
    const testGenerator = new PgTAPTestGenerator(evidenceMap);
    const rpcGenerator = new RPCFunctionGeneratorV2(evidenceMap, {
      paramStrategy: options.rpcParamStrategy || 'jsonb'
    });
    const zodGenerator = new ZodGenerator(evidenceMap);
    const migrationEngine = new MigrationDiffer({
      allowDestructive: options.allowDestructive || false,
      generateSnapshots: options.generateSnapshots ?? true,
      riskThreshold: options.riskThreshold || 50
    });
    
    // Generate artifacts
    const artifacts = {};
    
    // 1. Generate SQL DDL
    if (this.generateSQL) {
      artifacts.sql = await sqlGenerator.generate(schema, { 
        enableRLS: this.enableRLS  // Pass RLS flag to generator
      });
    }
    
    // 2. Generate pgTAP tests
    if (this.enableTests) {
      artifacts.tests = await testGenerator.generate(schema, {
        supabase: options.supabase,
        migrationSteps: previousSchema ? 
          migrationEngine.diff(previousSchema, schema).steps : null
      });
    }
    
    // 3. Generate Zod schemas
    artifacts.zod = await zodGenerator.generate(schema);
    
    // 4. Generate RPC functions from mutations
    if (this.enableRPC && schema.getMutations) {
      artifacts.rpcFunctions = await rpcGenerator.generate(schema);
    }
    
    // 5. Generate migrations if previous schema exists
    if (this.enableMigrations && previousSchema) {
      const diff = await migrationEngine.diff(previousSchema, schema);
      
      // Check for blocked operations
      if (diff.safetyAnalysis?.blockedOperations?.length > 0) {
        throw new Error(
          `Migration blocked: ${diff.safetyAnalysis.blockedOperations[0].reason}\n` +
          `Use --allow-destructive flag to proceed with destructive operations.`
        );
      }
      
      if (diff.steps.length > 0) {
        artifacts.migration = {
          steps: diff.steps,
          sql: migrationEngine.toSQL(diff),
          mri: diff.holmesScore?.mri || this.calculateMRI(diff.steps),
          safetyAnalysis: diff.safetyAnalysis,
          preFlightSnapshot: diff.preFlightSnapshot,
          holmesScore: diff.holmesScore
        };
      }
    }
    
    // 5. Calculate scores
    const scoring = new Scoring();
    const scores = {
      scs: scoring.calculateSCS(schema, evidenceMap),
      mri: artifacts.migration ? artifacts.migration.mri : 0,
      tci: scoring.calculateTCI(schema, evidenceMap)
    };
    
    // 6. Determine readiness
    const readiness = this.determineReadiness(scores);
    
    // Return complete bundle
    return {
      timestamp,
      sha,
      schema: {
        ast: schema.toAST(),
        tables: schema.getTables().length,
        fields: schema.getTables().reduce((sum, t) => sum + t.getFields().length, 0)
      },
      artifacts,
      evidenceMap: evidenceMap.toJSON(),
      scores: {
        scores,
        readiness,
        history: [] // Would be populated from previous runs
      }
    };
  }
  
  /**
   * Calculate Migration Risk Index
   */
  calculateMRI(steps) {
    let riskPoints = 0;
    
    for (const step of steps) {
      switch (step.kind) {
        case 'drop_table':
          riskPoints += 40; // Very high risk
          break;
        case 'drop_column':
          riskPoints += 25; // High risk
          break;
        case 'alter_type':
          riskPoints += step.unsafe ? 30 : 10;
          break;
        case 'add_column':
          riskPoints += step.field?.nonNull && !step.field?.default ? 15 : 5;
          break;
        case 'create_table':
          riskPoints += 5; // Low risk
          break;
        case 'create_index':
          riskPoints += 10; // Can be blocking
          break;
        default:
          riskPoints += 5;
      }
    }
    
    // Normalize to 0-1
    return Math.min(riskPoints / 100, 1);
  }
  
  /**
   * Determine production readiness
   */
  determineReadiness(scores) {
    const thresholds = {
      scs: { required: 0.8, actual: scores.scs },
      mri: { required: 0.4, actual: scores.mri },
      tci: { required: 0.7, actual: scores.tci }
    };
    
    const allPass = Object.values(thresholds).every(t => t.actual >= t.required);
    
    let verdict = 'NOT READY';
    if (allPass) {
      verdict = 'READY FOR PRODUCTION';
    } else if (scores.scs >= 0.7 && scores.mri <= 0.5) {
      verdict = 'READY FOR REVIEW';
    } else if (scores.scs >= 0.5) {
      verdict = 'IN PROGRESS';
    }
    
    return {
      verdict,
      confidence: this.calculateConfidence(scores),
      thresholds,
      recommendations: this.getRecommendations(scores)
    };
  }
  
  calculateConfidence(scores) {
    // Weighted confidence based on all scores
    return (scores.scs * 0.4 + (1 - scores.mri) * 0.3 + scores.tci * 0.3);
  }
  
  getRecommendations(scores) {
    const recommendations = [];
    
    if (scores.scs < 0.8) {
      recommendations.push('Increase schema coverage by adding missing artifacts');
    }
    if (scores.mri > 0.4) {
      recommendations.push('High migration risk - consider breaking into smaller changes');
    }
    if (scores.tci < 0.7) {
      recommendations.push('Add more tests for critical fields');
    }
    
    return recommendations;
  }
}