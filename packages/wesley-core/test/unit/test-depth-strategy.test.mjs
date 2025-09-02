/**
 * Test Depth Strategy Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { TestDepthStrategy } from '../../src/domain/TestDepthStrategy.mjs';
import { Field } from '../../src/domain/Schema.mjs';

test('calculates field weights correctly', () => {
  const strategy = new TestDepthStrategy();
  
  // Primary key field - high weight
  const pkField = new Field({
    name: 'id',
    type: 'ID',
    nonNull: true,
    directives: { '@primaryKey': {} }
  });
  
  const pkWeight = strategy.calculateFieldWeight(pkField);
  assert(pkWeight >= 40, 'Primary key should have high weight');
  
  // Critical + sensitive field - very high weight
  const criticalField = new Field({
    name: 'password_hash',
    type: 'String',
    nonNull: true,
    directives: { 
      '@critical': {},
      '@sensitive': {}
    }
  });
  
  const criticalWeight = strategy.calculateFieldWeight(criticalField);
  assert(criticalWeight >= 80, 'Critical sensitive field should have very high weight');
  
  // Simple nullable field - low weight
  const simpleField = new Field({
    name: 'description',
    type: 'String',
    nonNull: false,
    directives: {}
  });
  
  const simpleWeight = strategy.calculateFieldWeight(simpleField);
  assert(simpleWeight < 30, 'Simple field should have low weight');
  
  // Foreign key with index - medium-high weight
  const fkField = new Field({
    name: 'user_id',
    type: 'ID',
    nonNull: true,
    directives: {
      '@foreignKey': { ref: 'User.id' },
      '@index': {}
    }
  });
  
  const fkWeight = strategy.calculateFieldWeight(fkField);
  assert(fkWeight >= 50 && fkWeight <= 70, 'FK with index should have medium-high weight');
});

test('determines correct test depth based on weight', () => {
  const strategy = new TestDepthStrategy({
    minimalThreshold: 20,
    standardThreshold: 50,
    comprehensiveThreshold: 80
  });
  
  // Low weight field
  const lowWeightField = { directives: {} };
  const lowDepth = strategy.getFieldTestDepth({
    ...lowWeightField,
    isPrimaryKey: () => false,
    isForeignKey: () => false,
    isUnique: () => false,
    isIndexed: () => false,
    getDefault: () => null
  });
  assert.equal(lowDepth, 'minimal');
  
  // Medium weight field (FK)
  const mediumWeightField = {
    directives: {},
    isPrimaryKey: () => false,
    isForeignKey: () => true,
    isUnique: () => false,
    isIndexed: () => true,
    getDefault: () => null,
    nonNull: true
  };
  const mediumDepth = strategy.getFieldTestDepth(mediumWeightField);
  assert.equal(mediumDepth, 'comprehensive');
  
  // High weight field (PK + Critical)
  const highWeightField = {
    directives: { '@critical': {} },
    isPrimaryKey: () => true,
    isForeignKey: () => false,
    isUnique: () => true,
    isIndexed: () => true,
    getDefault: () => null,
    nonNull: true
  };
  const highDepth = strategy.getFieldTestDepth(highWeightField);
  assert.equal(highDepth, 'exhaustive');
});

test('generates minimal tests for low-weight fields', () => {
  const strategy = new TestDepthStrategy();
  
  const field = new Field({
    name: 'notes',
    type: 'String',
    nonNull: false
  });
  
  const tests = strategy.generateMinimalTests(field, 'users');
  
  // Should only have existence and type tests
  assert(tests.some(t => t.includes('has_column')), 'Should test column existence');
  assert(tests.some(t => t.includes('col_type_is')), 'Should test column type');
  assert.equal(tests.length, 2, 'Minimal tests should only have 2 tests');
});

test('generates standard tests including constraints', () => {
  const strategy = new TestDepthStrategy();
  
  const field = new Field({
    name: 'email',
    type: 'String',
    nonNull: true,
    directives: {
      '@unique': {}
    }
  });
  
  const tests = strategy.generateStandardTests(field, 'users');
  
  assert(tests.some(t => t.includes('col_not_null')), 'Should test not null');
  assert(tests.some(t => t.includes('col_is_unique')), 'Should test unique constraint');
});

test('generates comprehensive tests including behavior', () => {
  const strategy = new TestDepthStrategy();
  
  const field = new Field({
    name: 'email',
    type: 'String',
    directives: {
      '@email': {},
      '@default': { value: 'noreply@example.com' }
    }
  });
  
  const tests = strategy.generateComprehensiveTests(field, 'users');
  
  // Should include email validation tests
  assert(tests.some(t => t.includes('email format validation')), 'Should test email format');
  assert(tests.some(t => t.includes('valid@example.com')), 'Should test valid email');
  assert(tests.some(t => t.includes('invalid-email')), 'Should test invalid email');
  
  // Should include default value test
  assert(tests.some(t => t.includes('default value')), 'Should test default value');
});

test('generates exhaustive tests including performance', () => {
  const strategy = new TestDepthStrategy();
  
  const field = new Field({
    name: 'tags',
    type: 'String',
    list: true,
    itemNonNull: true,
    directives: {
      '@index': {},
      '@critical': {}
    }
  });
  
  const tests = strategy.generateExhaustiveTests(field, 'posts');
  
  // Should include index performance test
  assert(tests.some(t => t.includes('index performance')), 'Should test index performance');
  assert(tests.some(t => t.includes('Index Scan')), 'Should verify index usage');
  
  // Should include array element tests
  assert(tests.some(t => t.includes('array field')), 'Should test array field');
  assert(tests.some(t => t.includes('NULL elements')), 'Should test non-null array elements');
  
  // Should include concurrency tests for critical fields
  assert(tests.some(t => t.includes('concurrent access')), 'Should test concurrent access');
});

test('generates appropriate test summary', () => {
  const strategy = new TestDepthStrategy();
  
  const field = new Field({
    name: 'user_id',
    type: 'ID',
    nonNull: true,
    directives: {
      '@foreignKey': { ref: 'User.id' },
      '@index': {},
      '@critical': {}
    }
  });
  
  const weight = strategy.calculateFieldWeight(field);
  const depth = strategy.getFieldTestDepth(field);
  const summary = strategy.generateTestSummary(field, depth, weight);
  
  assert(summary.includes('Field: user_id'), 'Should include field name');
  assert(summary.includes('Weight:'), 'Should include weight');
  assert(summary.includes('Test Depth:'), 'Should include depth level');
  assert(summary.includes('FK'), 'Should list FK attribute');
  assert(summary.includes('INDEXED'), 'Should list INDEXED attribute');
  assert(summary.includes('CRITICAL'), 'Should list CRITICAL attribute');
});

test('respects custom thresholds', () => {
  const strategy = new TestDepthStrategy({
    minimalThreshold: 10,
    standardThreshold: 30,
    comprehensiveThreshold: 60
  });
  
  // Field with weight around 40
  const field = {
    directives: {},
    isPrimaryKey: () => true, // +40 weight
    isForeignKey: () => false,
    isUnique: () => false,
    isIndexed: () => false,
    getDefault: () => null,
    nonNull: false
  };
  
  const depth = strategy.getFieldTestDepth(field);
  assert.equal(depth, 'comprehensive', 'Should use custom threshold (40 > 30 but < 60)');
});

test('caps weight at 100', () => {
  const strategy = new TestDepthStrategy();
  
  // Field with all the things
  const overloadedField = new Field({
    name: 'super_field',
    type: 'String',
    nonNull: true,
    list: true,
    itemNonNull: true,
    directives: {
      '@primaryKey': {},
      '@unique': {},
      '@index': {},
      '@critical': {},
      '@sensitive': {},
      '@email': {},
      '@min': { value: 1 },
      '@max': { value: 100 },
      '@weight': { value: 100 }
    }
  });
  
  const weight = strategy.calculateFieldWeight(overloadedField);
  assert.equal(weight, 100, 'Weight should be capped at 100');
});