/**
 * Wesley Scoring System
 * SCS - Schema Coverage Score
 * MRI - Migration Risk Index  
 * TCI - Test Confidence Index
 */

import { DirectiveProcessor } from '../domain/Directives.mjs';

// Bundle version used by GenerationPipeline and consumers when emitting bundles
export const BUNDLE_VERSION = '2.0.0';

export class ScoringEngine {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }

  /**
   * Schema Coverage Score - Did artifacts exist for each IR node?
   * Formula: Σ(weight × present) / Σ(weight)
   */
  calculateSCSDetails(schema, options = {}) {
    const artifactGroups = options.artifactGroups || {
      sql: ['sql'],
      types: ['ts', 'typescript'],
      validation: ['zod'],
      tests: ['test']
    };
    const rollupGroups = options.rollupGroups || ['sql', 'types', 'validation'];

    const totals = {};
    for (const key of Object.keys(artifactGroups)) {
      totals[key] = { totalWeight: 0, earnedWeight: 0 };
    }

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.isVirtual() || DirectiveProcessor.shouldSkip(field.directives)) {
          continue;
        }

        // Normalize to the same fallback UID format used by generators
        // (e.g., PostgreSQL + pgTAP use `col:Table.field`).
        const uid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        const weight = DirectiveProcessor.getWeight(field.directives);

        totalWeight += weight;
        let hasAllRequired = true;

        for (const [group, kinds] of Object.entries(artifactGroups)) {
          const hasArtifact = this.evidenceMap.hasArtifact(uid, kinds);
          totals[group].totalWeight += weight;
          if (hasArtifact) {
            totals[group].earnedWeight += weight;
          } else if (rollupGroups.includes(group)) {
            hasAllRequired = false;
          }
        }

        if (hasAllRequired) {
          earnedWeight += weight;
        }
      }
    }

    const breakdown = {};
    for (const [group, summary] of Object.entries(totals)) {
      const { totalWeight: total, earnedWeight: earned } = summary;
      breakdown[group] = {
        score: total > 0 ? parseFloat((earned / total).toFixed(3)) : 0,
        earnedWeight: parseFloat(earned.toFixed(3)),
        totalWeight: parseFloat(total.toFixed(3))
      };
    }

    const score = totalWeight > 0 ? earnedWeight / totalWeight : 0;

    return {
      score: parseFloat(score.toFixed(3)),
      breakdown
    };
  }

  calculateSCS(schema, options) {
    return this.calculateSCSDetails(schema, options).score;
  }

  /**
   * Migration Risk Index - How spicy is this migration?
   * 0 = safe, 1 = maximum spice
   */
  calculateMRIDetails(migrationSteps = []) {
    const components = {
      drops: { points: 0, count: 0 },
      renames_without_uid: { points: 0, count: 0 },
      add_not_null_without_default: { points: 0, count: 0 },
      non_concurrent_indexes: { points: 0, count: 0 }
    };

    let riskPoints = 0;

    for (const step of migrationSteps) {
      switch (step.kind) {
        case 'drop_table':
          components.drops.points += 40;
          components.drops.count += 1;
          riskPoints += 40;
          break;
        case 'drop_column':
          components.drops.points += 25;
          components.drops.count += 1;
          riskPoints += 25;
          break;
        case 'alter_type':
          if (!this.isSafeCast(step.from, step.to)) {
            components.add_not_null_without_default.points += 30;
            components.add_not_null_without_default.count += 1;
            riskPoints += 30;
          }
          break;
        case 'add_column':
          if (step.field?.nonNull && !step.field?.directives?.['@default']) {
            components.add_not_null_without_default.points += 25;
            components.add_not_null_without_default.count += 1;
            riskPoints += 25;
          }
          break;
        case 'rename_column':
        case 'rename_table':
          if (!step.uidContinuity) {
            components.renames_without_uid.points += 10;
            components.renames_without_uid.count += 1;
            riskPoints += 10;
          }
          break;
        case 'create_index':
          if (step.concurrent === false) {
            components.non_concurrent_indexes.points += 10;
            components.non_concurrent_indexes.count += 1;
            riskPoints += 10;
          }
          break;
      }
    }

    const normalized = Math.min(100, riskPoints) / 100;

    const breakdown = {};
    const normalizedTotal = Math.min(100, riskPoints) || 0;
    for (const [key, value] of Object.entries(components)) {
      const limitedPoints = Math.min(value.points, 100);
      breakdown[key] = {
        score: normalizedTotal > 0 ? parseFloat((limitedPoints / normalizedTotal).toFixed(3)) : 0,
        points: value.points,
        count: value.count
      };
    }

    breakdown.totalPoints = riskPoints;

    return {
      score: parseFloat(normalized.toFixed(3)),
      breakdown
    };
  }

  calculateMRI(migrationSteps) {
    return this.calculateMRIDetails(migrationSteps).score;
  }

  /**
   * Test Confidence Index - How well tested is the schema?
   * Weighted average of different test types
   */
  calculateTCIDetails(schema, testResults = {}) {
    const weights = {
      structure: 0.20,    // Tables/columns exist
      constraints: 0.45,  // PK/FK/unique work
      migrations: 0.25,   // Migrations apply cleanly
      performance: 0.10   // Indexes used
    };

    const testedStructure = this.collectStructureEvidence(schema);
    const structureDetails = this.calculateTestCoverageDetails(schema, testedStructure);

    const testedConstraints = this.collectConstraintEvidence(schema);
    const constraintDetails = this.calculateConstraintCoverageDetails(schema, testedConstraints);

    const relationDetails = this.calculateRelationCoverageDetails(schema, testedConstraints);
    const rlsDetails = this.calculateRlsCoverageDetails(schema);

    const migrationCoverage = testResults.migrations?.passed /
      (testResults.migrations?.total || 1) || 0;
    const performanceCoverage = this.calculateIndexCoverage(
      schema,
      testResults.performance || []
    );

    const score = (
      weights.structure * structureDetails.score +
      weights.constraints * constraintDetails.score +
      weights.migrations * migrationCoverage +
      weights.performance * performanceCoverage
    );

    const breakdown = {
      unit_constraints: {
        score: structureNumber(constraintDetails.score),
        covered: constraintDetails.coveredWeight,
        total: constraintDetails.totalWeight
      },
      unit_rls: {
        score: structureNumber(rlsDetails.score),
        covered: rlsDetails.covered,
        total: rlsDetails.total
      },
      integration_relations: {
        score: structureNumber(relationDetails.score),
        covered: relationDetails.covered,
        total: relationDetails.total
      },
      e2e_ops: {
        score: null,
        covered: 0,
        total: 0,
        note: 'Query operation test tracking not yet implemented'
      },
      legacy_components: {
        structure: structureDetails.score,
        constraints: constraintDetails.score,
        migrations: migrationCoverage,
        performance: performanceCoverage
      }
    };

    return {
      score: parseFloat(score.toFixed(3)),
      breakdown
    };
  }

  calculateTCI(schema, testResults) {
    return this.calculateTCIDetails(schema, testResults).score;
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

  calculateTestCoverageDetails(schema, testedElements) {
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

    const score = total > 0 ? covered / total : 0;
    return {
      score,
      total,
      covered
    };
  }

  calculateTestCoverage(schema, testedElements) {
    return this.calculateTestCoverageDetails(schema, testedElements).score;
  }

  calculateConstraintCoverageDetails(schema, testedConstraints) {
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

    const score = totalWeight > 0 ? coveredWeight / totalWeight : 0;
    return {
      score,
      totalWeight,
      coveredWeight
    };
  }

  calculateConstraintCoverage(schema, testedConstraints) {
    return this.calculateConstraintCoverageDetails(schema, testedConstraints).score;
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
    const scsDetails = this.calculateSCSDetails(schema);
    const mriDetails = this.calculateMRIDetails(migrationSteps);
    const tciDetails = this.calculateTCIDetails(schema, testResults);

    const readiness = this.calculateReadiness(
      scsDetails.score,
      mriDetails.score,
      tciDetails.score
    );

    return {
      version: BUNDLE_VERSION,
      timestamp: new Date().toISOString(),
      commit: this.evidenceMap.sha,
      scores: {
        scs: scsDetails.score,
        mri: mriDetails.score,
        tci: tciDetails.score
      },
      breakdown: {
        scs: scsDetails.breakdown,
        mri: mriDetails.breakdown,
        tci: tciDetails.breakdown
      },
      readiness,
      metadata: {
        tables: schema.getTables().length,
        migrationSteps: migrationSteps.length,
        testsRun: testResults.total || 0
      }
    };
  }

  collectStructureEvidence(schema) {
    const tested = new Set();

    for (const table of schema.getTables()) {
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      if (this.evidenceMap.hasArtifact(tableUid, 'test')) {
        tested.add(table.name);
      }

      for (const field of table.getFields()) {
        if (field.isVirtual()) continue;
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        if (this.evidenceMap.hasArtifact(fieldUid, 'test')) {
          tested.add(`${table.name}.${field.name}`);
        }
      }
    }

    return Array.from(tested);
  }

  collectConstraintEvidence(schema) {
    const tested = new Set();

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;

        if (field.isPrimaryKey() && this.evidenceMap.hasArtifact(`${fieldUid}.pk`, 'test')) {
          tested.add(`${table.name}.${field.name}.pk`);
        }

        if (field.isForeignKey() && this.evidenceMap.hasArtifact(`${fieldUid}.fk`, 'test')) {
          tested.add(`${table.name}.${field.name}.fk`);
        }

        if (field.isUnique() && this.evidenceMap.hasArtifact(`${fieldUid}.unique`, 'test')) {
          tested.add(`${table.name}.${field.name}.unique`);
        }
      }
    }

    return Array.from(tested);
  }

  calculateRelationCoverageDetails(schema, testedConstraintsArray) {
    const tested = new Set(testedConstraintsArray);
    let total = 0;
    let covered = 0;

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (!field.isForeignKey()) continue;
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `${table.name}.${field.name}`;
        total += 1;
        if (tested.has(`${table.name}.${field.name}.fk`) || this.evidenceMap.hasArtifact(`${fieldUid}.fk`, 'test')) {
          covered += 1;
        }
      }
    }

    return {
      score: total > 0 ? covered / total : 0,
      covered,
      total
    };
  }

  calculateRlsCoverageDetails(schema) {
    let total = 0;
    let covered = 0;

    for (const table of schema.getTables()) {
      if (!table.directives?.['@rls']) continue;
      total += 1;
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      if (this.evidenceMap.hasArtifact(`${tableUid}.rls`, 'test')) {
        covered += 1;
      }
    }

    return {
      score: total > 0 ? covered / total : 0,
      covered,
      total
    };
  }
}

function structureNumber(value) {
  if (value === null || value === undefined) return null;
  return parseFloat(value.toFixed(3));
}
