/**
 * Concurrent Safety Analyzer
 * Analyzes operations for concurrent execution safety, detects race conditions,
 * and provides recommendations for safe parallelism levels
 * 
 * @license Apache-2.0
 */

import { EventEmitter } from '../../util/EventEmitter.mjs';
import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for concurrent safety analysis
 */
export class ConcurrentSafetyError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'ConcurrentSafetyError';
    this.code = code;
    this.context = context;
  }
}

export class RaceConditionError extends ConcurrentSafetyError {
  constructor(operations, resources) {
    super(`Race condition detected between operations on resources: ${resources.join(', ')}`, 'RACE_CONDITION', {
      operations,
      resources
    });
  }
}

export class LockEscalationError extends ConcurrentSafetyError {
  constructor(operations, lockType) {
    super(`Lock escalation risk detected: ${lockType} locks may escalate`, 'LOCK_ESCALATION', {
      operations,
      lockType
    });
  }
}

/**
 * Domain Events for concurrent safety analysis
 */
export class ConcurrentAnalysisStarted extends DomainEvent {
  constructor(operations) {
    super('CONCURRENT_ANALYSIS_STARTED', { operations: operations.length });
  }
}

export class RaceConditionDetected extends DomainEvent {
  constructor(raceCondition) {
    super('RACE_CONDITION_DETECTED', { raceCondition });
  }
}

export class SafetyAnalysisCompleted extends DomainEvent {
  constructor(analysis) {
    super('SAFETY_ANALYSIS_COMPLETED', { analysis });
  }
}

/**
 * Analyzes SQL operations for concurrent execution safety
 * Detects potential race conditions, lock escalation risks, and provides
 * recommendations for safe parallelism levels
 */
export class ConcurrentSafetyAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxParallelism = options.maxParallelism || 10;
    this.lockTimeout = options.lockTimeout || 30000; // 30 seconds
    this.raceConditionThreshold = options.raceConditionThreshold || 0.7;
    this.enable = options.enable ?? true;
    
    // Lock priority mapping
    this.lockPriorities = {
      'ACCESS_EXCLUSIVE': 8,
      'EXCLUSIVE': 7,
      'SHARE_UPDATE_EXCLUSIVE': 6,
      'SHARE_ROW_EXCLUSIVE': 5,
      'SHARE': 4,
      'ROW_EXCLUSIVE': 3,
      'ROW_SHARE': 2,
      'ACCESS_SHARE': 1
    };

    // Resource types and their conflict potential
    this.resourceTypes = {
      'table': { conflictWeight: 1.0, lockEscalation: true },
      'index': { conflictWeight: 0.8, lockEscalation: true },
      'sequence': { conflictWeight: 0.6, lockEscalation: false },
      'constraint': { conflictWeight: 0.9, lockEscalation: true },
      'function': { conflictWeight: 0.3, lockEscalation: false },
      'view': { conflictWeight: 0.4, lockEscalation: false }
    };
  }

  /**
   * Analyze a set of operations for concurrent execution safety
   * @param {Array} operations - List of SQL operations to analyze
   * @returns {Object} Safety analysis results
   */
  async analyzeOperations(operations) {
    if (!this.enable) {
      return this.createSafeAnalysis(operations);
    }

    this.emit('progress', new ConcurrentAnalysisStarted(operations));

    try {
      // Extract resource dependencies from operations
      const dependencies = this.extractDependencies(operations);
      
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(dependencies);
      
      // Detect race conditions
      const raceConditions = this.detectRaceConditions(dependencies, dependencyGraph);
      
      // Identify lock escalation risks
      const lockEscalationRisks = this.identifyLockEscalationRisks(dependencies);
      
      // Calculate safe parallelism levels
      const parallelismAnalysis = this.calculateParallelismLevels(dependencies, raceConditions);
      
      // Generate execution strategies
      const executionStrategies = this.generateExecutionStrategies(dependencies, raceConditions, parallelismAnalysis);

      const analysis = {
        operationCount: operations.length,
        dependencies,
        dependencyGraph,
        raceConditions,
        lockEscalationRisks,
        parallelismAnalysis,
        executionStrategies,
        safetyScore: this.calculateSafetyScore(raceConditions, lockEscalationRisks),
        recommendations: this.generateRecommendations(raceConditions, lockEscalationRisks, parallelismAnalysis),
        timestamp: new Date().toISOString()
      };

      // Emit race condition events
      for (const raceCondition of raceConditions) {
        this.emit('raceCondition', new RaceConditionDetected(raceCondition));
      }

      this.emit('success', new SafetyAnalysisCompleted(analysis));
      return analysis;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Extract resource dependencies from SQL operations
   * @param {Array} operations - SQL operations to analyze
   * @returns {Array} Resource dependencies
   */
  extractDependencies(operations) {
    const dependencies = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const dependency = {
        operationId: i,
        operation: operation,
        resources: this.extractResourcesFromOperation(operation),
        lockType: this.determineLockType(operation),
        accessPattern: this.analyzeAccessPattern(operation),
        transactionScope: operation.transactionScope || 'auto',
        priority: operation.priority || 0
      };
      
      dependencies.push(dependency);
    }

    return dependencies;
  }

  /**
   * Extract resources (tables, indexes, etc.) from a SQL operation
   * @param {Object} operation - SQL operation
   * @returns {Array} List of resources accessed
   */
  extractResourcesFromOperation(operation) {
    const resources = [];
    
    if (!operation.sql && !operation.ast) {
      return resources;
    }

    // Analyze SQL or AST to extract resource references
    const sql = operation.sql || '';
    const lowerSql = sql.toLowerCase();

    // Extract table names from common SQL patterns
    const tablePatterns = [
      /(?:from|join|into|update|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /(?:create|drop|alter)\s+table\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /(?:create|drop)\s+index\s+[a-zA-Z_][a-zA-Z0-9_]*\s+on\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
    ];

    for (const pattern of tablePatterns) {
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const resource = {
          name: match[1],
          type: this.inferResourceType(sql, match[1]),
          schema: operation.schema || 'public'
        };
        
        // Avoid duplicates
        if (!resources.find(r => r.name === resource.name && r.type === resource.type)) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  /**
   * Infer resource type from SQL context
   * @param {string} sql - SQL statement
   * @param {string} resourceName - Name of the resource
   * @returns {string} Resource type
   */
  inferResourceType(sql, resourceName) {
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('create index') || lowerSql.includes('drop index')) {
      return 'index';
    }
    
    if (lowerSql.includes('create sequence') || lowerSql.includes('alter sequence')) {
      return 'sequence';
    }
    
    if (lowerSql.includes('add constraint') || lowerSql.includes('drop constraint')) {
      return 'constraint';
    }
    
    if (lowerSql.includes('create function') || lowerSql.includes('create or replace function')) {
      return 'function';
    }
    
    if (lowerSql.includes('create view') || lowerSql.includes('create or replace view')) {
      return 'view';
    }
    
    if (lowerSql.includes('create table') || lowerSql.includes('alter table') || 
        lowerSql.includes('drop table')) {
      return 'table';
    }
    
    // Default to table for most operations
    return 'table';
  }

  /**
   * Determine the type of lock required by an operation
   * @param {Object} operation - SQL operation
   * @returns {string} Lock type
   */
  determineLockType(operation) {
    const sql = (operation.sql || '').toLowerCase();
    
    if (sql.includes('drop table') || sql.includes('truncate')) {
      return 'ACCESS_EXCLUSIVE';
    }
    
    if (sql.includes('create index') || sql.includes('drop index')) {
      return 'EXCLUSIVE';
    }
    
    if (sql.includes('create unique index')) {
      return 'SHARE_UPDATE_EXCLUSIVE';
    }
    
    if (sql.includes('alter table') && sql.includes('add constraint')) {
      return 'SHARE_UPDATE_EXCLUSIVE';
    }
    
    if (sql.includes('alter table')) {
      return 'SHARE_UPDATE_EXCLUSIVE';
    }
    
    if (sql.includes('insert') || sql.includes('update') || sql.includes('delete')) {
      return 'ROW_EXCLUSIVE';
    }
    
    if (sql.includes('select') && sql.includes('for update')) {
      return 'ROW_EXCLUSIVE';
    }
    
    if (sql.includes('select') && sql.includes('for share')) {
      return 'ROW_SHARE';
    }
    
    if (sql.includes('select')) {
      return 'ACCESS_SHARE';
    }
    
    // Default for DDL operations
    return 'SHARE_UPDATE_EXCLUSIVE';
  }

  /**
   * Analyze access pattern of an operation
   * @param {Object} operation - SQL operation
   * @returns {Object} Access pattern analysis
   */
  analyzeAccessPattern(operation) {
    const sql = (operation.sql || '').toLowerCase();
    
    return {
      reads: sql.includes('select'),
      writes: sql.includes('insert') || sql.includes('update') || sql.includes('delete'),
      ddl: sql.includes('create') || sql.includes('alter') || sql.includes('drop'),
      sequential: operation.sequential || false,
      batchSize: operation.batchSize || 1,
      estimatedRows: operation.estimatedRows || 'unknown'
    };
  }

  /**
   * Build dependency graph from resource dependencies
   * @param {Array} dependencies - Resource dependencies
   * @returns {Object} Dependency graph
   */
  buildDependencyGraph(dependencies) {
    const graph = {
      nodes: {},
      edges: [],
      clusters: []
    };

    // Create nodes for each operation
    for (const dep of dependencies) {
      graph.nodes[dep.operationId] = {
        id: dep.operationId,
        resources: dep.resources,
        lockType: dep.lockType,
        priority: dep.priority
      };
    }

    // Create edges for resource conflicts
    for (let i = 0; i < dependencies.length; i++) {
      for (let j = i + 1; j < dependencies.length; j++) {
        const conflict = this.checkResourceConflict(dependencies[i], dependencies[j]);
        if (conflict.hasConflict) {
          graph.edges.push({
            from: i,
            to: j,
            type: conflict.type,
            severity: conflict.severity,
            resources: conflict.conflictingResources
          });
        }
      }
    }

    // Identify strongly connected components (potential deadlock cycles)
    graph.clusters = this.findStronglyConnectedComponents(graph);

    return graph;
  }

  /**
   * Check if two operations have resource conflicts
   * @param {Object} dep1 - First dependency
   * @param {Object} dep2 - Second dependency
   * @returns {Object} Conflict analysis
   */
  checkResourceConflict(dep1, dep2) {
    const conflictingResources = [];
    let maxSeverity = 0;
    let conflictType = 'none';

    for (const resource1 of dep1.resources) {
      for (const resource2 of dep2.resources) {
        if (resource1.name === resource2.name && resource1.type === resource2.type) {
          const lockConflict = this.checkLockConflict(dep1.lockType, dep2.lockType);
          if (lockConflict.hasConflict) {
            conflictingResources.push({
              resource: resource1.name,
              type: resource1.type,
              severity: lockConflict.severity
            });
            
            if (lockConflict.severity > maxSeverity) {
              maxSeverity = lockConflict.severity;
              conflictType = lockConflict.type;
            }
          }
        }
      }
    }

    return {
      hasConflict: conflictingResources.length > 0,
      type: conflictType,
      severity: maxSeverity,
      conflictingResources
    };
  }

  /**
   * Check if two lock types conflict
   * @param {string} lock1 - First lock type
   * @param {string} lock2 - Second lock type
   * @returns {Object} Lock conflict analysis
   */
  checkLockConflict(lock1, lock2) {
    // PostgreSQL lock compatibility matrix
    const lockCompatibility = {
      'ACCESS_SHARE': ['ACCESS_SHARE', 'ROW_SHARE', 'ROW_EXCLUSIVE', 'SHARE', 'SHARE_ROW_EXCLUSIVE'],
      'ROW_SHARE': ['ACCESS_SHARE', 'ROW_SHARE', 'ROW_EXCLUSIVE', 'SHARE', 'SHARE_ROW_EXCLUSIVE'],
      'ROW_EXCLUSIVE': ['ACCESS_SHARE', 'ROW_SHARE', 'ROW_EXCLUSIVE'],
      'SHARE_UPDATE_EXCLUSIVE': ['ACCESS_SHARE', 'ROW_SHARE'],
      'SHARE': ['ACCESS_SHARE', 'ROW_SHARE', 'SHARE'],
      'SHARE_ROW_EXCLUSIVE': ['ACCESS_SHARE', 'ROW_SHARE'],
      'EXCLUSIVE': ['ACCESS_SHARE'],
      'ACCESS_EXCLUSIVE': []
    };

    const compatible = lockCompatibility[lock1] || [];
    const hasConflict = !compatible.includes(lock2);
    
    if (!hasConflict) {
      return { hasConflict: false, severity: 0, type: 'none' };
    }

    const priority1 = this.lockPriorities[lock1] || 0;
    const priority2 = this.lockPriorities[lock2] || 0;
    const severity = Math.max(priority1, priority2) / 8; // Normalize to 0-1

    let conflictType = 'lock_conflict';
    if (priority1 >= 7 || priority2 >= 7) {
      conflictType = 'blocking_conflict';
    }

    return { hasConflict: true, severity, type: conflictType };
  }

  /**
   * Find strongly connected components in the dependency graph
   * @param {Object} graph - Dependency graph
   * @returns {Array} Strongly connected components
   */
  findStronglyConnectedComponents(graph) {
    // Simplified Tarjan's algorithm for finding SCCs
    const components = [];
    const visited = new Set();
    const stack = [];
    const indices = {};
    const lowLinks = {};
    let index = 0;

    const strongConnect = (nodeId) => {
      indices[nodeId] = index;
      lowLinks[nodeId] = index;
      index++;
      stack.push(nodeId);
      visited.add(nodeId);

      // Find neighbors
      const neighbors = graph.edges
        .filter(edge => edge.from === nodeId)
        .map(edge => edge.to);

      for (const neighborId of neighbors) {
        if (indices[neighborId] === undefined) {
          strongConnect(neighborId);
          lowLinks[nodeId] = Math.min(lowLinks[nodeId], lowLinks[neighborId]);
        } else if (visited.has(neighborId)) {
          lowLinks[nodeId] = Math.min(lowLinks[nodeId], indices[neighborId]);
        }
      }

      if (lowLinks[nodeId] === indices[nodeId]) {
        const component = [];
        let w;
        do {
          w = stack.pop();
          visited.delete(w);
          component.push(w);
        } while (w !== nodeId);
        
        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    for (const nodeId of Object.keys(graph.nodes)) {
      if (indices[nodeId] === undefined) {
        strongConnect(parseInt(nodeId));
      }
    }

    return components;
  }

  /**
   * Detect race conditions in operations
   * @param {Array} dependencies - Resource dependencies
   * @param {Object} dependencyGraph - Dependency graph
   * @returns {Array} Detected race conditions
   */
  detectRaceConditions(dependencies, dependencyGraph) {
    const raceConditions = [];

    // Check for read-write conflicts
    for (const edge of dependencyGraph.edges) {
      const dep1 = dependencies[edge.from];
      const dep2 = dependencies[edge.to];

      if (this.isRaceCondition(dep1, dep2, edge)) {
        raceConditions.push({
          type: 'read_write_conflict',
          operations: [edge.from, edge.to],
          resources: edge.resources.map(r => r.resource),
          severity: edge.severity,
          probability: this.calculateRaceConditionProbability(dep1, dep2),
          mitigation: this.suggestRaceConditionMitigation(dep1, dep2)
        });
      }
    }

    // Check for potential deadlocks (cycles in dependency graph)
    for (const cluster of dependencyGraph.clusters) {
      if (cluster.length > 1) {
        raceConditions.push({
          type: 'potential_deadlock',
          operations: cluster,
          resources: this.getClusterResources(dependencies, cluster),
          severity: 0.9,
          probability: 0.3,
          mitigation: 'Order operations consistently or use explicit locking'
        });
      }
    }

    return raceConditions;
  }

  /**
   * Check if two operations constitute a race condition
   * @param {Object} dep1 - First dependency
   * @param {Object} dep2 - Second dependency
   * @param {Object} edge - Graph edge between operations
   * @returns {boolean} True if race condition exists
   */
  isRaceCondition(dep1, dep2, edge) {
    // Race condition exists if:
    // 1. Operations access the same resource
    // 2. At least one operation writes
    // 3. Operations can execute concurrently
    // 4. No explicit ordering is defined

    const hasWrite = dep1.accessPattern.writes || dep2.accessPattern.writes;
    const canExecuteConcurrently = dep1.transactionScope !== dep2.transactionScope || 
                                   (dep1.transactionScope === 'auto' && dep2.transactionScope === 'auto');

    // Lower the severity threshold and ensure we check for concurrent write scenarios
    return hasWrite && canExecuteConcurrently && edge.severity >= 0.1;
  }

  /**
   * Calculate probability of race condition occurring
   * @param {Object} dep1 - First dependency
   * @param {Object} dep2 - Second dependency
   * @returns {number} Probability (0-1)
   */
  calculateRaceConditionProbability(dep1, dep2) {
    let probability = 0.5; // Base probability

    // Increase probability for operations on same resources
    const sharedResources = this.countSharedResources(dep1.resources, dep2.resources);
    probability += sharedResources * 0.1;

    // Increase probability for write operations
    if (dep1.accessPattern.writes && dep2.accessPattern.writes) {
      probability += 0.2;
    }

    // Decrease probability for sequential operations
    if (dep1.accessPattern.sequential || dep2.accessPattern.sequential) {
      probability -= 0.3;
    }

    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Count shared resources between two dependencies
   * @param {Array} resources1 - First set of resources
   * @param {Array} resources2 - Second set of resources
   * @returns {number} Number of shared resources
   */
  countSharedResources(resources1, resources2) {
    let count = 0;
    for (const r1 of resources1) {
      for (const r2 of resources2) {
        if (r1.name === r2.name && r1.type === r2.type) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Suggest mitigation for race condition
   * @param {Object} dep1 - First dependency
   * @param {Object} dep2 - Second dependency
   * @returns {string} Mitigation suggestion
   */
  suggestRaceConditionMitigation(dep1, dep2) {
    if (dep1.accessPattern.reads && dep2.accessPattern.writes) {
      return 'Use REPEATABLE READ isolation or explicit locking';
    }
    
    if (dep1.accessPattern.writes && dep2.accessPattern.writes) {
      return 'Serialize write operations or use optimistic locking';
    }
    
    return 'Review operation ordering and consider explicit synchronization';
  }

  /**
   * Get resources accessed by operations in a cluster
   * @param {Array} dependencies - All dependencies
   * @param {Array} cluster - Cluster of operation IDs
   * @returns {Array} Resources accessed by cluster
   */
  getClusterResources(dependencies, cluster) {
    const resources = new Set();
    for (const opId of cluster) {
      const dep = dependencies[opId];
      for (const resource of dep.resources) {
        resources.add(`${resource.name}:${resource.type}`);
      }
    }
    return Array.from(resources);
  }

  /**
   * Identify lock escalation risks
   * @param {Array} dependencies - Resource dependencies
   * @returns {Array} Lock escalation risks
   */
  identifyLockEscalationRisks(dependencies) {
    const risks = [];
    const resourceLockCounts = new Map();

    // Count lock operations per resource
    for (const dep of dependencies) {
      for (const resource of dep.resources) {
        const key = `${resource.name}:${resource.type}`;
        if (!resourceLockCounts.has(key)) {
          resourceLockCounts.set(key, []);
        }
        resourceLockCounts.get(key).push({
          operationId: dep.operationId,
          lockType: dep.lockType,
          batchSize: dep.accessPattern.batchSize
        });
      }
    }

    // Identify potential escalation scenarios
    for (const [resourceKey, locks] of resourceLockCounts.entries()) {
      if (locks.length > 1) {
        const [resourceName, resourceType] = resourceKey.split(':');
        const resourceConfig = this.resourceTypes[resourceType];
        
        if (resourceConfig && resourceConfig.lockEscalation) {
          const totalBatchSize = locks.reduce((sum, lock) => sum + (lock.batchSize || 1), 0);
          
          if (totalBatchSize > 1000 || locks.length > 5) {
            risks.push({
              resource: resourceName,
              type: resourceType,
              operations: locks.map(l => l.operationId),
              lockTypes: locks.map(l => l.lockType),
              estimatedBatchSize: totalBatchSize,
              escalationProbability: Math.min(1, (totalBatchSize / 5000) + (locks.length / 10)),
              mitigation: this.suggestLockEscalationMitigation(resourceType, totalBatchSize)
            });
          }
        }
      }
    }

    return risks;
  }

  /**
   * Suggest mitigation for lock escalation
   * @param {string} resourceType - Type of resource
   * @param {number} batchSize - Estimated batch size
   * @returns {string} Mitigation suggestion
   */
  suggestLockEscalationMitigation(resourceType, batchSize) {
    if (batchSize > 10000) {
      return 'Break into smaller batches or use bulk operations';
    }
    
    if (resourceType === 'table') {
      return 'Consider partitioning or using advisory locks';
    }
    
    if (resourceType === 'index') {
      return 'Use CREATE INDEX CONCURRENTLY or schedule during low traffic';
    }
    
    return 'Monitor lock wait times and consider operation scheduling';
  }

  /**
   * Calculate safe parallelism levels
   * @param {Array} dependencies - Resource dependencies
   * @param {Array} raceConditions - Detected race conditions
   * @returns {Object} Parallelism analysis
   */
  calculateParallelismLevels(dependencies, raceConditions) {
    const analysis = {
      maxSafeParallelism: this.maxParallelism,
      resourceConstraints: {},
      operationGroups: [],
      bottleneckResources: []
    };

    // Group operations by resource usage
    const resourceGroups = this.groupOperationsByResource(dependencies);
    
    // Calculate constraints for each resource
    for (const [resourceKey, ops] of Object.entries(resourceGroups)) {
      const [resourceName, resourceType] = resourceKey.split(':');
      const writeOps = ops.filter(op => dependencies[op].accessPattern.writes);
      const readOps = ops.filter(op => !dependencies[op].accessPattern.writes);

      analysis.resourceConstraints[resourceKey] = {
        resource: resourceName,
        type: resourceType,
        totalOperations: ops.length,
        writeOperations: writeOps.length,
        readOperations: readOps.length,
        maxConcurrentReads: readOps.length, // Reads can be parallel
        maxConcurrentWrites: Math.min(1, writeOps.length), // Writes typically sequential
        recommendedParallelism: this.calculateResourceParallelism(resourceType, ops.length, writeOps.length)
      };

      if (writeOps.length > 1) {
        analysis.bottleneckResources.push({
          resource: resourceKey,
          reason: `${writeOps.length} write operations on same resource`,
          impact: 'high'
        });
      }
    }

    // Calculate overall parallelism considering race conditions
    let safeParallelism = this.maxParallelism;
    for (const raceCondition of raceConditions) {
      if (raceCondition.severity > 0.8) {
        safeParallelism = Math.min(safeParallelism, Math.ceil(safeParallelism / 2));
      }
    }

    analysis.maxSafeParallelism = safeParallelism;
    analysis.operationGroups = this.createExecutionGroups(dependencies, raceConditions);

    return analysis;
  }

  /**
   * Group operations by the resources they access
   * @param {Array} dependencies - Resource dependencies
   * @returns {Object} Operations grouped by resource
   */
  groupOperationsByResource(dependencies) {
    const groups = {};
    
    for (const dep of dependencies) {
      for (const resource of dep.resources) {
        const key = `${resource.name}:${resource.type}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(dep.operationId);
      }
    }
    
    return groups;
  }

  /**
   * Calculate recommended parallelism for a resource
   * @param {string} resourceType - Type of resource
   * @param {number} totalOps - Total operations on resource
   * @param {number} writeOps - Write operations on resource
   * @returns {number} Recommended parallelism level
   */
  calculateResourceParallelism(resourceType, totalOps, writeOps) {
    const resourceConfig = this.resourceTypes[resourceType];
    if (!resourceConfig) {
      return 1;
    }

    let parallelism = Math.min(this.maxParallelism, totalOps);
    
    // Reduce parallelism for write-heavy operations
    if (writeOps > 0) {
      parallelism = Math.max(1, Math.ceil(parallelism * (1 - (writeOps / totalOps) * 0.7)));
    }
    
    // Apply resource-specific constraints
    parallelism = Math.ceil(parallelism * resourceConfig.conflictWeight);
    
    return Math.max(1, parallelism);
  }

  /**
   * Create execution groups for safe parallel execution
   * @param {Array} dependencies - Resource dependencies
   * @param {Array} raceConditions - Race conditions to avoid
   * @returns {Array} Execution groups
   */
  createExecutionGroups(dependencies, raceConditions) {
    const groups = [];
    const processed = new Set();
    const conflicts = new Map();

    // Build conflict map
    for (const raceCondition of raceConditions) {
      for (const opId of raceCondition.operations) {
        if (!conflicts.has(opId)) {
          conflicts.set(opId, new Set());
        }
        for (const conflictOpId of raceCondition.operations) {
          if (opId !== conflictOpId) {
            conflicts.get(opId).add(conflictOpId);
          }
        }
      }
    }

    // Group operations that don't conflict
    for (let i = 0; i < dependencies.length; i++) {
      if (processed.has(i)) continue;

      const group = {
        groupId: groups.length,
        operations: [i],
        parallelism: 1,
        dependencies: [dependencies[i]],
        estimatedDuration: dependencies[i].estimatedDuration || 'unknown'
      };

      // Add compatible operations to the same group
      for (let j = i + 1; j < dependencies.length; j++) {
        if (processed.has(j)) continue;

        const canGroup = !conflicts.has(i) || !conflicts.get(i).has(j);
        if (canGroup) {
          group.operations.push(j);
          group.dependencies.push(dependencies[j]);
          group.parallelism++;
          processed.add(j);
        }
      }

      groups.push(group);
      processed.add(i);
    }

    return groups;
  }

  /**
   * Generate execution strategies
   * @param {Array} dependencies - Resource dependencies
   * @param {Array} raceConditions - Race conditions
   * @param {Object} parallelismAnalysis - Parallelism analysis
   * @returns {Array} Execution strategies
   */
  generateExecutionStrategies(dependencies, raceConditions, parallelismAnalysis) {
    const strategies = [];

    // Conservative strategy - minimize risk
    strategies.push({
      name: 'conservative',
      description: 'Minimize concurrency to avoid race conditions',
      parallelism: Math.max(1, Math.ceil(parallelismAnalysis.maxSafeParallelism / 2)),
      executionGroups: this.createSequentialGroups(dependencies),
      riskLevel: 'low',
      estimatedTime: 'high',
      reliability: 'high'
    });

    // Balanced strategy - balance risk and performance
    strategies.push({
      name: 'balanced',
      description: 'Balance concurrency and safety',
      parallelism: parallelismAnalysis.maxSafeParallelism,
      executionGroups: parallelismAnalysis.operationGroups,
      riskLevel: 'medium',
      estimatedTime: 'medium',
      reliability: 'medium'
    });

    // Aggressive strategy - maximize performance
    if (raceConditions.length === 0) {
      strategies.push({
        name: 'aggressive',
        description: 'Maximum concurrency - use only when no race conditions detected',
        parallelism: this.maxParallelism,
        executionGroups: this.createMaximalGroups(dependencies),
        riskLevel: 'high',
        estimatedTime: 'low',
        reliability: 'low'
      });
    }

    return strategies;
  }

  /**
   * Create sequential execution groups
   * @param {Array} dependencies - Resource dependencies
   * @returns {Array} Sequential execution groups
   */
  createSequentialGroups(dependencies) {
    return dependencies.map((dep, index) => ({
      groupId: index,
      operations: [index],
      parallelism: 1,
      dependencies: [dep]
    }));
  }

  /**
   * Create maximal parallel execution groups
   * @param {Array} dependencies - Resource dependencies
   * @returns {Array} Maximal execution groups
   */
  createMaximalGroups(dependencies) {
    return [{
      groupId: 0,
      operations: dependencies.map((_, index) => index),
      parallelism: dependencies.length,
      dependencies: dependencies
    }];
  }

  /**
   * Calculate overall safety score
   * @param {Array} raceConditions - Race conditions
   * @param {Array} lockEscalationRisks - Lock escalation risks
   * @returns {number} Safety score (0-1, higher is safer)
   */
  calculateSafetyScore(raceConditions, lockEscalationRisks) {
    let score = 1.0;

    // Reduce score for race conditions
    for (const raceCondition of raceConditions) {
      score -= raceCondition.severity * raceCondition.probability * 0.3;
    }

    // Reduce score for lock escalation risks
    for (const risk of lockEscalationRisks) {
      score -= risk.escalationProbability * 0.2;
    }

    return Math.max(0, score);
  }

  /**
   * Generate safety recommendations
   * @param {Array} raceConditions - Race conditions
   * @param {Array} lockEscalationRisks - Lock escalation risks
   * @param {Object} parallelismAnalysis - Parallelism analysis
   * @returns {Array} Recommendations
   */
  generateRecommendations(raceConditions, lockEscalationRisks, parallelismAnalysis) {
    const recommendations = [];

    // Race condition recommendations
    for (const raceCondition of raceConditions) {
      if (raceCondition.severity > 0.7) {
        recommendations.push({
          type: 'critical',
          category: 'race_condition',
          message: `Critical race condition detected: ${raceCondition.mitigation}`,
          operations: raceCondition.operations,
          resources: raceCondition.resources
        });
      }
    }

    // Lock escalation recommendations
    for (const risk of lockEscalationRisks) {
      if (risk.escalationProbability > 0.5) {
        recommendations.push({
          type: 'warning',
          category: 'lock_escalation',
          message: `Lock escalation risk on ${risk.resource}: ${risk.mitigation}`,
          operations: risk.operations,
          resource: risk.resource
        });
      }
    }

    // Parallelism recommendations
    if (parallelismAnalysis.bottleneckResources.length > 0) {
      recommendations.push({
        type: 'info',
        category: 'performance',
        message: `Performance bottlenecks detected on ${parallelismAnalysis.bottleneckResources.length} resources`,
        details: parallelismAnalysis.bottleneckResources
      });
    }

    // General safety recommendations
    if (raceConditions.length === 0 && lockEscalationRisks.length === 0) {
      recommendations.push({
        type: 'success',
        category: 'safety',
        message: 'No major safety issues detected - operations can proceed with recommended parallelism'
      });
    }

    return recommendations;
  }

  /**
   * Create a safe analysis result when analyzer is disabled
   * @param {Array} operations - Operations to analyze
   * @returns {Object} Safe analysis result
   */
  createSafeAnalysis(operations) {
    return {
      operationCount: operations.length,
      dependencies: [],
      dependencyGraph: { nodes: {}, edges: [], clusters: [] },
      raceConditions: [],
      lockEscalationRisks: [],
      parallelismAnalysis: {
        maxSafeParallelism: 1,
        resourceConstraints: {},
        operationGroups: [],
        bottleneckResources: []
      },
      executionStrategies: [{
        name: 'safe',
        description: 'Sequential execution (analyzer disabled)',
        parallelism: 1,
        executionGroups: this.createSequentialGroups(operations.map((op, i) => ({ operationId: i, operation: op }))),
        riskLevel: 'minimal',
        estimatedTime: 'high',
        reliability: 'maximum'
      }],
      safetyScore: 1.0,
      recommendations: [{
        type: 'info',
        category: 'configuration',
        message: 'Concurrent safety analyzer is disabled - using safe sequential execution'
      }],
      timestamp: new Date().toISOString()
    };
  }
}

export default ConcurrentSafetyAnalyzer;
