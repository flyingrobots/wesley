/**
 * Safety Validator - Pre-Execution Safety Checks
 * Performs comprehensive pre-execution validation including concurrent operation
 * detection, resource limit validation, permission verification, and dependency validation.
 * 
 * Licensed under the Apache License, Version 2.0
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for safety validation
 */
export class SafetyValidationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SafetyValidationError';
    this.code = code;
    this.details = details;
  }
}

export class ConcurrentOperationError extends SafetyValidationError {
  constructor(operation, conflicts, details = {}) {
    super(`Concurrent operation conflict detected: ${operation}`, 'CONCURRENT_OPERATION_CONFLICT', {
      operation,
      conflicts,
      ...details
    });
  }
}

export class ResourceLimitExceededError extends SafetyValidationError {
  constructor(resource, limit, requested, details = {}) {
    super(`Resource limit exceeded: ${resource} (requested ${requested} > limit ${limit})`, 'RESOURCE_LIMIT_EXCEEDED', {
      resource,
      limit,
      requested,
      ...details
    });
  }
}

export class PermissionDeniedError extends SafetyValidationError {
  constructor(operation, requiredPermissions, actualPermissions, details = {}) {
    super(`Permission denied for operation: ${operation}`, 'PERMISSION_DENIED', {
      operation,
      requiredPermissions,
      actualPermissions,
      ...details
    });
  }
}

export class DependencyValidationError extends SafetyValidationError {
  constructor(dependency, issues, details = {}) {
    super(`Dependency validation failed: ${dependency}`, 'DEPENDENCY_VALIDATION_FAILED', {
      dependency,
      issues,
      ...details
    });
  }
}

/**
 * Domain events for safety validation
 */
export class SafetyValidationStarted extends DomainEvent {
  constructor(operationType, context) {
    super('SAFETY_VALIDATION_STARTED', { operationType, context });
  }
}

export class SafetyValidationCompleted extends DomainEvent {
  constructor(operationType, results) {
    super('SAFETY_VALIDATION_COMPLETED', { operationType, results });
  }
}

export class SafetyValidationFailed extends DomainEvent {
  constructor(operationType, errors, context) {
    super('SAFETY_VALIDATION_FAILED', { operationType, errors, context });
  }
}

export class ConcurrentOperationDetected extends DomainEvent {
  constructor(operation, conflicts) {
    super('CONCURRENT_OPERATION_DETECTED', { operation, conflicts });
  }
}

export class ResourceLimitWarning extends DomainEvent {
  constructor(resource, usage, limit, threshold) {
    super('RESOURCE_LIMIT_WARNING', { resource, usage, limit, threshold });
  }
}

export class PermissionCheckCompleted extends DomainEvent {
  constructor(operation, permissions, result) {
    super('PERMISSION_CHECK_COMPLETED', { operation, permissions, result });
  }
}

export class DependencyChainValidated extends DomainEvent {
  constructor(chain, validation) {
    super('DEPENDENCY_CHAIN_VALIDATED', { chain, validation });
  }
}

/**
 * Safety validation context
 */
export class ValidationContext {
  constructor(operationType, metadata = {}) {
    this.operationType = operationType;
    this.timestamp = Date.now();
    this.sessionId = metadata.sessionId || this.generateSessionId();
    this.userId = metadata.userId || null;
    this.permissions = metadata.permissions || [];
    this.resources = metadata.resources || {};
    this.dependencies = metadata.dependencies || [];
    this.concurrent = metadata.concurrent || false;
    this.priority = metadata.priority || 'normal';
    this.metadata = metadata;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      operationType: this.operationType,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      userId: this.userId,
      permissions: this.permissions,
      resources: this.resources,
      dependencies: this.dependencies,
      concurrent: this.concurrent,
      priority: this.priority,
      metadata: this.metadata
    };
  }
}

/**
 * Validation result
 */
export class ValidationResult {
  constructor() {
    this.overall = 'pending';
    this.checks = {
      concurrentOperations: null,
      resourceLimits: null,
      permissions: null,
      dependencies: null
    };
    this.warnings = [];
    this.errors = [];
    this.recommendations = [];
    this.timestamp = Date.now();
  }

  addCheck(checkName, result) {
    this.checks[checkName] = result;
    return this;
  }

  addWarning(warning) {
    this.warnings.push({
      ...warning,
      timestamp: Date.now()
    });
    return this;
  }

  addError(error) {
    this.errors.push({
      ...error,
      timestamp: Date.now()
    });
    return this;
  }

  addRecommendation(recommendation) {
    this.recommendations.push({
      ...recommendation,
      timestamp: Date.now()
    });
    return this;
  }

  setOverall(status) {
    this.overall = status;
    return this;
  }

  isValid() {
    return this.overall === 'passed';
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  toJSON() {
    return {
      overall: this.overall,
      checks: this.checks,
      warnings: this.warnings,
      errors: this.errors,
      recommendations: this.recommendations,
      timestamp: this.timestamp
    };
  }
}

/**
 * SafetyValidator - Core validation logic
 */
export class SafetyValidator {
  constructor(options = {}) {
    this.options = {
      enableConcurrentOperationCheck: true,
      enableResourceLimitCheck: true,
      enablePermissionCheck: true,
      enableDependencyValidation: true,
      strictMode: false,
      maxConcurrentOperations: 3,
      resourceLimits: {
        maxMemory: 2 * 1024 * 1024 * 1024,    // 2GB
        maxCpu: 80,                           // 80%
        maxConnections: 20,                   // 20 connections
        maxDiskSpace: 10 * 1024 * 1024 * 1024 // 10GB
      },
      warningThresholds: {
        memory: 70,     // % of limit
        cpu: 60,        // % of limit
        connections: 70, // % of limit
        diskSpace: 80   // % of limit
      },
      ...options
    };

    this.listeners = new Map();
    this.activeOperations = new Map();
    this.resourceUsage = new Map();
    this.permissionCache = new Map();
    this.dependencyGraph = new Map();
  }

  /**
   * Add event listener
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    return this;
  }

  /**
   * Emit domain event
   */
  emit(event) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
    return this;
  }

  /**
   * Validate operation safety
   * @param {ValidationContext} context - Operation context
   * @returns {Promise<ValidationResult>} Validation results
   */
  async validateSafety(context) {
    const result = new ValidationResult();
    
    this.emit(new SafetyValidationStarted(context.operationType, context.toJSON()));

    try {
      // 1. Check concurrent operations
      if (this.options.enableConcurrentOperationCheck) {
        const concurrentCheck = await this.checkConcurrentOperations(context);
        result.addCheck('concurrentOperations', concurrentCheck);
        
        if (!concurrentCheck.passed) {
          result.addError({
            type: 'concurrent_operation_conflict',
            message: concurrentCheck.message,
            details: concurrentCheck.conflicts
          });
        }
      }

      // 2. Check resource limits
      if (this.options.enableResourceLimitCheck) {
        const resourceCheck = await this.checkResourceLimits(context);
        result.addCheck('resourceLimits', resourceCheck);
        
        if (!resourceCheck.passed) {
          result.addError({
            type: 'resource_limit_exceeded',
            message: resourceCheck.message,
            details: resourceCheck.violations
          });
        }
        
        // Add warnings for high resource usage
        resourceCheck.warnings.forEach(warning => result.addWarning(warning));
      }

      // 3. Check permissions
      if (this.options.enablePermissionCheck) {
        const permissionCheck = await this.checkPermissions(context);
        result.addCheck('permissions', permissionCheck);
        
        if (!permissionCheck.passed) {
          result.addError({
            type: 'permission_denied',
            message: permissionCheck.message,
            details: permissionCheck.missingPermissions
          });
        }
      }

      // 4. Validate dependencies
      if (this.options.enableDependencyValidation) {
        const dependencyCheck = await this.validateDependencyChain(context);
        result.addCheck('dependencies', dependencyCheck);
        
        if (!dependencyCheck.passed) {
          result.addError({
            type: 'dependency_validation_failed',
            message: dependencyCheck.message,
            details: dependencyCheck.issues
          });
        }
        
        // Add recommendations
        dependencyCheck.recommendations.forEach(rec => result.addRecommendation(rec));
      }

      // Determine overall result
      const hasErrors = result.hasErrors();
      const hasWarnings = result.hasWarnings();
      
      if (hasErrors) {
        result.setOverall('failed');
        
        if (this.options.strictMode) {
          const error = new SafetyValidationError('Safety validation failed', 'VALIDATION_FAILED', {
            errors: result.errors,
            context: context.toJSON()
          });
          
          this.emit(new SafetyValidationFailed(context.operationType, result.errors, context.toJSON()));
          throw error;
        }
      } else if (hasWarnings) {
        result.setOverall('passed_with_warnings');
      } else {
        result.setOverall('passed');
      }

      this.emit(new SafetyValidationCompleted(context.operationType, result.toJSON()));
      
      return result;

    } catch (error) {
      result.setOverall('error');
      result.addError({
        type: 'validation_error',
        message: error.message,
        details: { error: error.message }
      });
      
      this.emit(new SafetyValidationFailed(context.operationType, [error.message], context.toJSON()));
      
      if (error instanceof SafetyValidationError) {
        throw error;
      } else {
        throw new SafetyValidationError('Safety validation encountered an error', 'VALIDATION_ERROR', { 
          originalError: error.message,
          context: context.toJSON()
        });
      }
    }
  }

  /**
   * Check for concurrent operation conflicts
   */
  async checkConcurrentOperations(context) {
    const result = {
      passed: true,
      message: null,
      conflicts: [],
      activeOperations: 0
    };

    try {
      // Get currently active operations
      const activeOps = Array.from(this.activeOperations.values());
      result.activeOperations = activeOps.length;

      // Check maximum concurrent operations
      if (activeOps.length >= this.options.maxConcurrentOperations) {
        result.passed = false;
        result.message = `Maximum concurrent operations exceeded (${activeOps.length}/${this.options.maxConcurrentOperations})`;
        result.conflicts.push({
          type: 'max_operations_exceeded',
          current: activeOps.length,
          maximum: this.options.maxConcurrentOperations
        });
      }

      // Check for conflicting operation types
      const conflicts = this.findOperationConflicts(context.operationType, activeOps);
      if (conflicts.length > 0) {
        result.passed = false;
        result.message = `Conflicting concurrent operations detected`;
        result.conflicts.push(...conflicts);
        
        this.emit(new ConcurrentOperationDetected(context.operationType, conflicts));
        
        if (this.options.strictMode) {
          throw new ConcurrentOperationError(context.operationType, conflicts);
        }
      }

      // Register this operation if it passes
      if (result.passed) {
        this.registerOperation(context);
      }

    } catch (error) {
      result.passed = false;
      result.message = `Concurrent operation check failed: ${error.message}`;
      result.conflicts.push({
        type: 'check_error',
        error: error.message
      });
      
      // Re-throw if it's a ConcurrentOperationError (strict mode case)
      if (error instanceof ConcurrentOperationError) {
        throw error;
      }
    }

    return result;
  }

  /**
   * Check resource limits
   */
  async checkResourceLimits(context) {
    const result = {
      passed: true,
      message: null,
      violations: [],
      warnings: [],
      currentUsage: {}
    };

    try {
      const requestedResources = context.resources;
      const currentUsage = await this.getCurrentResourceUsage();
      result.currentUsage = currentUsage;

      // Check each resource limit
      for (const [resource, requested] of Object.entries(requestedResources)) {
        const limit = this.options.resourceLimits[resource];
        const current = currentUsage[resource] || 0;
        const projected = current + requested;

        if (limit && projected > limit) {
          result.passed = false;
          result.violations.push({
            resource,
            requested,
            current,
            projected,
            limit,
            exceeded: projected - limit
          });
        }

        // Check warning thresholds
        const warningThreshold = this.options.warningThresholds[resource];
        if (warningThreshold && limit) {
          const usagePercentage = (projected / limit) * 100;
          if (usagePercentage > warningThreshold) {
            const warning = {
              type: 'resource_usage_warning',
              resource,
              usage: projected,
              limit,
              percentage: usagePercentage,
              threshold: warningThreshold
            };
            
            result.warnings.push(warning);
            this.emit(new ResourceLimitWarning(resource, projected, limit, warningThreshold));
          }
        }
      }

      if (result.violations.length > 0) {
        result.message = `Resource limit violations: ${result.violations.map(v => v.resource).join(', ')}`;
        
        if (this.options.strictMode) {
          const violation = result.violations[0];
          throw new ResourceLimitExceededError(violation.resource, violation.limit, violation.projected);
        }
      }

    } catch (error) {
      result.passed = false;
      result.message = `Resource limit check failed: ${error.message}`;
      
      if (error instanceof ResourceLimitExceededError) {
        throw error;
      }
    }

    return result;
  }

  /**
   * Check permissions
   */
  async checkPermissions(context) {
    const result = {
      passed: true,
      message: null,
      requiredPermissions: [],
      actualPermissions: context.permissions,
      missingPermissions: []
    };

    try {
      // Determine required permissions for operation type
      result.requiredPermissions = this.getRequiredPermissions(context.operationType);
      
      // Check if user has required permissions
      for (const required of result.requiredPermissions) {
        if (!this.hasPermission(context.permissions, required)) {
          result.missingPermissions.push(required);
        }
      }

      if (result.missingPermissions.length > 0) {
        result.passed = false;
        result.message = `Missing required permissions: ${result.missingPermissions.join(', ')}`;
        
        this.emit(new PermissionCheckCompleted(context.operationType, context.permissions, result));
        
        if (this.options.strictMode) {
          throw new PermissionDeniedError(
            context.operationType, 
            result.requiredPermissions, 
            context.permissions
          );
        }
      } else {
        this.emit(new PermissionCheckCompleted(context.operationType, context.permissions, result));
      }

    } catch (error) {
      result.passed = false;
      result.message = `Permission check failed: ${error.message}`;
      
      if (error instanceof PermissionDeniedError) {
        throw error;
      }
    }

    return result;
  }

  /**
   * Validate dependency chain
   */
  async validateDependencyChain(context) {
    const result = {
      passed: true,
      message: null,
      issues: [],
      recommendations: [],
      dependencyTree: {}
    };

    try {
      const dependencies = context.dependencies;
      
      for (const dependency of dependencies) {
        const validation = await this.validateSingleDependency(dependency, context);
        
        if (!validation.isValid) {
          result.issues.push({
            dependency: dependency.name,
            type: validation.type,
            message: validation.message,
            details: validation.details
          });
        }
        
        result.recommendations.push(...validation.recommendations);
      }

      // Check for circular dependencies
      const circularDeps = this.detectCircularDependencies(dependencies);
      if (circularDeps.length > 0) {
        result.issues.push({
          type: 'circular_dependency',
          message: 'Circular dependencies detected',
          cycles: circularDeps
        });
      }

      if (result.issues.length > 0) {
        result.passed = false;
        result.message = `Dependency validation failed: ${result.issues.length} issues found`;
        
        if (this.options.strictMode) {
          throw new DependencyValidationError('Dependency chain validation failed', result.issues);
        }
      }

      this.emit(new DependencyChainValidated(dependencies, result));

    } catch (error) {
      result.passed = false;
      result.message = `Dependency validation failed: ${error.message}`;
      
      if (error instanceof DependencyValidationError) {
        throw error;
      }
    }

    return result;
  }

  /**
   * Find operation conflicts
   */
  findOperationConflicts(operationType, activeOperations) {
    const conflicts = [];
    const conflictMatrix = this.getOperationConflictMatrix();
    
    for (const activeOp of activeOperations) {
      const conflictTypes = conflictMatrix[operationType] || [];
      
      if (conflictTypes.includes(activeOp.operationType)) {
        conflicts.push({
          type: 'operation_conflict',
          operation: operationType,
          conflictsWith: activeOp.operationType,
          activeOperationId: activeOp.sessionId,
          startTime: activeOp.timestamp
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Get operation conflict matrix
   */
  getOperationConflictMatrix() {
    return {
      'schema_migration': ['schema_migration', 'drop_table', 'alter_table'],
      'drop_table': ['schema_migration', 'alter_table', 'create_index'],
      'alter_table': ['schema_migration', 'drop_table', 'alter_table'],
      'backup_restore': ['schema_migration', 'drop_table', 'alter_table'],
      'bulk_insert': ['schema_migration', 'alter_table'],
      'create_index': ['drop_table', 'alter_table']
    };
  }

  /**
   * Register operation
   */
  registerOperation(context) {
    this.activeOperations.set(context.sessionId, {
      sessionId: context.sessionId,
      operationType: context.operationType,
      timestamp: context.timestamp,
      userId: context.userId,
      priority: context.priority
    });
    
    return context.sessionId;
  }

  /**
   * Unregister operation
   */
  unregisterOperation(sessionId) {
    return this.activeOperations.delete(sessionId);
  }

  /**
   * Get current resource usage (mock implementation)
   */
  async getCurrentResourceUsage() {
    // In real implementation, this would gather actual system metrics
    return {
      maxMemory: Math.floor(Math.random() * 1024 * 1024 * 1024), // Random memory usage
      maxCpu: Math.floor(Math.random() * 50) + 20,               // Random CPU 20-70%
      maxConnections: Math.floor(Math.random() * 10) + 5,        // Random connections 5-15
      maxDiskSpace: Math.floor(Math.random() * 5 * 1024 * 1024 * 1024) // Random disk usage
    };
  }

  /**
   * Get required permissions for operation type
   */
  getRequiredPermissions(operationType) {
    const permissionMap = {
      'schema_migration': ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
      'drop_table': ['SCHEMA_MODIFY', 'DDL_EXECUTE', 'DROP_OBJECTS'],
      'alter_table': ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
      'backup_restore': ['BACKUP_RESTORE', 'DATA_ACCESS'],
      'bulk_insert': ['DATA_MODIFY', 'DML_EXECUTE'],
      'create_index': ['SCHEMA_MODIFY', 'DDL_EXECUTE'],
      'read_data': ['DATA_ACCESS']
    };
    
    return permissionMap[operationType] || [];
  }

  /**
   * Check if user has permission
   */
  hasPermission(userPermissions, requiredPermission) {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('ADMIN');
  }

  /**
   * Validate single dependency
   */
  async validateSingleDependency(dependency, context) {
    return {
      isValid: true,
      type: 'dependency',
      message: 'Dependency is valid',
      details: {},
      recommendations: []
    };
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(dependencies) {
    // Simple cycle detection - in real implementation would use graph algorithms
    return [];
  }

  /**
   * Reset validator state
   */
  reset() {
    this.activeOperations.clear();
    this.resourceUsage.clear();
    this.permissionCache.clear();
    this.dependencyGraph.clear();
    return this;
  }
}

// Export singleton with default settings
export const safetyValidator = new SafetyValidator();