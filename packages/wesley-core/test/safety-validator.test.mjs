/**
 * Safety Validator Tests
 * Tests for pre-execution safety checks, concurrent operations, and validation
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  SafetyValidator, 
  ValidationContext,
  ValidationResult,
  SafetyValidationError,
  ConcurrentOperationError,
  ResourceLimitExceededError,
  PermissionDeniedError,
  DependencyValidationError,
  safetyValidator 
} from '../src/domain/validation/SafetyValidator.mjs';

test('SafetyValidator can be constructed with default options', () => {
  const validator = new SafetyValidator();
  
  assert.equal(validator.options.enableConcurrentOperationCheck, true);
  assert.equal(validator.options.enableResourceLimitCheck, true);
  assert.equal(validator.options.enablePermissionCheck, true);
  assert.equal(validator.options.enableDependencyValidation, true);
  assert.equal(validator.options.strictMode, false);
  assert.equal(validator.options.maxConcurrentOperations, 3);
});

test('SafetyValidator can be constructed with custom options', () => {
  const validator = new SafetyValidator({
    enableConcurrentOperationCheck: false,
    strictMode: true,
    maxConcurrentOperations: 5,
    resourceLimits: { maxMemory: 4 * 1024 * 1024 * 1024 }
  });
  
  assert.equal(validator.options.enableConcurrentOperationCheck, false);
  assert.equal(validator.options.strictMode, true);
  assert.equal(validator.options.maxConcurrentOperations, 5);
  assert.equal(validator.options.resourceLimits.maxMemory, 4 * 1024 * 1024 * 1024);
});

test('ValidationContext initializes correctly', () => {
  const context = new ValidationContext('schema_migration', {
    userId: 'user123',
    permissions: ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
    resources: { maxMemory: 1000000 },
    dependencies: [{ name: 'table_users', type: 'table' }]
  });
  
  assert.equal(context.operationType, 'schema_migration');
  assert.equal(context.userId, 'user123');
  assert.deepEqual(context.permissions, ['SCHEMA_MODIFY', 'DDL_EXECUTE']);
  assert.equal(context.resources.maxMemory, 1000000);
  assert.equal(context.dependencies.length, 1);
  assert(typeof context.sessionId === 'string');
  assert(typeof context.timestamp === 'number');
});

test('ValidationContext generates session ID when not provided', () => {
  const context = new ValidationContext('test_operation');
  
  assert(typeof context.sessionId === 'string');
  assert(context.sessionId.startsWith('session_'));
});

test('ValidationContext toJSON serializes correctly', () => {
  const context = new ValidationContext('test_operation', {
    userId: 'user123'
  });
  
  const json = context.toJSON();
  
  assert.equal(json.operationType, 'test_operation');
  assert.equal(json.userId, 'user123');
  assert(typeof json.timestamp === 'number');
  assert(typeof json.sessionId === 'string');
});

test('ValidationResult tracks checks and results', () => {
  const result = new ValidationResult();
  
  assert.equal(result.overall, 'pending');
  assert.equal(result.warnings.length, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(result.recommendations.length, 0);
  
  result.addCheck('permissions', { passed: true });
  result.addWarning({ type: 'resource_warning', message: 'High CPU usage' });
  result.addError({ type: 'permission_error', message: 'Access denied' });
  result.addRecommendation({ type: 'optimization', message: 'Consider using index' });
  result.setOverall('passed_with_warnings');
  
  assert.equal(result.checks.permissions.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.overall, 'passed_with_warnings');
  assert.equal(result.isValid(), false); // has errors
  assert.equal(result.hasWarnings(), true);
  assert.equal(result.hasErrors(), true);
});

test('ValidationResult toJSON serializes correctly', () => {
  const result = new ValidationResult();
  result.addWarning({ type: 'test_warning', message: 'Test warning' });
  result.setOverall('passed_with_warnings');
  
  const json = result.toJSON();
  
  assert.equal(json.overall, 'passed_with_warnings');
  assert.equal(json.warnings.length, 1);
  assert(typeof json.timestamp === 'number');
});

test('validateSafety performs comprehensive validation', async () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('schema_migration', {
    userId: 'user123',
    permissions: ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
    resources: { maxMemory: 100000, maxCpu: 20 },
    dependencies: []
  });
  
  const result = await validator.validateSafety(context);
  
  assert(result instanceof ValidationResult);
  assert(['passed', 'passed_with_warnings', 'failed'].includes(result.overall));
  assert(result.checks.concurrentOperations);
  assert(result.checks.resourceLimits);
  assert(result.checks.permissions);
  assert(result.checks.dependencies);
});

test('validateSafety emits events correctly', async () => {
  const validator = new SafetyValidator();
  const events = [];
  
  validator.on('SAFETY_VALIDATION_STARTED', (event) => events.push(event.type));
  validator.on('SAFETY_VALIDATION_COMPLETED', (event) => events.push(event.type));
  
  const context = new ValidationContext('test_operation');
  await validator.validateSafety(context);
  
  assert.equal(events.length, 2);
  assert.equal(events[0], 'SAFETY_VALIDATION_STARTED');
  assert.equal(events[1], 'SAFETY_VALIDATION_COMPLETED');
});

test('validateSafety throws in strict mode on failure', async () => {
  const validator = new SafetyValidator({ 
    strictMode: true,
    resourceLimits: { maxMemory: 100 } // Very low limit
  });
  
  const context = new ValidationContext('test_operation', {
    resources: { maxMemory: 200 } // Exceeds limit
  });
  
  await assert.rejects(
    async () => {
      await validator.validateSafety(context);
    },
    SafetyValidationError
  );
});

test('checkConcurrentOperations allows operations under limit', async () => {
  const validator = new SafetyValidator({ maxConcurrentOperations: 3 });
  
  const context = new ValidationContext('schema_migration');
  
  const result = await validator.checkConcurrentOperations(context);
  
  assert.equal(result.passed, true);
  assert.equal(result.activeOperations, 0);
  assert.equal(result.conflicts.length, 0);
  
  // Should register the operation
  assert.equal(validator.activeOperations.size, 1);
});

test('checkConcurrentOperations detects max operations exceeded', async () => {
  const validator = new SafetyValidator({ maxConcurrentOperations: 2 });
  
  // Fill up the operation slots
  validator.activeOperations.set('op1', { operationType: 'test1', timestamp: Date.now() });
  validator.activeOperations.set('op2', { operationType: 'test2', timestamp: Date.now() });
  
  const context = new ValidationContext('schema_migration');
  
  const result = await validator.checkConcurrentOperations(context);
  
  assert.equal(result.passed, false);
  assert.equal(result.activeOperations, 2);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].type, 'max_operations_exceeded');
});

test('checkConcurrentOperations detects operation conflicts', async () => {
  const validator = new SafetyValidator();
  
  // Add conflicting operation
  validator.activeOperations.set('conflicting_op', { 
    operationType: 'schema_migration',
    timestamp: Date.now(),
    sessionId: 'conflicting_op'
  });
  
  const context = new ValidationContext('schema_migration');
  
  const result = await validator.checkConcurrentOperations(context);
  
  assert.equal(result.passed, false);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].type, 'operation_conflict');
  assert.equal(result.conflicts[0].conflictsWith, 'schema_migration');
});

test('checkConcurrentOperations throws in strict mode', async () => {
  const validator = new SafetyValidator({ strictMode: true, maxConcurrentOperations: 1 });
  
  validator.activeOperations.set('existing_op', { 
    operationType: 'schema_migration', 
    sessionId: 'existing_op',
    timestamp: Date.now() 
  });
  
  const context = new ValidationContext('schema_migration'); // Same type = conflict
  
  await assert.rejects(
    async () => {
      await validator.checkConcurrentOperations(context);
    },
    ConcurrentOperationError
  );
});

test('checkResourceLimits passes with adequate resources', async () => {
  const validator = new SafetyValidator({
    resourceLimits: { maxMemory: 2000000, maxCpu: 80 }
  });
  
  // Mock getCurrentResourceUsage to return low usage
  validator.getCurrentResourceUsage = async () => ({
    maxMemory: 500000, // Current usage
    maxCpu: 20
  });
  
  const context = new ValidationContext('test_operation', {
    resources: { maxMemory: 500000, maxCpu: 40 } // Requested
  });
  
  const result = await validator.checkResourceLimits(context);
  
  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
  assert(typeof result.currentUsage === 'object');
});

test('checkResourceLimits detects resource limit violations', async () => {
  const validator = new SafetyValidator({
    resourceLimits: { maxMemory: 1000000, maxCpu: 80 }
  });
  
  const context = new ValidationContext('test_operation', {
    resources: { maxMemory: 2000000 } // Exceeds limit
  });
  
  const result = await validator.checkResourceLimits(context);
  
  assert.equal(result.passed, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].resource, 'maxMemory');
  assert.equal(result.violations[0].requested, 2000000);
  assert.equal(result.violations[0].limit, 1000000);
});

test('checkResourceLimits emits warnings for high usage', async () => {
  const validator = new SafetyValidator({
    resourceLimits: { maxMemory: 1000000 },
    warningThresholds: { maxMemory: 80 } // Match resource name exactly
  });
  
  // Mock getCurrentResourceUsage to return low current usage
  validator.getCurrentResourceUsage = async () => ({
    maxMemory: 100000 // Low current usage
  });
  
  let warningEvent = null;
  validator.on('RESOURCE_LIMIT_WARNING', (event) => {
    warningEvent = event;
  });
  
  const context = new ValidationContext('test_operation', {
    resources: { maxMemory: 850000 } // High requested usage: 950k total = 95% of 1000k limit
  });
  
  const result = await validator.checkResourceLimits(context);
  
  assert.equal(result.warnings.length, 1);
  assert(warningEvent);
  assert.equal(warningEvent.type, 'RESOURCE_LIMIT_WARNING');
});

test('checkResourceLimits throws in strict mode', async () => {
  const validator = new SafetyValidator({
    strictMode: true,
    resourceLimits: { maxMemory: 1000000 }
  });
  
  const context = new ValidationContext('test_operation', {
    resources: { maxMemory: 2000000 }
  });
  
  await assert.rejects(
    async () => {
      await validator.checkResourceLimits(context);
    },
    ResourceLimitExceededError
  );
});

test('checkPermissions passes with adequate permissions', async () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('schema_migration', {
    permissions: ['SCHEMA_MODIFY', 'DDL_EXECUTE']
  });
  
  const result = await validator.checkPermissions(context);
  
  assert.equal(result.passed, true);
  assert.equal(result.missingPermissions.length, 0);
  assert(result.requiredPermissions.length > 0);
});

test('checkPermissions detects missing permissions', async () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('schema_migration', {
    permissions: ['DDL_EXECUTE'] // Missing SCHEMA_MODIFY
  });
  
  const result = await validator.checkPermissions(context);
  
  assert.equal(result.passed, false);
  assert(result.missingPermissions.includes('SCHEMA_MODIFY'));
});

test('checkPermissions allows ADMIN permission for everything', async () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('drop_table', {
    permissions: ['ADMIN']
  });
  
  const result = await validator.checkPermissions(context);
  
  assert.equal(result.passed, true);
  assert.equal(result.missingPermissions.length, 0);
});

test('checkPermissions throws in strict mode', async () => {
  const validator = new SafetyValidator({ strictMode: true });
  
  const context = new ValidationContext('schema_migration', {
    permissions: [] // No permissions
  });
  
  await assert.rejects(
    async () => {
      await validator.checkPermissions(context);
    },
    PermissionDeniedError
  );
});

test('checkPermissions emits completion events', async () => {
  const validator = new SafetyValidator();
  let completionEvent = null;
  
  validator.on('PERMISSION_CHECK_COMPLETED', (event) => {
    completionEvent = event;
  });
  
  const context = new ValidationContext('test_operation', {
    permissions: ['ADMIN']
  });
  
  await validator.checkPermissions(context);
  
  assert(completionEvent);
  assert.equal(completionEvent.type, 'PERMISSION_CHECK_COMPLETED');
});

test('validateDependencyChain passes with valid dependencies', async () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('test_operation', {
    dependencies: [
      { name: 'table_users', type: 'table' },
      { name: 'index_users_email', type: 'index' }
    ]
  });
  
  const result = await validator.validateDependencyChain(context);
  
  assert.equal(result.passed, true);
  assert.equal(result.issues.length, 0);
});

test('validateDependencyChain emits validation events', async () => {
  const validator = new SafetyValidator();
  let validationEvent = null;
  
  validator.on('DEPENDENCY_CHAIN_VALIDATED', (event) => {
    validationEvent = event;
  });
  
  const context = new ValidationContext('test_operation', {
    dependencies: []
  });
  
  await validator.validateDependencyChain(context);
  
  assert(validationEvent);
  assert.equal(validationEvent.type, 'DEPENDENCY_CHAIN_VALIDATED');
});

test('findOperationConflicts detects conflicting operations', () => {
  const validator = new SafetyValidator();
  
  const activeOperations = [
    { operationType: 'schema_migration', sessionId: 'op1', timestamp: Date.now() },
    { operationType: 'create_index', sessionId: 'op2', timestamp: Date.now() }
  ];
  
  const conflicts = validator.findOperationConflicts('drop_table', activeOperations);
  
  // drop_table conflicts with both schema_migration and create_index according to conflict matrix
  assert.equal(conflicts.length, 2);
  assert.equal(conflicts[0].type, 'operation_conflict');
  assert.equal(conflicts[1].type, 'operation_conflict');
});

test('findOperationConflicts returns empty for non-conflicting operations', () => {
  const validator = new SafetyValidator();
  
  const activeOperations = [
    { operationType: 'read_data', sessionId: 'op1', timestamp: Date.now() }
  ];
  
  const conflicts = validator.findOperationConflicts('bulk_insert', activeOperations);
  
  assert.equal(conflicts.length, 0);
});

test('getOperationConflictMatrix returns conflict mappings', () => {
  const validator = new SafetyValidator();
  
  const matrix = validator.getOperationConflictMatrix();
  
  assert(Array.isArray(matrix.schema_migration));
  assert(matrix.schema_migration.includes('drop_table'));
  assert(matrix.drop_table.includes('schema_migration'));
});

test('registerOperation adds to active operations', () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('test_operation', {
    userId: 'user123'
  });
  
  const sessionId = validator.registerOperation(context);
  
  assert.equal(sessionId, context.sessionId);
  assert.equal(validator.activeOperations.size, 1);
  assert(validator.activeOperations.has(context.sessionId));
  
  const registered = validator.activeOperations.get(context.sessionId);
  assert.equal(registered.operationType, 'test_operation');
  assert.equal(registered.userId, 'user123');
});

test('unregisterOperation removes from active operations', () => {
  const validator = new SafetyValidator();
  
  const context = new ValidationContext('test_operation');
  const sessionId = validator.registerOperation(context);
  
  assert.equal(validator.activeOperations.size, 1);
  
  const removed = validator.unregisterOperation(sessionId);
  
  assert.equal(removed, true);
  assert.equal(validator.activeOperations.size, 0);
});

test('getRequiredPermissions maps operations correctly', () => {
  const validator = new SafetyValidator();
  
  const schemaMigrationPerms = validator.getRequiredPermissions('schema_migration');
  assert(schemaMigrationPerms.includes('SCHEMA_MODIFY'));
  assert(schemaMigrationPerms.includes('DDL_EXECUTE'));
  
  const dropTablePerms = validator.getRequiredPermissions('drop_table');
  assert(dropTablePerms.includes('DROP_OBJECTS'));
  
  const unknownPerms = validator.getRequiredPermissions('unknown_operation');
  assert.equal(unknownPerms.length, 0);
});

test('hasPermission checks permissions correctly', () => {
  const validator = new SafetyValidator();
  
  assert.equal(validator.hasPermission(['SCHEMA_MODIFY'], 'SCHEMA_MODIFY'), true);
  assert.equal(validator.hasPermission(['ADMIN'], 'SCHEMA_MODIFY'), true);
  assert.equal(validator.hasPermission(['DDL_EXECUTE'], 'SCHEMA_MODIFY'), false);
  assert.equal(validator.hasPermission([], 'SCHEMA_MODIFY'), false);
});

test('reset clears all validator state', () => {
  const validator = new SafetyValidator();
  
  // Add some state
  validator.activeOperations.set('op1', { operationType: 'test' });
  validator.resourceUsage.set('memory', 1000);
  validator.permissionCache.set('user1', ['ADMIN']);
  validator.dependencyGraph.set('dep1', []);
  
  assert.equal(validator.activeOperations.size, 1);
  assert.equal(validator.resourceUsage.size, 1);
  assert.equal(validator.permissionCache.size, 1);
  assert.equal(validator.dependencyGraph.size, 1);
  
  validator.reset();
  
  assert.equal(validator.activeOperations.size, 0);
  assert.equal(validator.resourceUsage.size, 0);
  assert.equal(validator.permissionCache.size, 0);
  assert.equal(validator.dependencyGraph.size, 0);
});

test('singleton instance is available', () => {
  assert(safetyValidator instanceof SafetyValidator);
  assert.equal(safetyValidator.options.maxConcurrentOperations, 3);
});

test('custom error types have correct properties', () => {
  const concurrentError = new ConcurrentOperationError('schema_migration', ['conflict1'], { context: 'test' });
  assert.equal(concurrentError.name, 'SafetyValidationError');
  assert.equal(concurrentError.code, 'CONCURRENT_OPERATION_CONFLICT');
  assert.equal(concurrentError.details.operation, 'schema_migration');
  assert.deepEqual(concurrentError.details.conflicts, ['conflict1']);
  
  const resourceError = new ResourceLimitExceededError('memory', 1000, 2000, { table: 'users' });
  assert.equal(resourceError.name, 'SafetyValidationError');
  assert.equal(resourceError.code, 'RESOURCE_LIMIT_EXCEEDED');
  assert.equal(resourceError.details.resource, 'memory');
  assert.equal(resourceError.details.limit, 1000);
  assert.equal(resourceError.details.requested, 2000);
  
  const permissionError = new PermissionDeniedError('drop_table', ['DROP_OBJECTS'], ['DDL_EXECUTE'], { user: 'user1' });
  assert.equal(permissionError.name, 'SafetyValidationError');
  assert.equal(permissionError.code, 'PERMISSION_DENIED');
  assert.equal(permissionError.details.operation, 'drop_table');
  assert.deepEqual(permissionError.details.requiredPermissions, ['DROP_OBJECTS']);
  
  const dependencyError = new DependencyValidationError('table_users', ['missing'], { context: 'test' });
  assert.equal(dependencyError.name, 'SafetyValidationError');
  assert.equal(dependencyError.code, 'DEPENDENCY_VALIDATION_FAILED');
  assert.equal(dependencyError.details.dependency, 'table_users');
  assert.deepEqual(dependencyError.details.issues, ['missing']);
});

test('event system works correctly', async () => {
  const validator = new SafetyValidator();
  const events = [];
  
  validator.on('SAFETY_VALIDATION_STARTED', (event) => events.push(event.type));
  validator.on('CONCURRENT_OPERATION_DETECTED', (event) => events.push(event.type));
  validator.on('RESOURCE_LIMIT_WARNING', (event) => events.push(event.type));
  
  // Add conflicting operation to trigger event
  validator.activeOperations.set('conflicting', { 
    operationType: 'schema_migration', 
    sessionId: 'conflicting',
    timestamp: Date.now()
  });
  
  const context = new ValidationContext('schema_migration', {
    permissions: ['ADMIN'],
    resources: { maxMemory: 850000 } // High usage to trigger warning
  });
  
  // Override resource limits to trigger warning
  validator.options.resourceLimits.maxMemory = 1000000;
  validator.options.warningThresholds.maxMemory = 80;
  
  // Mock getCurrentResourceUsage to ensure low current usage
  validator.getCurrentResourceUsage = async () => ({
    maxMemory: 100000
  });
  
  await validator.validateSafety(context);
  
  assert(events.includes('SAFETY_VALIDATION_STARTED'));
  assert(events.includes('CONCURRENT_OPERATION_DETECTED'));
});

test('integration test with comprehensive validation', async () => {
  const validator = new SafetyValidator({
    maxConcurrentOperations: 2,
    resourceLimits: { maxMemory: 2000000, maxCpu: 80 },
    warningThresholds: { maxMemory: 70 }
  });
  
  // Mock getCurrentResourceUsage to return low usage
  validator.getCurrentResourceUsage = async () => ({
    maxMemory: 100000, // Low current usage
    maxCpu: 10
  });
  
  const events = [];
  validator.on('SAFETY_VALIDATION_STARTED', () => events.push('started'));
  validator.on('SAFETY_VALIDATION_COMPLETED', () => events.push('completed'));
  validator.on('RESOURCE_LIMIT_WARNING', () => events.push('warning'));
  
  const context = new ValidationContext('schema_migration', {
    userId: 'user123',
    permissions: ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
    resources: { maxMemory: 1500000, maxCpu: 40 }, // Triggers memory warning (80% total usage)
    dependencies: [{ name: 'table_users', type: 'table' }]
  });
  
  const result = await validator.validateSafety(context);
  
  assert(['passed', 'passed_with_warnings'].includes(result.overall));
  assert.equal(result.errors.length, 0);
  assert(result.checks.concurrentOperations.passed);
  assert(result.checks.resourceLimits.passed);
  assert(result.checks.permissions.passed);
  assert(result.checks.dependencies.passed);
  
  assert(events.includes('started'));
  assert(events.includes('completed'));
  
  // Operation should be registered
  assert.equal(validator.activeOperations.size, 1);
  
  // Clean up
  validator.unregisterOperation(context.sessionId);
});