# T.A.S.K.S. - Topologically Arranged Sequential Knowledge System

## Overview

T.A.S.K.S. is Wesley's DAG (Directed Acyclic Graph) planning system that transforms high-level generation recipes into executable plans with proper dependency ordering and resource management.

```mermaid
packet-beta
  0-10: "Task ID"
  11-15: "Priority"
  16-23: "Dependencies"
  24-31: "Resources"
  32-39: "Stage Number"
  40-47: "Hash[0:7]"
  48-55: "Hash[8:15]"
  56-63: "Checksum"
```

---

## Core Components

```mermaid
classDiagram
    class TaskNode {
        +String id
        +String[] dependencies
        +String[] resources
        +Object metadata
        +hash() String
        +validate() Boolean
    }
    
    class TaskPlan {
        +TaskNode[] nodes
        +Map edges
        +Stage[] stages
        +buildStages() Stage[]
        +topologicalSort() TaskNode[]
        +detectCycles() Boolean
    }
    
    class Stage {
        +Number index
        +TaskNode[] tasks
        +String[] resources
        +canExecuteParallel() Boolean
    }
    
    class TaskBuilder {
        +fromRecipe(recipe) TaskPlan
        +fromIR(ir) TaskNode[]
        +validate(plan) ValidationResult
    }
    
    class ResourceManager {
        +Set lockedResources
        +acquire(resources) Boolean
        +release(resources) void
        +hasConflict(r1, r2) Boolean
    }
    
    TaskPlan "1" *-- "many" TaskNode
    TaskPlan "1" *-- "many" Stage
    Stage "1" o-- "many" TaskNode
    TaskBuilder ..> TaskPlan : creates
    ResourceManager ..> Stage : manages
```

---

## Dependency Resolution Algorithm

```mermaid
stateDiagram-v2
    [*] --> LoadRecipe
    LoadRecipe --> ParseDependencies
    ParseDependencies --> BuildGraph
    
    BuildGraph --> CheckCycles
    CheckCycles --> HasCycle: cycle detected
    CheckCycles --> TopologicalSort: no cycles
    
    HasCycle --> Error
    Error --> [*]
    
    TopologicalSort --> GroupByResources
    GroupByResources --> CreateStages
    CreateStages --> OptimizeStages
    OptimizeStages --> HashPlan
    HashPlan --> OutputPlan
    OutputPlan --> [*]
```

---

## Resource Management

```mermaid
treemap
    Tasks requiring exclusive db:write: 320
        Create Tables: 180
        Add Indexes: 80
        RLS Policies: 60
    
    Tasks requiring fs:write: 280
        SQL Files: 120
        TypeScript Files: 100
        Documentation: 60
    
    Tasks requiring compute:heavy: 200
        IR Processing: 80
        Code Generation: 70
        Optimization: 50
    
    Parallel Tasks: 100
        Type Generation: 40
        Zod Schemas: 35
        API Routes: 25
```

---

## Task Priority Matrix

```mermaid
quadrantChart
    title Task Scheduling Priority
    x-axis Low Dependencies --> High Dependencies
    y-axis Low Resource Usage --> High Resource Usage
    quadrant-1 "Schedule First"
    quadrant-2 "Schedule Early"
    quadrant-3 "Schedule Anytime"
    quadrant-4 "Schedule Carefully"
    
    "Create Tables": [0.9, 0.8]
    "Add Constraints": [0.7, 0.7]
    "Generate Types": [0.3, 0.2]
    "Write Docs": [0.2, 0.1]
    "Create Indexes": [0.8, 0.9]
    "RLS Policies": [0.6, 0.6]
    "API Routes": [0.4, 0.3]
    "Zod Schemas": [0.5, 0.2]
```

---

## Stage Execution Timeline

```mermaid
timeline
    title Task Execution Stages
    
    section Stage 0 - Foundation
        Parse Schema : Load and validate GraphQL
        Build IR     : Transform to intermediate representation
        Validate     : Check semantic correctness
    
    section Stage 1 - Database
        Create Tables : DDL generation
        Add Constraints : Foreign keys, checks
        Create Indexes : Performance optimization
    
    section Stage 2 - Security
        RLS Policies : Row-level security
        Permissions : Access control
        Audit Tables : Tracking changes
    
    section Stage 3 - Application
        TypeScript Types : Interface generation
        Zod Schemas : Runtime validation
        API Routes : Endpoint scaffolding
    
    section Stage 4 - Documentation
        API Docs : OpenAPI spec
        Type Docs : TypeDoc generation
        README : Usage instructions
```

---

## Performance Characteristics

```mermaid
xychart-beta
    title "T.A.S.K.S. Performance Metrics"
    x-axis ["10 tasks", "50 tasks", "100 tasks", "500 tasks", "1000 tasks"]
    y-axis "Time (ms)" 0 --> 1000
    line "DAG Build" [5, 15, 35, 180, 380]
    line "Topological Sort" [2, 8, 18, 95, 210]
    line "Stage Creation" [3, 12, 28, 145, 320]
    line "Hash Generation" [1, 4, 9, 48, 105]
```

---

## Task Distribution Analysis

```mermaid
sankey-beta

"Recipe Input",100,"Parse & Validate"
"Parse & Validate",15,"Rejected (Invalid)"
"Parse & Validate",85,"DAG Building"

"DAG Building",85,"Dependency Resolution"
"Dependency Resolution",5,"Circular (Error)"
"Dependency Resolution",80,"Topological Sort"

"Topological Sort",80,"Resource Analysis"
"Resource Analysis",30,"Sequential Tasks"
"Resource Analysis",50,"Parallel Tasks"

"Sequential Tasks",30,"Stage 0-2"
"Parallel Tasks",20,"Stage 0"
"Parallel Tasks",15,"Stage 1"
"Parallel Tasks",15,"Stage 2"

"Stage 0-2",65,"Execution Ready"
```

---

## Implementation Details

```mermaid
gitGraph
    commit id: "Initial recipe"
    
    branch parse
    checkout parse
    commit id: "Parse GraphQL"
    commit id: "Extract directives"
    
    checkout main
    merge parse
    commit id: "Build IR"
    
    branch dag
    checkout dag
    commit id: "Create nodes"
    commit id: "Add dependencies"
    commit id: "Detect cycles"
    
    checkout main
    merge dag
    commit id: "Sort topology"
    
    branch stage
    checkout stage
    commit id: "Group by resources"
    commit id: "Optimize parallel"
    
    checkout main
    merge stage
    commit id: "Generate hash"
    commit id: "Output plan"
```

---

## Resource Locking Protocol

```mermaid
%%{init: {"theme": "dark", "themeVariables": {"fontSize": "16px"}}}%%
packet-beta
    title Resource Lock Structure
    0-7: "Lock Type"
    8-15: "Resource ID"
    16-31: "Task ID"
    32-47: "Timestamp"
    48-55: "Priority"
    56-59: "Flags"
    60-63: "CRC"
```

---

## API Usage

```typescript
// Building a plan with T.A.S.K.S.
import { TaskBuilder, TaskPlan } from '@wesley/tasks';

const builder = new TaskBuilder();

// From a recipe
const plan = await builder.fromRecipe({
  name: 'supabase-nextjs',
  tasks: [
    { 
      id: 'create-tables',
      generator: 'supabase',
      dependencies: [],
      resources: ['db:write']
    },
    {
      id: 'create-types',
      generator: 'typescript',
      dependencies: ['create-tables'],
      resources: ['fs:write']
    }
  ]
});

// Validate and optimize
const stages = plan.buildStages();
const hash = plan.hash();

console.log(`Plan ${hash} has ${stages.length} stages`);
```

---

## Next: [S.L.A.P.S. Execution Engine →](./02-slaps-overview.md)