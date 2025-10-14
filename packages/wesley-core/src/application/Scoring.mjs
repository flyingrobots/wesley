/**
 * Wesley Scoring System
 * SCS - Schema Coverage Score
 * MRI - Migration Risk Index  
 * TCI - Test Confidence Index
 */

import { DirectiveProcessor } from '../domain/Directives.mjs';

export const SCORE_SCHEMA_VERSION = '2.0.0';
export const BUNDLE_VERSION = '2.0.0';
export const DEFAULT_THRESHOLDS = Object.freeze({
  scs: 0.8,
  tci: 0.7,
  mri: 0.4
});

export class ScoringEngine {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }

  /**
   * Schema Coverage Score - Did artifacts exist for each IR node?
   * Formula: Σ(weight × present) / Σ(weight)
   */
  calculateSCS(schema, requiredArtifacts = ['sql', 'typescript', 'zod']) {
    const breakdown = this.calculateSCSBreakdown(schema, requiredArtifacts);
    const weights = { sql: 0.4, types: 0.25, validation: 0.2, tests: 0.15 };
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [key, meta] of Object.entries(breakdown)) {
      if (meta.totalWeight > 0 && weights[key]) {
        totalWeight += weights[key];
        weightedScore += weights[key] * meta.score;
      }
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  calculateSCSBreakdown(schema, requiredArtifacts = ['sql', 'typescript', 'zod']) {
    const categories = {
      sql: { kinds: ['sql'], totalWeight: 0, coveredWeight: 0 },
      types: { kinds: ['typescript', 'ts'], totalWeight: 0, coveredWeight: 0 },
      validation: { kinds: ['zod', 'validation'], totalWeight: 0, coveredWeight: 0 },
      tests: { kinds: ['test', 'tests'], totalWeight: 0, coveredWeight: 0 }
    };

    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.isVirtual() || DirectiveProcessor.shouldSkip(field.directives)) {
          continue;
        }

        const uid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        const weight = DirectiveProcessor.getWeight(field.directives);
        if (weight <= 0) continue;

        for (const meta of Object.values(categories)) {
          meta.totalWeight += weight;
          if (this.hasAnyEvidence(uid, meta.kinds)) {
            meta.coveredWeight += weight;
          }
        }
      }
    }

    // Ensure legacy "complete artifacts" still accounted for consumers relying on default argument
    if (requiredArtifacts && requiredArtifacts.length) {
      const completeKey = '_completeArtifacts';
      if (!categories[completeKey]) {
        categories[completeKey] = { kinds: requiredArtifacts, totalWeight: 0, coveredWeight: 0 };
      }
      for (const table of schema.getTables()) {
        for (const field of table.getFields()) {
          if (field.isVirtual() || DirectiveProcessor.shouldSkip(field.directives)) continue;
          const uid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
          const weight = DirectiveProcessor.getWeight(field.directives);
          if (weight <= 0) continue;
          categories[completeKey].totalWeight += weight;
          if (this.evidenceMap?.hasCompleteArtifacts?.(uid, requiredArtifacts)) {
            categories[completeKey].coveredWeight += weight;
          }
        }
      }
    }

    for (const meta of Object.values(categories)) {
      meta.score = meta.totalWeight > 0 ? meta.coveredWeight / meta.totalWeight : 0;
      meta.score = this.round(meta.score);
    }

    return categories;
  }

  /**
   * Migration Risk Index - How spicy is this migration?
   * 0 = safe, 1 = maximum spice
   */
  calculateMRI(migrationSteps) {
    return this.calculateMRIMetrics(migrationSteps).score;
  }

  /**
   * Test Confidence Index - How well tested is the schema?
   * Weighted average of different test types
   */
  calculateTCI(schema, testResults = {}, migrationSteps = []) {
    const breakdown = this.calculateTCIBreakdown(schema, migrationSteps);
    const weights = { unitConstraints: 0.45, rls: 0.2, integrationRelations: 0.2, e2eOps: 0.15 };
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [key, meta] of Object.entries(breakdown)) {
      if (meta.total > 0 && weights[key]) {
        totalWeight += weights[key];
        weightedScore += weights[key] * meta.score;
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return this.round(score);
  }

  calculateTCIBreakdown(schema, migrationSteps = []) {
    const breakdown = {
      unitConstraints: { total: 0, covered: 0, components: {} },
      rls: { total: 0, covered: 0 },
      integrationRelations: { total: 0, covered: 0 },
      e2eOps: { total: 0, covered: 0 }
    };

    const structure = { total: 0, covered: 0 };
    const constraints = { total: 0, covered: 0 };
    const defaults = { total: 0, covered: 0 };
    const indexes = { total: 0, covered: 0 };

    for (const table of schema.getTables()) {
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      if (table.directives?.['@rls']) {
        breakdown.rls.total += 1;
        if (this.hasAnyEvidence(`${tableUid}.rls`, ['test'])) {
          breakdown.rls.covered += 1;
        }
      }

      for (const field of table.getFields()) {
        if (field.isVirtual()) {
          // Integration coverage for relation helpers is inferred from behavior/generation tests
          const relationUid = DirectiveProcessor.getUid(field.directives) || `rel:${table.name}.${field.name}`;
          // @hasMany / @hasOne fields surface via relation directives
          breakdown.integrationRelations.total += 1;
          if (this.hasAnyEvidence(relationUid, ['test'])) {
            breakdown.integrationRelations.covered += 1;
          }
          continue;
        }

        if (DirectiveProcessor.shouldSkip(field.directives)) {
          continue;
        }

        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        const weight = DirectiveProcessor.getWeight(field.directives);

        structure.total += weight;
        if (this.hasAnyEvidence(fieldUid, ['test'])) {
          structure.covered += weight;
        }

        if (field.isPrimaryKey()) {
          constraints.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.pk`, ['test'])) {
            constraints.covered += weight;
          }
        }

        if (field.isForeignKey()) {
          constraints.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.fk`, ['test'])) {
            constraints.covered += weight;
          }
          breakdown.integrationRelations.total += 1;
          if (this.hasAnyEvidence(`${fieldUid}.fk`, ['test'])) {
            breakdown.integrationRelations.covered += 1;
          }
        }

        if (field.isUnique()) {
          constraints.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.unique`, ['test'])) {
            constraints.covered += weight;
          }
        }

        if (field.directives?.['@check']) {
          constraints.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.check`, ['test'])) {
            constraints.covered += weight;
          }
        }

        if (field.directives?.['@default']) {
          defaults.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.default`, ['test'])) {
            defaults.covered += weight;
          }
        }

        if (field.isIndexed() || field.isUnique()) {
          indexes.total += weight;
          if (this.hasAnyEvidence(`${fieldUid}.index`, ['test'])) {
            indexes.covered += weight;
          }
        }

        if (field.directives?.['@computed'] || field.directives?.['@generated']) {
          breakdown.integrationRelations.total += 1;
          const suffix = field.directives['@computed'] ? 'behavior' : 'generated';
          if (this.hasAnyEvidence(`${fieldUid}.${suffix}`, ['test'])) {
            breakdown.integrationRelations.covered += 1;
          }
        }
      }
    }

    const structureScore = structure.total > 0 ? structure.covered / structure.total : 0;
    const constraintScore = constraints.total > 0 ? constraints.covered / constraints.total : 0;
    const defaultScore = defaults.total > 0 ? defaults.covered / defaults.total : 0;
    const indexScore = indexes.total > 0 ? indexes.covered / indexes.total : 0;

    breakdown.unitConstraints.total = structure.total + constraints.total + defaults.total + indexes.total;
    const normalizedWeight = (structure.total > 0 ? 0.35 : 0) + (constraints.total > 0 ? 0.35 : 0) + (defaults.total > 0 ? 0.1 : 0) + (indexes.total > 0 ? 0.2 : 0);
    const unitScore = normalizedWeight > 0
      ? (
          (structure.total > 0 ? 0.35 * structureScore : 0) +
          (constraints.total > 0 ? 0.35 * constraintScore : 0) +
          (defaults.total > 0 ? 0.1 * defaultScore : 0) +
          (indexes.total > 0 ? 0.2 * indexScore : 0)
        ) / normalizedWeight
      : 0;

    breakdown.unitConstraints.covered = breakdown.unitConstraints.total * unitScore;
    breakdown.unitConstraints.components = {
      structure: this.round(structureScore),
      constraints: this.round(constraintScore),
      defaults: this.round(defaultScore),
      indexes: this.round(indexScore)
    };
    breakdown.unitConstraints.score = this.round(unitScore);

    if (breakdown.rls.total > 0) {
      breakdown.rls.score = this.round(breakdown.rls.covered / breakdown.rls.total);
    } else {
      breakdown.rls.score = 0;
    }

    if (breakdown.integrationRelations.total > 0) {
      breakdown.integrationRelations.score = this.round(breakdown.integrationRelations.covered / breakdown.integrationRelations.total);
    } else {
      breakdown.integrationRelations.score = 0;
    }

    for (const step of migrationSteps) {
      breakdown.e2eOps.total += 1;
      if (this.hasAnyEvidence(this.migrationStepUid(step), ['test'])) {
        breakdown.e2eOps.covered += 1;
      }
    }

    if (breakdown.e2eOps.total > 0) {
      breakdown.e2eOps.score = this.round(breakdown.e2eOps.covered / breakdown.e2eOps.total);
    } else {
      breakdown.e2eOps.score = 0;
    }

    breakdown.rls.score = breakdown.rls.score ?? 0;
    breakdown.integrationRelations.score = breakdown.integrationRelations.score ?? 0;
    breakdown.e2eOps.score = breakdown.e2eOps.score ?? 0;

    return breakdown;
  }

  calculateMRIMetrics(migrationSteps) {
    const categories = {
      drops: 0,
      renames: 0,
      defaults: 0,
      typeChanges: 0,
      indexes: 0,
      other: 0
    };

    for (const step of migrationSteps) {
      switch (step.kind) {
        case 'drop_table':
          categories.drops += 40;
          break;
        case 'drop_column':
          categories.drops += 25;
          break;
        case 'rename_column':
        case 'rename_table':
          categories.renames += step.uidContinuity ? 5 : 15;
          break;
        case 'alter_type':
          categories.typeChanges += this.isSafeCast(step.from, step.to) ? 10 : 30;
          break;
        case 'add_column': {
          const risky = step.field?.nonNull && !step.field?.directives?.['@default'];
          categories.defaults += risky ? 25 : 10;
          break;
        }
        case 'create_index':
          categories.indexes += step.concurrent === false ? 10 : 5;
          break;
        default:
          categories.other += 5;
      }
    }

    const totalPoints = Object.values(categories).reduce((sum, value) => sum + value, 0);
    const capped = Math.min(totalPoints, 100);
    const score = this.round(capped / 100);

    const breakdown = {};
    for (const [key, points] of Object.entries(categories)) {
      breakdown[key] = {
        points,
        score: this.round(Math.min(points, 100) / 100),
        contribution: totalPoints > 0 ? this.round(points / totalPoints) : 0
      };
    }

    return { score, points: totalPoints, breakdown };
  }

  calculateMRIBreakdown(migrationSteps) {
    return this.calculateMRIMetrics(migrationSteps).breakdown;
  }

  /**
   * Calculate overall system readiness
   */
  calculateReadiness(scs, mri, tci, thresholds = {}) {
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
    
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
    if (!fromType || !toType) return false;
    if (fromType === toType) return true;

    const safeCasts = {
      Int: ['Float', 'Decimal', 'BigInt', 'String'],
      Float: ['Decimal', 'String'],
      Decimal: ['String'],
      BigInt: ['Decimal', 'String'],
      Boolean: ['String', 'Int'],
      ID: ['String'],
      UUID: ['String']
    };

    // Treat expressed as strings but allow case-insensitive matches
    const from = String(fromType);
    const to = String(toType);

    return (safeCasts[from] || safeCasts[from.charAt(0).toUpperCase() + from.slice(1)] || [])
      .map(target => target.toLowerCase())
      .includes(to.toLowerCase());
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
    const scsBreakdown = this.calculateSCSBreakdown(schema);
    const scs = this.round(this.calculateSCS(schema));
    const mriMetrics = this.calculateMRIMetrics(migrationSteps);
    const tciBreakdown = this.calculateTCIBreakdown(schema, migrationSteps);
    const tci = this.calculateTCI(schema, testResults, migrationSteps);
    const readiness = this.calculateReadiness(scs, mriMetrics.score, tci);

    return {
      version: SCORE_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      commit: this.evidenceMap.sha,
      scores: {
        scs,
        mri: mriMetrics.score,
        tci,
        breakdown: {
          scs: this.serializeBreakdown(scsBreakdown),
          tci: this.serializeBreakdown(tciBreakdown),
          mri: this.serializeBreakdown(mriMetrics.breakdown)
        }
      },
      thresholds: { ...DEFAULT_THRESHOLDS },
      readiness,
      metadata: {
        tables: schema.getTables().length,
        migrationSteps: migrationSteps.length,
        testsRun: testResults.total || 0
      }
    };
  }

  serializeBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== 'object') return breakdown;
    const result = {};
    for (const [key, value] of Object.entries(breakdown)) {
      if (key.startsWith('_')) {
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = {};
        for (const [innerKey, innerValue] of Object.entries(value)) {
          if (innerKey.startsWith('_')) continue;
          if (typeof innerValue === 'number') {
            result[key][innerKey] = this.round(innerValue);
          } else if (innerValue && typeof innerValue === 'object') {
            result[key][innerKey] = this.serializeBreakdown(innerValue);
          } else {
            result[key][innerKey] = innerValue;
          }
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  migrationStepUid(step) {
    if (step.uid) return step.uid;
    const parts = [step.kind];
    if (step.table) parts.push(step.table);
    if (step.column) parts.push(step.column);
    if (step.name) parts.push(step.name);
    return `migration:${parts.join(':')}`;
  }

  hasAnyEvidence(uid, kinds) {
    if (!this.evidenceMap || typeof this.evidenceMap.getEvidence !== 'function') {
      return false;
    }
    const evidence = this.evidenceMap.getEvidence(uid);
    if (!evidence) return false;
    return kinds.some(kind => Array.isArray(evidence[kind]) && evidence[kind].length > 0);
  }

  round(value, fallback = 0) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.round(value * 1000) / 1000;
  }
}
