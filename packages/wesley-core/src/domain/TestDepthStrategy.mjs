/**
 * Test Depth Strategy
 * Determines test complexity based on field weights and criticality
 */

export class TestDepthStrategy {
  constructor(options = {}) {
    this.thresholds = {
      minimal: options.minimalThreshold || 20,
      standard: options.standardThreshold || 50,
      comprehensive: options.comprehensiveThreshold || 80,
      exhaustive: 100
    };
    
    this.depthLevels = {
      MINIMAL: 'minimal',
      STANDARD: 'standard', 
      COMPREHENSIVE: 'comprehensive',
      EXHAUSTIVE: 'exhaustive'
    };
  }
  
  /**
   * Determine test depth for a field based on weight
   */
  getFieldTestDepth(field) {
    const weight = this.calculateFieldWeight(field);
    
    if (weight >= this.thresholds.comprehensive) {
      return this.depthLevels.EXHAUSTIVE;
    } else if (weight >= this.thresholds.standard) {
      return this.depthLevels.COMPREHENSIVE;
    } else if (weight >= this.thresholds.minimal) {
      return this.depthLevels.STANDARD;
    } else {
      return this.depthLevels.MINIMAL;
    }
  }
  
  /**
   * Calculate comprehensive weight for a field
   */
  calculateFieldWeight(field) {
    let weight = 0;
    
    // Base weight from directive
    if (field.directives?.['@weight']) {
      weight = field.directives['@weight'].value || 0;
    }
    
    // Critical fields get automatic boost
    if (field.directives?.['@critical']) {
      weight += 50;
    }
    
    // Primary keys are always important
    if (field.isPrimaryKey()) {
      weight += 40;
    }
    
    // Foreign keys are important for integrity
    if (field.isForeignKey()) {
      weight += 30;
    }
    
    // Unique fields need validation
    if (field.isUnique()) {
      weight += 25;
    }
    
    // Indexed fields are query-critical
    if (field.isIndexed()) {
      weight += 20;
    }
    
    // Non-nullable fields are more critical
    if (field.nonNull) {
      weight += 15;
    }
    
    // Sensitive data needs extra testing
    if (field.directives?.['@sensitive'] || field.directives?.['@pii']) {
      weight += 30;
    }
    
    // Email fields need format validation
    if (field.directives?.['@email']) {
      weight += 20;
    }
    
    // Fields with defaults need default testing
    if (field.getDefault()) {
      weight += 15;
    }
    
    // Fields with validation rules
    if (field.directives?.['@min'] || field.directives?.['@max']) {
      weight += 20;
    }
    
    // Array fields need element testing
    if (field.list) {
      weight += 15;
      if (field.itemNonNull) {
        weight += 10; // Non-null items are harder to test
      }
    }
    
    // Cap at 100
    return Math.min(weight, 100);
  }
  
  /**
   * Generate tests based on depth level
   */
  generateFieldTests(field, tableName, depth) {
    const tests = [];
    const fieldName = field.name;
    
    // Always include basic tests
    tests.push(...this.generateMinimalTests(field, tableName));
    
    // Add more tests based on depth
    if (depth === this.depthLevels.STANDARD || 
        depth === this.depthLevels.COMPREHENSIVE || 
        depth === this.depthLevels.EXHAUSTIVE) {
      tests.push(...this.generateStandardTests(field, tableName));
    }
    
    if (depth === this.depthLevels.COMPREHENSIVE || 
        depth === this.depthLevels.EXHAUSTIVE) {
      tests.push(...this.generateComprehensiveTests(field, tableName));
    }
    
    if (depth === this.depthLevels.EXHAUSTIVE) {
      tests.push(...this.generateExhaustiveTests(field, tableName));
    }
    
    return tests;
  }
  
  /**
   * Minimal tests - just structure
   */
  generateMinimalTests(field, tableName) {
    const tests = [];
    const fieldName = field.name;
    
    // Column existence
    tests.push(
      `SELECT has_column('${tableName}', '${fieldName}', ` +
      `'Column ${tableName}.${fieldName} should exist');`
    );
    
    // Column type
    const sqlType = this.mapToSQLType(field);
    tests.push(
      `SELECT col_type_is('${tableName}', '${fieldName}', '${sqlType}', ` +
      `'${tableName}.${fieldName} should be type ${sqlType}');`
    );
    
    return tests;
  }
  
  /**
   * Standard tests - structure + constraints
   */
  generateStandardTests(field, tableName) {
    const tests = [];
    const fieldName = field.name;
    
    // Nullability
    if (field.nonNull) {
      tests.push(
        `SELECT col_not_null('${tableName}', '${fieldName}', ` +
        `'${tableName}.${fieldName} should not be nullable');`
      );
    }
    
    // Primary key
    if (field.isPrimaryKey()) {
      tests.push(
        `SELECT col_is_pk('${tableName}', '${fieldName}', ` +
        `'${tableName}.${fieldName} should be primary key');`
      );
    }
    
    // Unique constraint
    if (field.isUnique()) {
      tests.push(
        `SELECT col_is_unique('${tableName}', '${fieldName}', ` +
        `'${tableName}.${fieldName} should be unique');`
      );
    }
    
    // Foreign key
    if (field.isForeignKey()) {
      const ref = field.getForeignKeyRef();
      if (ref) {
        const [refTable, refCol] = ref.split('.');
        tests.push(
          `SELECT fk_ok('${tableName}', '${fieldName}', ` +
          `'${refTable}', '${refCol || 'id'}', ` +
          `'${tableName}.${fieldName} references ${refTable}');`
        );
      }
    }
    
    return tests;
  }
  
  /**
   * Comprehensive tests - constraints + behavior
   */
  generateComprehensiveTests(field, tableName) {
    const tests = [];
    const fieldName = field.name;
    
    // Default value test
    if (field.getDefault()) {
      const defaultValue = field.getDefault();
      tests.push(`-- Test default value for ${fieldName}`);
      tests.push(`DO $$`);
      tests.push(`DECLARE`);
      tests.push(`  v_id uuid := gen_random_uuid();`);
      tests.push(`  v_default text;`);
      tests.push(`BEGIN`);
      tests.push(`  INSERT INTO "${tableName}" (id) VALUES (v_id);`);
      tests.push(`  SELECT "${fieldName}"::text INTO v_default FROM "${tableName}" WHERE id = v_id;`);
      
      if (defaultValue.expr) {
        tests.push(`  PERFORM assert_equals(v_default, ${defaultValue.expr}::text, `);
        tests.push(`    '${fieldName} should have default value');`);
      }
      
      tests.push(`  DELETE FROM "${tableName}" WHERE id = v_id;`);
      tests.push(`END $$;`);
    }
    
    // Validation constraints
    if (field.directives?.['@min']) {
      const min = field.directives['@min'].value;
      tests.push(`-- Test minimum value constraint`);
      tests.push(`SELECT throws_ok(`);
      tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES (${min - 1})$$,`);
      tests.push(`  '23514',`);
      tests.push(`  'check constraint',`);
      tests.push(`  '${fieldName} should enforce minimum value ${min}'`);
      tests.push(`);`);
    }
    
    if (field.directives?.['@max']) {
      const max = field.directives['@max'].value;
      tests.push(`-- Test maximum value constraint`);
      tests.push(`SELECT throws_ok(`);
      tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES (${max + 1})$$,`);
      tests.push(`  '23514',`);
      tests.push(`  'check constraint',`);
      tests.push(`  '${fieldName} should enforce maximum value ${max}'`);
      tests.push(`);`);
    }
    
    // Email format validation
    if (field.directives?.['@email']) {
      tests.push(`-- Test email format validation`);
      tests.push(`SELECT throws_ok(`);
      tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES ('invalid-email')$$,`);
      tests.push(`  '23514',`);
      tests.push(`  'check constraint',`);
      tests.push(`  '${fieldName} should validate email format'`);
      tests.push(`);`);
      
      tests.push(`SELECT lives_ok(`);
      tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES ('valid@example.com')$$,`);
      tests.push(`  '${fieldName} should accept valid email'`);
      tests.push(`);`);
    }
    
    return tests;
  }
  
  /**
   * Exhaustive tests - everything including performance
   */
  generateExhaustiveTests(field, tableName) {
    const tests = [];
    const fieldName = field.name;
    
    // Index performance test
    if (field.isIndexed()) {
      tests.push(`-- Test index performance for ${fieldName}`);
      tests.push(`DO $$`);
      tests.push(`DECLARE`);
      tests.push(`  v_plan json;`);
      tests.push(`BEGIN`);
      tests.push(`  -- Get query plan`);
      tests.push(`  EXECUTE 'EXPLAIN (FORMAT JSON) SELECT * FROM "${tableName}" WHERE "${fieldName}" = $1'`);
      tests.push(`  INTO v_plan USING 'test-value';`);
      tests.push(`  `);
      tests.push(`  -- Verify index is used`);
      tests.push(`  PERFORM assert_true(`);
      tests.push(`    v_plan::text LIKE '%Index Scan%',`);
      tests.push(`    'Query on ${fieldName} should use index'`);
      tests.push(`  );`);
      tests.push(`END $$;`);
    }
    
    // Array element tests
    if (field.list) {
      tests.push(`-- Test array field ${fieldName}`);
      
      if (field.itemNonNull) {
        tests.push(`-- Test non-null array elements`);
        tests.push(`SELECT throws_ok(`);
        tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES (ARRAY[NULL]::${this.mapToSQLType(field)})$$,`);
        tests.push(`  '23514',`);
        tests.push(`  'check constraint',`);
        tests.push(`  '${fieldName} should not allow NULL elements'`);
        tests.push(`);`);
      }
      
      tests.push(`-- Test array operations`);
      tests.push(`SELECT lives_ok(`);
      tests.push(`  $$INSERT INTO "${tableName}" ("${fieldName}") VALUES (ARRAY[]::${this.mapToSQLType(field)})$$,`);
      tests.push(`  '${fieldName} should accept empty array'`);
      tests.push(`);`);
    }
    
    // Sensitive field masking
    if (field.directives?.['@sensitive']) {
      tests.push(`-- Test sensitive field protection`);
      tests.push(`-- Verify ${fieldName} is not exposed in logs`);
      tests.push(`-- This would check audit logs, error messages, etc.`);
    }
    
    // Concurrency tests for critical fields
    if (field.directives?.['@critical']) {
      tests.push(`-- Test concurrent access to ${fieldName}`);
      tests.push(`-- Would spawn multiple connections and test race conditions`);
    }
    
    return tests;
  }
  
  /**
   * Map field to SQL type
   */
  mapToSQLType(field) {
    const typeMap = {
      'ID': 'uuid',
      'String': 'text',
      'Int': 'integer',
      'Float': 'double precision',
      'Boolean': 'boolean',
      'DateTime': 'timestamptz',
      'Date': 'date',
      'Time': 'time',
      'Decimal': 'numeric',
      'UUID': 'uuid',
      'JSON': 'jsonb'
    };
    
    let sqlType = typeMap[field.type] || 'text';
    
    if (field.list) {
      sqlType += '[]';
    }
    
    return sqlType;
  }
  
  /**
   * Generate test summary comment
   */
  generateTestSummary(field, depth, weight) {
    const lines = [];
    
    lines.push(`-- Field: ${field.name}`);
    lines.push(`-- Weight: ${weight}/100`);
    lines.push(`-- Test Depth: ${depth.toUpperCase()}`);
    lines.push(`-- Attributes: ${this.getFieldAttributes(field).join(', ')}`);
    
    return lines.join('\n');
  }
  
  /**
   * Get human-readable field attributes
   */
  getFieldAttributes(field) {
    const attrs = [];
    
    if (field.isPrimaryKey()) attrs.push('PK');
    if (field.isForeignKey()) attrs.push('FK');
    if (field.isUnique()) attrs.push('UNIQUE');
    if (field.isIndexed()) attrs.push('INDEXED');
    if (field.nonNull) attrs.push('NOT NULL');
    if (field.list) attrs.push('ARRAY');
    if (field.directives?.['@critical']) attrs.push('CRITICAL');
    if (field.directives?.['@sensitive']) attrs.push('SENSITIVE');
    
    return attrs.length > 0 ? attrs : ['STANDARD'];
  }
}