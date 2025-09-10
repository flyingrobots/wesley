/**
 * Differential Validator - Wave 2 WP3.T004
 * Compare expected vs actual schema state with precision drift detection
 */

import { MigrationSafety } from '../MigrationSafety.mjs';

export class DifferentialValidator {
  constructor(options = {}) {
    this.safety = new MigrationSafety(options);
    this.strictMode = options.strictMode ?? true;
    this.trackModifications = options.trackModifications ?? true;
    this.tolerance = options.tolerance ?? {
      typeCompatibility: 'strict', // 'strict' | 'compatible' | 'loose'
      nullabilityCheck: true,
      constraintValidation: true,
      indexValidation: true
    };
    this.modificationHistory = options.trackModifications ? [] : null;
  }

  /**
   * Compare expected vs actual schema state and detect drift
   * @param {Schema} expectedSchema - The expected schema state
   * @param {Schema} actualSchema - The actual schema state from database
   * @param {Object} options - Validation options
   * @returns {Promise<DriftReport>} Detailed drift analysis report
   */
  async validateSchemaDrift(expectedSchema, actualSchema, options = {}) {
    const timestamp = new Date().toISOString();
    const context = {
      timestamp,
      environment: options.environment || 'unknown',
      validationId: options.validationId || this.generateValidationId()
    };

    // Perform comprehensive drift detection
    const driftAnalysis = await this.detectDrift(expectedSchema, actualSchema);
    
    // Generate detailed diff report
    const diffReport = this.generateDetailedDiff(driftAnalysis);
    
    // Assess drift severity and impact
    const impactAssessment = this.assessDriftImpact(driftAnalysis);
    
    // Track modifications if enabled
    if (this.trackModifications && driftAnalysis.hasDrift) {
      this.recordModification(context, driftAnalysis);
    }

    // Generate repair recommendations
    const repairRecommendations = this.generateRepairRecommendations(driftAnalysis);

    return {
      context,
      hasDrift: driftAnalysis.hasDrift,
      driftSeverity: impactAssessment.severity,
      summary: {
        totalDifferences: driftAnalysis.differences.length,
        criticalDifferences: driftAnalysis.differences.filter(d => d.severity === 'critical').length,
        tablesAffected: [...new Set(driftAnalysis.differences.map(d => d.table))].length,
        repairComplexity: impactAssessment.repairComplexity
      },
      differences: driftAnalysis.differences,
      diffReport,
      impactAssessment,
      repairRecommendations,
      modificationHistory: this.modificationHistory?.slice(-10) || null // Last 10 modifications
    };
  }

  /**
   * Detect schema drift with precision
   * @param {Schema} expected - Expected schema
   * @param {Schema} actual - Actual schema
   * @returns {Promise<Object>} Drift analysis
   */
  async detectDrift(expected, actual) {
    const differences = [];
    const expectedTables = expected?.tables || {};
    const actualTables = actual?.tables || {};

    // Check for table-level differences
    const tableDifferences = this.detectTableDifferences(expectedTables, actualTables);
    differences.push(...tableDifferences);

    // Check for field-level differences in common tables
    const commonTables = Object.keys(expectedTables).filter(name => actualTables[name]);
    for (const tableName of commonTables) {
      const fieldDifferences = this.detectFieldDifferences(
        tableName,
        expectedTables[tableName].fields || {},
        actualTables[tableName].fields || {}
      );
      differences.push(...fieldDifferences);

      // Check for directive differences
      const directiveDifferences = this.detectDirectiveDifferences(
        tableName,
        expectedTables[tableName].directives || {},
        actualTables[tableName].directives || {}
      );
      differences.push(...directiveDifferences);
    }

    // Sort differences by severity and impact
    differences.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return {
      hasDrift: differences.length > 0,
      differences,
      driftCategories: this.categorizeDrift(differences)
    };
  }

  /**
   * Detect table-level differences
   */
  detectTableDifferences(expectedTables, actualTables) {
    const differences = [];
    const expectedTableNames = Object.keys(expectedTables);
    const actualTableNames = Object.keys(actualTables);

    // Missing tables (expected but not actual)
    const missingTables = expectedTableNames.filter(name => !actualTables[name]);
    for (const tableName of missingTables) {
      differences.push({
        type: 'missing_table',
        table: tableName,
        severity: 'critical',
        impact: 'breaking',
        description: `Table '${tableName}' is expected but missing from actual schema`,
        expectedValue: expectedTables[tableName],
        actualValue: null,
        repairAction: 'create_table'
      });
    }

    // Extra tables (actual but not expected)
    const extraTables = actualTableNames.filter(name => !expectedTables[name]);
    for (const tableName of extraTables) {
      differences.push({
        type: 'extra_table',
        table: tableName,
        severity: this.strictMode ? 'high' : 'medium',
        impact: 'schema_drift',
        description: `Table '${tableName}' exists in actual schema but not expected`,
        expectedValue: null,
        actualValue: actualTables[tableName],
        repairAction: this.strictMode ? 'drop_table' : 'document_table'
      });
    }

    return differences;
  }

  /**
   * Detect field-level differences
   */
  detectFieldDifferences(tableName, expectedFields, actualFields) {
    const differences = [];
    const expectedFieldNames = Object.keys(expectedFields);
    const actualFieldNames = Object.keys(actualFields);

    // Missing fields
    const missingFields = expectedFieldNames.filter(name => 
      !actualFields[name] && !expectedFields[name].isVirtual()
    );
    for (const fieldName of missingFields) {
      const field = expectedFields[fieldName];
      differences.push({
        type: 'missing_field',
        table: tableName,
        column: fieldName,
        severity: field.nonNull ? 'critical' : 'high',
        impact: field.nonNull ? 'breaking' : 'data_loss_risk',
        description: `Field '${fieldName}' is expected but missing from table '${tableName}'`,
        expectedValue: field,
        actualValue: null,
        repairAction: 'add_column'
      });
    }

    // Extra fields
    const extraFields = actualFieldNames.filter(name => !expectedFields[name]);
    for (const fieldName of extraFields) {
      differences.push({
        type: 'extra_field',
        table: tableName,
        column: fieldName,
        severity: this.strictMode ? 'medium' : 'low',
        impact: 'schema_drift',
        description: `Field '${fieldName}' exists in table '${tableName}' but not expected`,
        expectedValue: null,
        actualValue: actualFields[fieldName],
        repairAction: this.strictMode ? 'drop_column' : 'document_field'
      });
    }

    // Field type and property differences
    const commonFields = expectedFieldNames.filter(name => actualFields[name]);
    for (const fieldName of commonFields) {
      const expected = expectedFields[fieldName];
      const actual = actualFields[fieldName];

      const fieldDiffs = this.compareFieldProperties(tableName, fieldName, expected, actual);
      differences.push(...fieldDiffs);
    }

    return differences;
  }

  /**
   * Compare field properties for differences
   */
  compareFieldProperties(tableName, fieldName, expected, actual) {
    const differences = [];

    // Type compatibility check
    if (!this.areTypesCompatible(expected.type, actual.type)) {
      differences.push({
        type: 'field_type_mismatch',
        table: tableName,
        column: fieldName,
        severity: 'critical',
        impact: 'breaking',
        description: `Field '${fieldName}' type mismatch: expected '${expected.type}', actual '${actual.type}'`,
        expectedValue: expected.type,
        actualValue: actual.type,
        repairAction: 'alter_column_type'
      });
    }

    // Nullability checks
    if (this.tolerance.nullabilityCheck) {
      if (expected.nonNull !== actual.nonNull) {
        const severity = expected.nonNull && !actual.nonNull ? 'high' : 'medium';
        differences.push({
          type: 'nullability_mismatch',
          table: tableName,
          column: fieldName,
          severity,
          impact: expected.nonNull && !actual.nonNull ? 'data_integrity_risk' : 'constraint_relaxed',
          description: `Field '${fieldName}' nullability mismatch: expected ${expected.nonNull ? 'NOT NULL' : 'NULL'}, actual ${actual.nonNull ? 'NOT NULL' : 'NULL'}`,
          expectedValue: expected.nonNull,
          actualValue: actual.nonNull,
          repairAction: expected.nonNull ? 'add_not_null' : 'drop_not_null'
        });
      }

      // List nullability for arrays
      if (expected.list && actual.list && expected.itemNonNull !== actual.itemNonNull) {
        differences.push({
          type: 'array_item_nullability_mismatch',
          table: tableName,
          column: fieldName,
          severity: 'medium',
          impact: 'data_integrity_risk',
          description: `Field '${fieldName}' array item nullability mismatch`,
          expectedValue: expected.itemNonNull,
          actualValue: actual.itemNonNull,
          repairAction: 'alter_array_nullability'
        });
      }
    }

    // List property differences
    if (expected.list !== actual.list) {
      differences.push({
        type: 'list_property_mismatch',
        table: tableName,
        column: fieldName,
        severity: 'critical',
        impact: 'breaking',
        description: `Field '${fieldName}' list property mismatch: expected ${expected.list ? 'array' : 'scalar'}, actual ${actual.list ? 'array' : 'scalar'}`,
        expectedValue: expected.list,
        actualValue: actual.list,
        repairAction: 'reconstruct_column'
      });
    }

    return differences;
  }

  /**
   * Detect directive differences
   */
  detectDirectiveDifferences(tableName, expectedDirectives, actualDirectives) {
    const differences = [];
    
    if (!this.tolerance.constraintValidation) {
      return differences;
    }

    const expectedKeys = Object.keys(expectedDirectives);
    const actualKeys = Object.keys(actualDirectives);

    // Missing directives
    const missingDirectives = expectedKeys.filter(key => !actualDirectives[key]);
    for (const directiveKey of missingDirectives) {
      differences.push({
        type: 'missing_directive',
        table: tableName,
        directive: directiveKey,
        severity: this.getDirectiveSeverity(directiveKey),
        impact: 'constraint_missing',
        description: `Directive '${directiveKey}' expected on table '${tableName}' but missing`,
        expectedValue: expectedDirectives[directiveKey],
        actualValue: null,
        repairAction: 'add_directive'
      });
    }

    // Extra directives
    const extraDirectives = actualKeys.filter(key => !expectedDirectives[key]);
    for (const directiveKey of extraDirectives) {
      differences.push({
        type: 'extra_directive',
        table: tableName,
        directive: directiveKey,
        severity: this.strictMode ? 'medium' : 'low',
        impact: 'schema_drift',
        description: `Directive '${directiveKey}' found on table '${tableName}' but not expected`,
        expectedValue: null,
        actualValue: actualDirectives[directiveKey],
        repairAction: this.strictMode ? 'remove_directive' : 'document_directive'
      });
    }

    return differences;
  }

  /**
   * Check if types are compatible based on tolerance settings
   */
  areTypesCompatible(expectedType, actualType) {
    if (expectedType === actualType) return true;

    switch (this.tolerance.typeCompatibility) {
      case 'strict':
        return false;
        
      case 'compatible':
        return this.isTypeCompatible(expectedType, actualType);
        
      case 'loose':
        return this.isTypeLooselyCompatible(expectedType, actualType);
        
      default:
        return false;
    }
  }

  /**
   * Check if types are compatible (not strict equality)
   */
  isTypeCompatible(expected, actual) {
    const compatibilityMap = {
      'String': ['text', 'varchar', 'char'],
      'Int': ['integer', 'int4', 'smallint', 'bigint'],
      'Float': ['real', 'double precision', 'numeric', 'decimal'],
      'Boolean': ['boolean', 'bool'],
      'DateTime': ['timestamp', 'timestamptz', 'datetime'],
      'ID': ['uuid', 'text', 'varchar']
    };

    const expectedCompatible = compatibilityMap[expected] || [];
    const actualCompatible = compatibilityMap[actual] || [];

    return expectedCompatible.includes(actual) || actualCompatible.includes(expected);
  }

  /**
   * Check if types are loosely compatible (very permissive)
   */
  isTypeLooselyCompatible(expected, actual) {
    // In loose mode, most types can be converted
    const stringLike = ['String', 'text', 'varchar', 'char', 'ID'];
    const numberLike = ['Int', 'Float', 'integer', 'real', 'numeric', 'decimal'];
    
    if (stringLike.includes(expected) && stringLike.includes(actual)) return true;
    if (numberLike.includes(expected) && numberLike.includes(actual)) return true;
    
    return this.isTypeCompatible(expected, actual);
  }

  /**
   * Get severity level for directive differences
   */
  getDirectiveSeverity(directiveKey) {
    const severityMap = {
      '@primaryKey': 'critical',
      '@foreignKey': 'high',
      '@unique': 'high',
      '@index': 'medium',
      '@check': 'high',
      '@default': 'low',
      '@table': 'critical',
      '@rls': 'high'
    };

    return severityMap[directiveKey] || 'medium';
  }

  /**
   * Categorize drift by type
   */
  categorizeDrift(differences) {
    const categories = {
      structural: [], // Tables/fields missing or extra
      behavioral: [], // Constraints, directives, RLS
      semantic: [],   // Type mismatches, nullability
      cosmetic: []    // Documentation, naming
    };

    for (const diff of differences) {
      switch (diff.type) {
        case 'missing_table':
        case 'extra_table':
        case 'missing_field':
        case 'extra_field':
          categories.structural.push(diff);
          break;
          
        case 'missing_directive':
        case 'extra_directive':
          categories.behavioral.push(diff);
          break;
          
        case 'field_type_mismatch':
        case 'nullability_mismatch':
        case 'array_item_nullability_mismatch':
        case 'list_property_mismatch':
          categories.semantic.push(diff);
          break;
          
        default:
          categories.cosmetic.push(diff);
      }
    }

    return categories;
  }

  /**
   * Generate detailed diff report
   */
  generateDetailedDiff(driftAnalysis) {
    const { differences, driftCategories } = driftAnalysis;
    
    const report = {
      summary: `Found ${differences.length} schema differences`,
      categories: Object.entries(driftCategories).map(([category, diffs]) => ({
        category,
        count: diffs.length,
        items: diffs.map(d => ({
          description: d.description,
          severity: d.severity,
          impact: d.impact,
          location: d.table + (d.column ? `.${d.column}` : ''),
          repairAction: d.repairAction
        }))
      })),
      detailedDifferences: differences
    };

    return report;
  }

  /**
   * Assess drift impact and repair complexity
   */
  assessDriftImpact(driftAnalysis) {
    const { differences } = driftAnalysis;
    
    const criticalCount = differences.filter(d => d.severity === 'critical').length;
    const highCount = differences.filter(d => d.severity === 'high').length;
    const breakingChanges = differences.filter(d => d.impact === 'breaking').length;
    
    let severity, repairComplexity;
    
    if (criticalCount > 0 || breakingChanges > 0) {
      severity = 'critical';
      repairComplexity = 'high';
    } else if (highCount > 0) {
      severity = 'high';
      repairComplexity = 'medium';
    } else if (differences.length > 10) {
      severity = 'medium';
      repairComplexity = 'medium';
    } else if (differences.length > 0) {
      severity = 'low';
      repairComplexity = 'low';
    } else {
      severity = 'none';
      repairComplexity = 'none';
    }

    return {
      severity,
      repairComplexity,
      criticalIssues: criticalCount,
      highIssues: highCount,
      breakingChanges,
      estimatedRepairTime: this.estimateRepairTime(repairComplexity, differences.length),
      riskLevel: this.calculateRiskLevel(differences)
    };
  }

  /**
   * Generate repair recommendations
   */
  generateRepairRecommendations(driftAnalysis) {
    const { differences } = driftAnalysis;
    
    const recommendations = {
      immediate: [],
      planned: [],
      optional: []
    };

    for (const diff of differences) {
      const recommendation = {
        action: diff.repairAction,
        description: diff.description,
        impact: diff.impact,
        complexity: this.getActionComplexity(diff.repairAction),
        sql: this.generateRepairHint(diff)
      };

      if (diff.severity === 'critical') {
        recommendations.immediate.push(recommendation);
      } else if (diff.severity === 'high' || diff.severity === 'medium') {
        recommendations.planned.push(recommendation);
      } else {
        recommendations.optional.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Generate repair SQL hint
   */
  generateRepairHint(difference) {
    switch (difference.repairAction) {
      case 'create_table':
        return `-- Use wesley generate to create full table schema`;
      case 'add_column':
        return `ALTER TABLE "${difference.table}" ADD COLUMN "${difference.column}" ${this.inferColumnType(difference.expectedValue)};`;
      case 'drop_column':
        return `ALTER TABLE "${difference.table}" DROP COLUMN "${difference.column}";`;
      case 'alter_column_type':
        return `ALTER TABLE "${difference.table}" ALTER COLUMN "${difference.column}" TYPE ${difference.expectedValue};`;
      default:
        return `-- Manual intervention required for ${difference.repairAction}`;
    }
  }

  /**
   * Utility methods
   */
  generateValidationId() {
    return `dv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  recordModification(context, driftAnalysis) {
    if (!this.modificationHistory) return;
    
    this.modificationHistory.push({
      ...context,
      driftCount: driftAnalysis.differences.length,
      severityBreakdown: this.getSeverityBreakdown(driftAnalysis.differences)
    });
  }

  getSeverityBreakdown(differences) {
    return differences.reduce((acc, diff) => {
      acc[diff.severity] = (acc[diff.severity] || 0) + 1;
      return acc;
    }, {});
  }

  getActionComplexity(action) {
    const complexityMap = {
      'create_table': 'high',
      'drop_table': 'high',
      'add_column': 'low',
      'drop_column': 'medium',
      'alter_column_type': 'high',
      'add_not_null': 'medium',
      'drop_not_null': 'low'
    };
    return complexityMap[action] || 'medium';
  }

  estimateRepairTime(complexity, diffCount) {
    const baseMinutes = { none: 0, low: 15, medium: 60, high: 240 };
    return baseMinutes[complexity] + (diffCount * 5);
  }

  calculateRiskLevel(differences) {
    const riskScore = differences.reduce((score, diff) => {
      const severityScores = { critical: 10, high: 6, medium: 3, low: 1 };
      return score + (severityScores[diff.severity] || 0);
    }, 0);

    if (riskScore >= 50) return 'extreme';
    if (riskScore >= 20) return 'high';
    if (riskScore >= 10) return 'medium';
    if (riskScore > 0) return 'low';
    return 'minimal';
  }

  inferColumnType(field) {
    const typeMap = { 
      ID: 'uuid', 
      String: 'text', 
      Int: 'integer', 
      Float: 'double precision', 
      Boolean: 'boolean', 
      DateTime: 'timestamptz' 
    };
    const pgType = typeMap[field.type] || 'text';
    return field.nonNull ? `${pgType} NOT NULL` : pgType;
  }
}

// Export singleton with default configuration
export const differentialValidator = new DifferentialValidator();