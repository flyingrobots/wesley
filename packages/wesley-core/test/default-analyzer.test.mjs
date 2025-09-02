/**
 * DefaultAnalyzer Tests
 * Tests for WP2.T004 instant column default detection
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { DefaultAnalyzer } from '../src/domain/analyzer/DefaultAnalyzer.mjs';

// Mock database connection for testing
class MockDatabaseConnection {
  constructor(options = {}) {
    this.version = options.version || 'PostgreSQL 13.1';
    this.supportsAttHasMissing = options.supportsAttHasMissing ?? true;
    this.mockOptimizedColumns = options.optimizedColumns || [];
  }

  async query(sql, params = []) {
    if (sql.includes('SELECT version()')) {
      return { rows: [{ version: this.version }] };
    }

    if (sql.includes('atthasmissing')) {
      if (sql.includes('information_schema.columns')) {
        // Check for atthasmissing column existence
        return { rows: this.supportsAttHasMissing ? [{ 1: 1 }] : [] };
      } else {
        // Check specific column optimization
        const [tableName, columnName] = params;
        const isOptimized = this.mockOptimizedColumns.some(col => 
          col.table === tableName && col.column === columnName
        );
        return { 
          rows: isOptimized ? [{ atthasmissing: true, attmissingval: 'test' }] : []
        };
      }
    }

    return { rows: [] };
  }
}

test('detects PostgreSQL version correctly', async () => {
  const db = new MockDatabaseConnection({ version: 'PostgreSQL 13.1' });
  const analyzer = new DefaultAnalyzer(db);
  
  const versionInfo = await analyzer.getPostgreSQLVersionInfo();
  
  assert.equal(versionInfo.version, '13.1');
  assert.equal(versionInfo.supportsInstantDefaults, true);
});

test('handles older PostgreSQL versions', async () => {
  const db = new MockDatabaseConnection({ 
    version: 'PostgreSQL 10.5',
    supportsAttHasMissing: false 
  });
  const analyzer = new DefaultAnalyzer(db);
  
  const versionInfo = await analyzer.getPostgreSQLVersionInfo();
  
  assert.equal(versionInfo.version, '10.5');
  assert.equal(versionInfo.supportsInstantDefaults, false);
});

test('categorizes constant defaults correctly', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  // Test string literal
  const stringDefault = analyzer.categorizeDefault("'default_value'", 'text');
  assert.equal(stringDefault.isConstant, true);
  assert.equal(stringDefault.isVolatile, false);
  assert.equal(stringDefault.isLiteral, true);

  // Test numeric literal
  const numericDefault = analyzer.categorizeDefault('42', 'integer');
  assert.equal(numericDefault.isConstant, true);
  assert.equal(numericDefault.isVolatile, false);

  // Test boolean literal
  const boolDefault = analyzer.categorizeDefault('true', 'boolean');
  assert.equal(boolDefault.isConstant, true);
  assert.equal(boolDefault.isVolatile, false);

  // Test array literal
  const arrayDefault = analyzer.categorizeDefault("ARRAY['a', 'b', 'c']", 'text[]');
  assert.equal(arrayDefault.isConstant, true);
  assert.equal(arrayDefault.isVolatile, false);
});

test('categorizes volatile defaults correctly', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  // Test timestamp functions
  const nowDefault = analyzer.categorizeDefault('now()', 'timestamptz');
  assert.equal(nowDefault.isConstant, false);
  assert.equal(nowDefault.isVolatile, true);
  assert.deepEqual(nowDefault.volatileFunctions, ['now()']);

  const currentTimestamp = analyzer.categorizeDefault('CURRENT_TIMESTAMP', 'timestamptz');
  assert.equal(currentTimestamp.isVolatile, true);

  // Test UUID generation
  const uuidDefault = analyzer.categorizeDefault('gen_random_uuid()', 'uuid');
  assert.equal(uuidDefault.isVolatile, true);
  assert.deepEqual(uuidDefault.volatileFunctions, ['gen_random_uuid()']);

  // Test sequence functions
  const nextvalDefault = analyzer.categorizeDefault("nextval('seq_name')", 'integer');
  assert.equal(nextvalDefault.isVolatile, true);
  assert.deepEqual(nextvalDefault.volatileFunctions, ['nextval(']);

  // Test random function
  const randomDefault = analyzer.categorizeDefault('random() * 100', 'numeric');
  assert.equal(randomDefault.isVolatile, true);
  assert.deepEqual(randomDefault.volatileFunctions, ['random()']);
});

test('analyzes column defaults for instant optimization', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  const columnInfo = {
    table_name: 'users',
    column_name: 'status',
    default_value: "'active'",
    data_type: 'text'
  };

  const analysis = await analyzer.analyzeDefault(columnInfo);
  
  assert.equal(analysis.hasDefault, true);
  assert.equal(analysis.isConstant, true);
  assert.equal(analysis.isVolatile, false);
  assert.equal(analysis.isInstant, true);
  assert.equal(analysis.supportsInstantDefaults, true);
  assert.equal(analysis.recommendation, 'instant-default-recommended');
  assert.equal(analysis.optimizationPotential.potential, 'high');
});

test('handles volatile defaults properly', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  const columnInfo = {
    table_name: 'users',
    column_name: 'created_at',
    default_value: 'now()',
    data_type: 'timestamptz'
  };

  const analysis = await analyzer.analyzeDefault(columnInfo);
  
  assert.equal(analysis.hasDefault, true);
  assert.equal(analysis.isConstant, false);
  assert.equal(analysis.isVolatile, true);
  assert.equal(analysis.isInstant, false);
  assert.equal(analysis.recommendation, 'volatile-default-no-optimization');
  assert.equal(analysis.optimizationPotential.potential, 'none');
  assert.equal(analysis.optimizationPotential.reason, 'Volatile default values cannot use instant optimization');
});

test('detects already optimized columns', async () => {
  const db = new MockDatabaseConnection({
    optimizedColumns: [{ table: 'users', column: 'status' }]
  });
  const analyzer = new DefaultAnalyzer(db);
  
  const columnInfo = {
    table_name: 'users',
    column_name: 'status',
    default_value: "'active'",
    data_type: 'text'
  };

  const analysis = await analyzer.analyzeDefault(columnInfo);
  
  assert.equal(analysis.hasMissingOptimization, true);
  assert.equal(analysis.recommendation, 'already-optimized');
  assert.equal(analysis.optimizationPotential.potential, 'none');
  assert.equal(analysis.optimizationPotential.reason, 'Already optimized with instant defaults');
});

test('handles old PostgreSQL versions gracefully', async () => {
  const db = new MockDatabaseConnection({ 
    version: 'PostgreSQL 9.6',
    supportsAttHasMissing: false 
  });
  const analyzer = new DefaultAnalyzer(db);
  
  const columnInfo = {
    table_name: 'users',
    column_name: 'status',
    default_value: "'active'",
    data_type: 'text'
  };

  const analysis = await analyzer.analyzeDefault(columnInfo);
  
  assert.equal(analysis.isConstant, true);
  assert.equal(analysis.isInstant, false);
  assert.equal(analysis.supportsInstantDefaults, false);
  assert.equal(analysis.recommendation, 'constant-default-pg-version-too-old');
  assert.equal(analysis.optimizationPotential.potential, 'none');
  assert.ok(analysis.optimizationPotential.upgradeRecommendation.includes('PostgreSQL 11+'));
});

test('analyzes batch of columns', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  const columns = [
    { table_name: 'users', column_name: 'status', default_value: "'active'", data_type: 'text' },
    { table_name: 'users', column_name: 'created_at', default_value: 'now()', data_type: 'timestamptz' },
    { table_name: 'users', column_name: 'count', default_value: '0', data_type: 'integer' },
    { table_name: 'users', column_name: 'id', default_value: 'gen_random_uuid()', data_type: 'uuid' }
  ];

  const batchAnalysis = await analyzer.analyzeBatch(columns);
  
  assert.equal(batchAnalysis.totalColumns, 4);
  assert.equal(batchAnalysis.constantDefaults, 2); // 'active' and '0'
  assert.equal(batchAnalysis.volatileDefaults, 2); // now() and gen_random_uuid()
  assert.equal(batchAnalysis.instantOptimizable, 2); // 'active' and '0'
  assert.equal(batchAnalysis.alreadyOptimized, 0);
  assert.equal(batchAnalysis.details.length, 4);
});

test('generates optimal column SQL for instant defaults', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  const result = await analyzer.generateOptimalColumnSQL(
    'users', 'status', 'text', "'active'"
  );
  
  assert.equal(result.strategy, 'instant-default');
  assert.ok(result.sql.includes('ALTER TABLE "users" ADD COLUMN "status" text DEFAULT \'active\';'));
  assert.equal(result.warnings.length, 0);
  assert.equal(result.estimatedSpeedupFactor, 100);
});

test('generates three-step SQL for volatile defaults', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  const result = await analyzer.generateOptimalColumnSQL(
    'users', 'created_at', 'timestamptz', 'now()'
  );
  
  assert.equal(result.strategy, 'three-step-volatile');
  assert.ok(result.sql.includes('ADD COLUMN "created_at" timestamptz;'));
  assert.ok(result.sql.includes('SET DEFAULT now()'));
  assert.ok(result.sql.includes('UPDATE "users" SET'));
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes('batch processing'));
});

test('generates traditional SQL for old PostgreSQL', async () => {
  const db = new MockDatabaseConnection({ 
    version: 'PostgreSQL 10.5',
    supportsAttHasMissing: false 
  });
  const analyzer = new DefaultAnalyzer(db);
  
  const result = await analyzer.generateOptimalColumnSQL(
    'users', 'status', 'text', "'active'"
  );
  
  assert.equal(result.strategy, 'traditional-constant');
  assert.ok(result.sql.includes('ALTER TABLE "users" ADD COLUMN "status" text DEFAULT \'active\';'));
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes('table rewrite'));
  assert.ok(result.warnings[0].includes('upgrading to 11+'));
});

test('handles database connection errors gracefully', async () => {
  const errorDb = {
    async query() {
      throw new Error('Connection failed');
    }
  };
  
  const analyzer = new DefaultAnalyzer(errorDb);
  const versionInfo = await analyzer.getPostgreSQLVersionInfo();
  
  assert.equal(versionInfo.version, 'unknown');
  assert.equal(versionInfo.supportsInstantDefaults, false);
});

test('validates complex default expressions', async () => {
  const db = new MockDatabaseConnection();
  const analyzer = new DefaultAnalyzer(db);
  
  // Test JSON default (with cast it's not recognized as literal)
  const jsonDefault = analyzer.categorizeDefault("'{}'::jsonb", 'jsonb');
  assert.equal(jsonDefault.isVolatile, false);

  // Test array with null check
  const arrayDefault = analyzer.categorizeDefault("ARRAY[]::integer[]", 'integer[]');
  assert.equal(arrayDefault.isConstant, true);

  // Test computed expression with functions - CASE statements are not simple literals
  const computedDefault = analyzer.categorizeDefault("CASE WHEN true THEN 'default' ELSE 'other' END", 'text');
  assert.equal(computedDefault.isVolatile, false); // Not volatile, but not a simple literal either

  // Test expression with volatile function
  const mixedDefault = analyzer.categorizeDefault("CASE WHEN random() > 0.5 THEN 'a' ELSE 'b' END", 'text');
  assert.equal(mixedDefault.isVolatile, true);
  assert.deepEqual(mixedDefault.volatileFunctions, ['random()']);
});