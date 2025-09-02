/**
 * Wesley Scoring System
 * SCS - Schema Coverage Score
 * MRI - Migration Risk Index  
 * TCI - Test Confidence Index
 */

import { DirectiveProcessor } from '../domain/Directives.mjs';

export class ScoringEngine {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }

  /**
   * Schema Coverage Score - Did artifacts exist for each IR node?
   * Formula: Σ(weight × present) / Σ(weight)
   */
  calculateSCS(schema, requiredArtifacts = ['sql', 'ts', 'zod']) {
    let totalWeight = 0;
    let earnedPoints = 0;

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        const uid = DirectiveProcessor.getUid(field.directives) || 
                   `${table.name}.${field.name}`;
        const weight = DirectiveProcessor.getWeight(field.directives);
        
        // Skip virtual fields
        if (field.isVirtual() || DirectiveProcessor.shouldSkip(field.directives)) {
          continue;
        }
        
        totalWeight += weight;
        
        if (this.evidenceMap.hasCompleteArtifacts(uid, requiredArtifacts)) {
          earnedPoints += weight;
        }
      }
    }

    return totalWeight > 0 ? earnedPoints / totalWeight : 0;
  }

  /**
   * Migration Risk Index - How spicy is this migration?
   * 0 = safe, 1 = maximum spice
   */
  calculateMRI(migrationSteps) {
    let riskPoints = 0;

    for (const step of migrationSteps) {
      switch (step.kind) {
        case 'drop_table':
          riskPoints += 40;
          break;
        case 'drop_column':
          riskPoints += 25;
          break;
        case 'alter_type':
          if (!this.isSafeCast(step.from, step.to)) {
            riskPoints += 30;
          }
          break;
        case 'add_column':
          if (step.field?.nonNull && !step.field?.directives?.['@default']) {
            riskPoints += 25; // NOT NULL without default
          }
          break;
        case 'rename_column':
        case 'rename_table':
          if (!step.uidContinuity) {
            riskPoints += 10; // Rename without @uid
          }
          break;
        case 'create_index':
          if (step.concurrent === false) {
            riskPoints += 10; // Non-concurrent index on large table
          }
          break;
      }
    }

    // Normalize to 0-1
    return Math.min(100, riskPoints) / 100;
  }

  /**
   * Test Confidence Index - How well tested is the schema?
   * Weighted average of different test types
   */
  calculateTCI(schema, testResults) {
    const weights = {
      structure: 0.20,    // Tables/columns exist
      constraints: 0.45,  // PK/FK/unique work
      migrations: 0.25,   // Migrations apply cleanly
      performance: 0.10   // Indexes used
    };

    let score = 0;

    // Structure tests
    const structureCoverage = this.calculateTestCoverage(
      schema, 
      testResults.structure || []
    );
    score += weights.structure * structureCoverage;

    // Constraint tests - extra weight for critical fields
    const constraintCoverage = this.calculateConstraintCoverage(
      schema,
      testResults.constraints || []
    );
    score += weights.constraints * constraintCoverage;

    // Migration tests
    const migrationCoverage = testResults.migrations?.passed / 
                             (testResults.migrations?.total || 1);
    score += weights.migrations * (migrationCoverage || 0);

    // Performance tests
    const performanceCoverage = this.calculateIndexCoverage(
      schema,
      testResults.performance || []
    );
    score += weights.performance * performanceCoverage;

    return score;
  }

  /**
   * Calculate overall system readiness
   */
  calculateReadiness(scs, mri, tci, thresholds = {}) {
    const defaults = {
      scs: 0.8,
      tci: 0.7,
      mri: 0.4  // Lower is better for risk
    };
    
    const t = { ...defaults, ...thresholds };
    
    const scsPass = scs >= t.scs;
    const tciPass = tci >= t.tci;
    const mriPass = mri <= t.mri;
    
    const allPass = scsPass && tciPass && mriPass;
    
    return {
      ready: allPass,
      scs: { score: scs, threshold: t.scs, pass: scsPass },
      tci: { score: tci, threshold: t.tci, pass: tciPass },
      mri: { score: mri, threshold: t.mri, pass: mriPass },
      verdict: this.getVerdict(allPass, scsPass, tciPass, mriPass)
    };
  }

  getVerdict(allPass, scsPass, tciPass, mriPass) {
    if (allPass) return 'ELEMENTARY';
    
    const failures = [];
    if (!scsPass) failures.push('incomplete artifacts');
    if (!tciPass) failures.push('insufficient tests');
    if (!mriPass) failures.push('high risk migrations');
    
    if (failures.length >= 2) return 'YOU SHALL NOT PASS';
    return 'REQUIRES INVESTIGATION';
  }

  // Helper methods
  isSafeCast(fromType, toType) {
    const safeCasts = {
      'Int': ['Float', 'String'],
      'Float': ['String'],
      'Boolean': ['String'],
      'ID': ['String']
    };
    
    return safeCasts[fromType]?.includes(toType) || false;
  }

  calculateTestCoverage(schema, testedElements) {
    const tested = new Set(testedElements);
    let total = 0;
    let covered = 0;

    for (const table of schema.getTables()) {
      total++;
      if (tested.has(table.name)) covered++;
      
      for (const field of table.getFields()) {
        if (!field.isVirtual()) {
          total++;
          if (tested.has(`${table.name}.${field.name}`)) {
            covered++;
          }
        }
      }
    }

    return total > 0 ? covered / total : 0;
  }

  calculateConstraintCoverage(schema, testedConstraints) {
    const tested = new Set(testedConstraints);
    let totalWeight = 0;
    let coveredWeight = 0;

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        const weight = DirectiveProcessor.getWeight(field.directives);
        
        // Check each constraint type
        if (field.isPrimaryKey()) {
          totalWeight += weight;
          if (tested.has(`${table.name}.${field.name}.pk`)) {
            coveredWeight += weight;
          }
        }
        
        if (field.isForeignKey()) {
          totalWeight += weight;
          if (tested.has(`${table.name}.${field.name}.fk`)) {
            coveredWeight += weight;
          }
        }
        
        if (field.isUnique()) {
          totalWeight += weight;
          if (tested.has(`${table.name}.${field.name}.unique`)) {
            coveredWeight += weight;
          }
        }
      }
    }

    return totalWeight > 0 ? coveredWeight / totalWeight : 0;
  }

  calculateIndexCoverage(schema, testedIndexes) {
    const tested = new Set(testedIndexes);
    let total = 0;
    let covered = 0;

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          total++;
          if (tested.has(`${table.name}_${field.name}_idx`)) {
            covered++;
          }
        }
      }
    }

    return total > 0 ? covered / total : 0;
  }

  /**
   * Export scores to JSON
   */
  exportScores(schema, migrationSteps = [], testResults = {}) {
    const scs = this.calculateSCS(schema);
    const mri = this.calculateMRI(migrationSteps);
    const tci = this.calculateTCI(schema, testResults);
    
    const readiness = this.calculateReadiness(scs, mri, tci);
    
    return {
      timestamp: new Date().toISOString(),
      commit: this.evidenceMap.sha,
      scores: {
        scs: parseFloat(scs.toFixed(3)),
        mri: parseFloat(mri.toFixed(3)),
        tci: parseFloat(tci.toFixed(3))
      },
      readiness,
      metadata: {
        tables: schema.getTables().length,
        migrationSteps: migrationSteps.length,
        testsRun: testResults.total || 0
      }
    };
  }
}