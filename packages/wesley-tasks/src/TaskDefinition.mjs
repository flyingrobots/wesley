/**
 * Task Definition and Dependency Management
 * 
 * Core abstraction for defining tasks, their dependencies, and execution requirements.
 * Designed for pure scheduling logic without execution concerns.
 */

export class TaskDefinition {
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || id;
    this.description = config.description || '';
    this.dependencies = new Set(config.dependencies || []);
    this.resources = new Set(config.resources || []);
    this.priority = config.priority || 0;
    this.estimatedDuration = config.estimatedDuration || null;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.metadata = config.metadata || {};
    
    // Execution requirements
    this.requiresExclusiveAccess = config.requiresExclusiveAccess || false;
    this.canRunConcurrently = config.canRunConcurrently !== false;
    this.tags = new Set(config.tags || []);
  }
  
  /**
   * Add a dependency on another task
   */
  dependsOn(taskId) {
    this.dependencies.add(taskId);
    return this;
  }
  
  /**
   * Require access to a specific resource
   */
  requires(resource) {
    this.resources.add(resource);
    return this;
  }
  
  /**
   * Add metadata tag for filtering/grouping
   */
  tag(tagName) {
    this.tags.add(tagName);
    return this;
  }
  
  /**
   * Check if this task can run given available resources
   */
  canExecuteWith(availableResources) {
    return Array.from(this.resources).every(resource => 
      availableResources.has(resource)
    );
  }
  
  /**
   * Check if dependencies are satisfied
   */
  dependenciesSatisfied(completedTasks) {
    return Array.from(this.dependencies).every(dep => 
      completedTasks.has(dep)
    );
  }
  
  /**
   * Create a copy with additional configuration
   */
  extend(config = {}) {
    const extended = new TaskDefinition(this.id, {
      name: this.name,
      description: this.description,
      dependencies: Array.from(this.dependencies),
      resources: Array.from(this.resources),
      priority: this.priority,
      estimatedDuration: this.estimatedDuration,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      metadata: { ...this.metadata },
      requiresExclusiveAccess: this.requiresExclusiveAccess,
      canRunConcurrently: this.canRunConcurrently,
      tags: Array.from(this.tags),
      ...config
    });
    
    return extended;
  }
  
  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      dependencies: Array.from(this.dependencies),
      resources: Array.from(this.resources),
      priority: this.priority,
      estimatedDuration: this.estimatedDuration,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      metadata: this.metadata,
      requiresExclusiveAccess: this.requiresExclusiveAccess,
      canRunConcurrently: this.canRunConcurrently,
      tags: Array.from(this.tags)
    };
  }
  
  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new TaskDefinition(json.id, json);
  }
}

export class TaskDependency {
  constructor(sourceId, targetId, type = 'blocking') {
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.type = type; // 'blocking', 'soft', 'ordering'
  }
  
  /**
   * Check if this dependency prevents target from running
   */
  isBlocking(completedTasks) {
    if (this.type === 'soft') return false;
    return !completedTasks.has(this.sourceId);
  }
}

export class TaskGraph {
  constructor() {
    this.tasks = new Map();
    this.dependencies = new Map();
    this.dependents = new Map();
  }
  
  /**
   * Add a task to the graph
   */
  addTask(taskDef) {
    this.tasks.set(taskDef.id, taskDef);
    
    // Update dependency mappings
    for (const dep of taskDef.dependencies) {
      if (!this.dependencies.has(taskDef.id)) {
        this.dependencies.set(taskDef.id, new Set());
      }
      this.dependencies.get(taskDef.id).add(dep);
      
      if (!this.dependents.has(dep)) {
        this.dependents.set(dep, new Set());
      }
      this.dependents.get(dep).add(taskDef.id);
    }
    
    return this;
  }
  
  /**
   * Get all tasks that can be executed (no blocking dependencies)
   */
  getReadyTasks(completedTasks = new Set()) {
    const ready = [];
    
    for (const [id, task] of this.tasks) {
      if (completedTasks.has(id)) continue;
      
      if (task.dependenciesSatisfied(completedTasks)) {
        ready.push(task);
      }
    }
    
    return ready.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Detect circular dependencies
   */
  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    const hasCycle = (taskId, path = []) => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        cycles.push([...path.slice(cycleStart), taskId]);
        return true;
      }
      
      if (visited.has(taskId)) return false;
      
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);
      
      const deps = this.dependencies.get(taskId) || new Set();
      for (const dep of deps) {
        if (hasCycle(dep, [...path])) {
          return true;
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        hasCycle(taskId);
      }
    }
    
    return cycles;
  }
  
  /**
   * Get topological ordering of tasks
   */
  getExecutionOrder() {
    const order = [];
    const inDegree = new Map();
    const queue = [];
    
    // Calculate in-degrees
    for (const taskId of this.tasks.keys()) {
      inDegree.set(taskId, 0);
    }
    
    for (const deps of this.dependencies.values()) {
      for (const dep of deps) {
        if (inDegree.has(dep)) {
          inDegree.set(dep, inDegree.get(dep) + 1);
        }
      }
    }
    
    // Find tasks with no dependencies
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }
    
    // Process tasks
    while (queue.length > 0) {
      const taskId = queue.shift();
      order.push(taskId);
      
      const dependents = this.dependents.get(taskId) || new Set();
      for (const dependent of dependents) {
        const newDegree = inDegree.get(dependent) - 1;
        inDegree.set(dependent, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    // Check for cycles
    if (order.length !== this.tasks.size) {
      throw new Error('Circular dependency detected in task graph');
    }
    
    return order;
  }
  
  /**
   * Get critical path (longest path through the graph)
   */
  getCriticalPath() {
    const distances = new Map();
    const predecessors = new Map();
    
    // Initialize distances
    for (const taskId of this.tasks.keys()) {
      distances.set(taskId, 0);
    }
    
    const order = this.getExecutionOrder();
    
    // Calculate longest distances
    for (const taskId of order) {
      const task = this.tasks.get(taskId);
      const currentDistance = distances.get(taskId);
      const dependents = this.dependents.get(taskId) || new Set();
      
      for (const dependent of dependents) {
        const newDistance = currentDistance + (task.estimatedDuration || 1);
        if (newDistance > distances.get(dependent)) {
          distances.set(dependent, newDistance);
          predecessors.set(dependent, taskId);
        }
      }
    }
    
    // Find the task with maximum distance
    let maxDistance = 0;
    let endTask = null;
    
    for (const [taskId, distance] of distances) {
      if (distance > maxDistance) {
        maxDistance = distance;
        endTask = taskId;
      }
    }
    
    // Reconstruct path
    const path = [];
    let current = endTask;
    
    while (current) {
      path.unshift(current);
      current = predecessors.get(current);
    }
    
    return {
      path,
      duration: maxDistance,
      tasks: path.map(id => this.tasks.get(id))
    };
  }
}