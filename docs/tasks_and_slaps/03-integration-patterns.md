# T.A.S.K.S. and S.L.A.P.S. Integration Patterns

## Overview

This document describes how T.A.S.K.S. and S.L.A.P.S. work together to provide a complete orchestration solution for Wesley's code generation pipeline.

```mermaid
block-beta
  columns 4
  
  block:input:4
    columns 4
    Schema["GraphQL Schema"] Recipe["Stack Recipe"] Config["Configuration"] Context["Context"]
  end
  
  block:tasks:2
    columns 1
    TasksEngine["T.A.S.K.S.<br/>DAG Planning"]
  end
  
  block:slaps:2
    columns 1  
    SlapsEngine["S.L.A.P.S.<br/>Execution"]
  end
  
  block:output:4
    columns 4
    SQL["SQL Files"] Types["TypeScript"] Tests["Test Files"] Docs["Documentation"]
  end
  
  Schema --> TasksEngine
  Recipe --> TasksEngine
  Config --> TasksEngine
  TasksEngine --> SlapsEngine
  Context --> SlapsEngine
  SlapsEngine --> SQL
  SlapsEngine --> Types
  SlapsEngine --> Tests
  SlapsEngine --> Docs
```

---

## Data Flow Architecture

```mermaid
architecture-beta
    group api[API Layer]
    group orchestration[Orchestration]
    group generation[Generation]
    group persistence[Persistence]

    service cli(server)[CLI Commands] in api
    service rest(internet)[REST API] in api
    
    service tasks(server)[T.A.S.K.S.] in orchestration
    service slaps(server)[S.L.A.P.S.] in orchestration
    
    service genSQL(server)[SQL Generator] in generation
    service genTS(server)[TS Generator] in generation
    service genTest(server)[Test Generator] in generation
    
    service journal(database)[Journal DB] in persistence
    service fs(disk)[File System] in persistence

    cli:B --> T:tasks
    rest:B --> T:tasks
    tasks:B --> T:slaps
    slaps:L <--> R:journal
    slaps:B --> T:genSQL
    slaps:B --> T:genTS  
    slaps:B --> T:genTest
    genSQL:B --> T:fs
    genTS:B --> T:fs
    genTest:B --> T:fs
```

---

## Integration State Machine

```mermaid
stateDiagram-v2
    [*] --> ReceiveRequest: User command
    
    ReceiveRequest --> ValidateInput
    ValidateInput --> LoadSchema: Valid
    ValidateInput --> RejectRequest: Invalid
    
    LoadSchema --> ParseGraphQL
    ParseGraphQL --> BuildIR
    BuildIR --> LoadRecipe
    
    LoadRecipe --> InvokeTASKS: Recipe loaded
    
    state T.A.S.K.S. {
        [*] --> CreateNodes
        CreateNodes --> ResolveDeps
        ResolveDeps --> CheckCycles
        CheckCycles --> BuildStages
        BuildStages --> GenerateHash
        GenerateHash --> [*]: Output plan
    }
    
    InvokeTASKS --> InvokeSLAPS: Plan ready
    
    state S.L.A.P.S. {
        [*] --> InitJournal
        InitJournal --> CheckExisting
        CheckExisting --> ExecuteStages
        ExecuteStages --> UpdateJournal
        UpdateJournal --> NextStage: More stages
        UpdateJournal --> Complete: All done
        NextStage --> ExecuteStages
        Complete --> [*]: Artifacts generated
    }
    
    InvokeSLAPS --> WriteArtifacts
    WriteArtifacts --> NotifyComplete
    NotifyComplete --> [*]
    
    RejectRequest --> [*]
```

---

## Communication Protocol

```mermaid
packet-beta
    title Inter-Component Message Format
    0-7: "Version"
    8-15: "Type"
    16-31: "Source ID"
    32-47: "Target ID"
    48-63: "Sequence"
    64-79: "Timestamp"
    80-95: "Plan Hash"
    96-111: "Task ID"
    112-119: "Status"
    120-127: "Priority"
    128-191: "Payload"
    192-223: "Metadata"
    224-255: "Checksum"
```

---

## Performance Bottleneck Analysis

```mermaid
sankey-beta

"Input Processing",100,"Schema Parsing"
"Schema Parsing",100,"IR Building"
"IR Building",100,"T.A.S.K.S. Planning"

"T.A.S.K.S. Planning",20,"Dependency Resolution"
"T.A.S.K.S. Planning",15,"Cycle Detection"
"T.A.S.K.S. Planning",30,"Stage Creation"
"T.A.S.K.S. Planning",35,"Hash Generation"

"Dependency Resolution",20,"S.L.A.P.S. Execution"
"Cycle Detection",15,"S.L.A.P.S. Execution"
"Stage Creation",30,"S.L.A.P.S. Execution"
"Hash Generation",35,"S.L.A.P.S. Execution"

"S.L.A.P.S. Execution",40,"Parallel Execution"
"S.L.A.P.S. Execution",60,"Sequential Execution"

"Parallel Execution",30,"I/O Wait"
"Parallel Execution",10,"CPU Processing"
"Sequential Execution",45,"I/O Wait"
"Sequential Execution",15,"CPU Processing"

"I/O Wait",75,"File Writing"
"CPU Processing",25,"Code Generation"
```

---

## Resource Allocation Strategy

```mermaid
treemap
    System Resources: 100
        T.A.S.K.S. Allocation: 15
            Graph Building: 5
            Dependency Analysis: 4
            Stage Planning: 3
            Hashing: 3
        
        S.L.A.P.S. Allocation: 70
            Task Execution: 40
                Generator Invocation: 25
                Result Processing: 15
            Journal Operations: 15
                Read/Write: 10
                Lock Management: 5
            Resource Management: 10
                Lock Acquisition: 6
                Conflict Resolution: 4
            Error Handling: 5
                Retry Logic: 3
                Recovery: 2
        
        System Overhead: 15
            Memory Management: 8
            IPC Communication: 4
            Monitoring: 3
```

---

## Optimization Opportunities

```mermaid
radar
    title Integration Optimization Potential
    x-axis "Low Impact" --> "High Impact"
    y-axis "Easy" --> "Hard"
    
    "Cache IR": [8, 3]
    "Parallel Stages": [9, 5]
    "Journal Batching": [6, 2]
    "Resource Pooling": [7, 4]
    "Lazy Loading": [5, 2]
    "Plan Reuse": [8, 3]
    "Worker Pools": [9, 6]
    "Incremental Generation": [10, 8]
```

---

## Error Propagation

```mermaid
C4Component
    title Error Handling Components
    
    Component_Boundary(tasks, "T.A.S.K.S.") {
        Component(validator, "Validator", "Pure JS", "Schema validation")
        Component(planner, "Planner", "Pure JS", "DAG construction")
    }
    
    Component_Boundary(slaps, "S.L.A.P.S.") {
        Component(executor, "Executor", "Pure JS", "Task runner")
        Component(retry, "Retry Manager", "Pure JS", "Error recovery")
    }
    
    Component_Boundary(errors, "Error Handling") {
        Component(collector, "Error Collector", "Pure JS", "Aggregates errors")
        Component(reporter, "Error Reporter", "Pure JS", "Formats output")
    }
    
    Rel(validator, collector, "Validation errors")
    Rel(planner, collector, "Planning errors")
    Rel(executor, retry, "Execution errors")
    Rel(retry, collector, "Unrecoverable")
    Rel(collector, reporter, "All errors")
    
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Concurrency Model

```mermaid
kanban
    Ready
        t1[Parse Schema<br/>Stage: 0<br/>Deps: none]
        t2[Build IR<br/>Stage: 0<br/>Deps: none]
    
    Worker_1
        t3[Generate DDL<br/>Stage: 1<br/>Started: 10ms]
    
    Worker_2
        t4[Generate RLS<br/>Stage: 1<br/>Started: 12ms]
    
    Worker_3
        t5[Generate Types<br/>Stage: 2<br/>Waiting for: DDL]
    
    Worker_4
        idle[Idle<br/>Waiting for work]
    
    Completed
        t0[Load Recipe<br/>Duration: 5ms<br/>Result: ✓]
```

---

## Metrics Collection

```mermaid
xychart-beta
    title "Integration Performance Metrics"
    x-axis ["1 min", "5 min", "15 min", "30 min", "1 hour"]
    y-axis "Operations/sec" 0 --> 100
    line "Plans Created" [45, 52, 48, 51, 49]
    line "Tasks Executed" [380, 420, 395, 410, 402]
    line "Artifacts Generated" [95, 88, 92, 90, 91]
    bar "Errors" [2, 1, 3, 1, 2]
```

---

## Integration Test Coverage

```mermaid
quadrantChart
    title Test Coverage by Integration Point
    x-axis "Unit Tests" --> "Integration Tests"
    y-axis "Low Priority" --> "High Priority"
    quadrant-1 "Well Tested"
    quadrant-2 "Needs Integration Tests"
    quadrant-3 "Adequate"
    quadrant-4 "Needs Unit Tests"
    
    "TASKS→SLAPS": [0.7, 0.9]
    "Schema→TASKS": [0.8, 0.8]
    "SLAPS→Journal": [0.9, 0.7]
    "SLAPS→Generators": [0.6, 0.8]
    "Journal→FS": [0.8, 0.5]
    "CLI→TASKS": [0.5, 0.7]
    "Errors→Reporter": [0.4, 0.6]
```

---

## Deployment Architecture

```mermaid
C4Deployment
    title Deployment View
    
    Deployment_Node(dev, "Developer Machine", "macOS/Linux/Windows") {
        Deployment_Node(node, "Node.js", "v18+") {
            Container(cli, "Wesley CLI", "JavaScript")
            Container(tasks_runtime, "T.A.S.K.S.", "Pure JS")
            Container(slaps_runtime, "S.L.A.P.S.", "Pure JS")
        }
        
        Deployment_Node(storage, "Local Storage") {
            ContainerDb(journal_db, "Journal", "SQLite")
            ContainerDb(file_system, "Artifacts", "File System")
        }
    }
    
    Deployment_Node(cloud, "Cloud Services", "Optional") {
        ContainerDb(remote_journal, "Remote Journal", "PostgreSQL")
        ContainerDb(artifact_store, "Artifact Store", "S3")
    }
    
    Rel(slaps_runtime, journal_db, "Writes state")
    Rel(slaps_runtime, file_system, "Writes artifacts")
    Rel(slaps_runtime, remote_journal, "Sync", "Optional")
    Rel(file_system, artifact_store, "Backup", "Optional")
```

---

## Configuration Example

```yaml
# wesley.config.yaml
orchestration:
  tasks:
    maxDepth: 10
    cycleDetection: strict
    hashAlgorithm: sha256
    
  slaps:
    journal:
      type: sqlite
      path: ./journal.db
      retention: 7d
    
    execution:
      concurrency: 4
      timeout: 60000
      retryPolicy:
        maxAttempts: 3
        backoff: exponential
        
    resources:
      maxMemory: 512MB
      tempDirectory: /tmp/wesley
      
integration:
  errorReporting: verbose
  metrics: enabled
  tracing: enabled
```

---

## Next: [Performance Characteristics →](./04-performance.md)