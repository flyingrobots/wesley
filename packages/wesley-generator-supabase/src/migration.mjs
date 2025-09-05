/**
 * Migration Differ - Node.js implementation
 * Calculates differences between schemas for migrations
 */

import { MigrationSafety } from '../MigrationSafety.mjs';

export class MigrationDiffer {
  constructor(options = {}) {
    this.safety = new MigrationSafety(options);
  }
  
  async diff(previousSchema, currentSchema) {
    const steps = [];

    const prevTables = previousSchema?.tables || {};
    const currTables = currentSchema?.tables || {};

    // Find added tables
    for (const tableName of Object.keys(currTables)) {
      if (!prevTables[tableName]) {
        steps.push({ kind: 'create_table', table: tableName });
        continue;
      }

      // Check for field changes
      const prevFields = prevTables[tableName].fields || {};
      const currFields = currTables[tableName].fields || {};

      // Find added fields
      for (const fieldName of Object.keys(currFields)) {
        const currField = currFields[fieldName];
        const prevField = prevFields[fieldName];

        if (!prevField && !currField.isVirtual()) {
          steps.push({ 
            kind: 'add_column', 
            table: tableName, 
            column: fieldName, 
            field: currField 
          });
        } else if (prevField && currField) {
          // Check for type changes (including array and item nullability)
          const typeChanged = prevField.type !== currField.type;
          const nullChanged = prevField.nonNull !== currField.nonNull;
          const listChanged = prevField.list !== currField.list;
          const itemNullChanged = prevField.itemNonNull !== currField.itemNonNull;
          
          if (typeChanged || nullChanged || listChanged || itemNullChanged) {
            steps.push({ 
              kind: 'alter_type', 
              table: tableName, 
              column: fieldName, 
              from: prevField, 
              to: currField 
            });
          }
        }
      }

      // Find removed fields
      for (const fieldName of Object.keys(prevFields)) {
        if (!currFields[fieldName]) {
          steps.push({ 
            kind: 'drop_column', 
            table: tableName, 
            column: fieldName 
          });
        }
      }
    }

    // Find dropped tables
    for (const tableName of Object.keys(prevTables)) {
      if (!currTables[tableName]) {
        steps.push({ kind: 'drop_table', table: tableName });
      }
    }

    // Analyze migration safety
    const safetyAnalysis = this.safety.analyzeMigration(steps);
    
    // Generate pre-flight snapshot if risky
    let preFlightSnapshot = null;
    if (safetyAnalysis.totalRiskScore >= 20 && this.safety.generateSnapshots) {
      preFlightSnapshot = this.safety.generatePreFlightSnapshot(currentSchema, steps);
    }
    
    // Calculate Holmes risk score
    const holmesScore = this.safety.calculateHolmesRiskScore(steps);

    return { 
      steps,
      safetyAnalysis,
      preFlightSnapshot,
      holmesScore
    };
  }
}

export class MigrationSQLGenerator {
  async generate(diff) {
    const statements = [];
    
    for (const step of diff.steps) {
      switch (step.kind) {
        case 'create_table':
          statements.push(
            `-- Table ${step.table} was added. Re-run "wesley generate" to emit full CREATE statement.`
          );
          break;
          
        case 'add_column':
          const type = this.mapType(step.field);
          statements.push(
            `ALTER TABLE "${step.table}" ADD COLUMN "${step.column}" ${type};`
          );
          break;
          
        case 'drop_column':
          statements.push(
            `ALTER TABLE "${step.table}" DROP COLUMN "${step.column}";`
          );
          break;
          
        case 'alter_type':
          statements.push(
            `ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" TYPE ${this.mapType(step.to)};`
          );
          if (step.to.nonNull && !step.from.nonNull) {
            statements.push(
              `ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" SET NOT NULL;`
            );
          }
          if (!step.to.nonNull && step.from.nonNull) {
            statements.push(
              `ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" DROP NOT NULL;`
            );
          }
          break;
          
        case 'drop_table':
          statements.push(
            `DROP TABLE IF EXISTS "${step.table}";`
          );
          break;
      }
    }
    
    return statements.join('\n');
  }

  mapType(field) {
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