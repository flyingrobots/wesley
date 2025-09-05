# Real-World Examples

## Overview

This document provides concrete examples of T.A.S.K.S. and S.L.A.P.S. in action, demonstrating various scenarios from simple to complex.

---

## Example 1: Simple Blog Schema Generation

```mermaid
block-beta
  columns 3
  
  block:input:3
    BlogSchema["blog.graphql<br/>3 types, 15 fields"]
  end
  
  block:tasks:1
    Plan["5 tasks<br/>2 stages"]
  end
  
  block:exec:1
    Execute["Sequential<br/>~500ms"]
  end
  
  block:output:1
    Output["8 files<br/>~2KB total"]
  end
  
  BlogSchema --> Plan --> Execute --> Output
```

### Execution Timeline

```mermaid
timeline
    title Blog Generation Pipeline
    
    section Stage 0 - Parse
        Load Schema : 10ms
        Parse GraphQL : 15ms
        Build IR : 20ms
    
    section Stage 1 - Generate
        Create DDL : 80ms
        Create Types : 60ms
        Create Zod : 55ms
    
    section Stage 2 - Write
        Write SQL : 30ms
        Write TypeScript : 25ms
        Update Journal : 15ms
```

---

## Example 2: Multi-Tenant SaaS Platform

### Task Dependency Graph

```mermaid
gitGraph
    commit id: "Parse Schema"
    
    branch core-tables
    checkout core-tables
    commit id: "Organizations"
    commit id: "Users"
    commit id: "Memberships"
    
    checkout main
    merge core-tables
    
    branch app-tables
    checkout app-tables
    commit id: "Projects"
    commit id: "Tasks"
    commit id: "Comments"
    
    checkout main
    merge app-tables
    
    branch security
    checkout security
    commit id: "RLS Policies"
    commit id: "Audit Tables"
    
    checkout main
    merge security
    
    commit id: "Types & Validation"
    commit id: "API Routes"
```

### Resource Allocation

```mermaid
sankey-beta

"Total Tasks",30,"Database Schema"
"Database Schema",15,"Core Tables"
"Database Schema",10,"Application Tables"
"Database Schema",5,"Junction Tables"

"Total Tasks",30,"Security Layer"
"Security Layer",18,"RLS Policies"
"Security Layer",8,"Permissions"
"Security Layer",4,"Audit Triggers"

"Total Tasks",30,"Application Code"
"Application Code",12,"TypeScript Types"
"Application Code",10,"Zod Schemas"
"Application Code",8,"API Routes"

"Total Tasks",10,"Documentation"
"Documentation",5,"API Docs"
"Documentation",3,"Type Docs"
"Documentation",2,"README"
```

---

## Example 3: Incremental Schema Update

### Change Detection

```mermaid
quadrantChart
    title Schema Change Impact Analysis
    x-axis "No Changes" --> "Major Changes"
    y-axis "Safe" --> "Breaking"
    quadrant-1 "Auto-migrate"
    quadrant-2 "Review required"
    quadrant-3 "Skip"
    quadrant-4 "Manual migration"
    
    "Add nullable field": [0.3, 0.1]
    "Add new table": [0.4, 0.1]
    "Add index": [0.2, 0.2]
    "Rename field": [0.6, 0.7]
    "Change type": [0.7, 0.8]
    "Delete field": [0.8, 0.9]
    "Add constraint": [0.5, 0.4]
    "Modify RLS": [0.6, 0.5]
```

### Migration Plan

```mermaid
stateDiagram-v2
    [*] --> DetectChanges
    
    DetectChanges --> NoChanges: Schema unchanged
    DetectChanges --> SafeChanges: Additive only
    DetectChanges --> BreakingChanges: Destructive
    
    NoChanges --> SkipGeneration
    SkipGeneration --> [*]
    
    SafeChanges --> GenerateMigration
    GenerateMigration --> ApplyMigration
    ApplyMigration --> UpdateTypes
    UpdateTypes --> [*]
    
    BreakingChanges --> AnalyzeImpact
    AnalyzeImpact --> CreateBackup
    CreateBackup --> GenerateStaged
    
    GenerateStaged --> Phase1_Expand
    Phase1_Expand --> Phase2_Migrate
    Phase2_Migrate --> Phase3_Contract
    Phase3_Contract --> ValidateData
    ValidateData --> [*]
```

---

## Example 4: Error Recovery Scenario

### Failure and Recovery Flow

```mermaid
xychart-beta
    title "Task Execution with Failures"
    x-axis ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]
    y-axis "Status" 0 --> 3
    bar "First Attempt" [2, 2, 1, 2, 1, 2, 2, 2]
    bar "Retry Attempt" [0, 0, 2, 0, 2, 0, 0, 0]
    line "Success Line" [2, 2, 2, 2, 2, 2, 2, 2]
```

*Legend: 0=Not Run, 1=Failed, 2=Success*

### Recovery Timeline

```mermaid
timeline
    title Error Recovery Example
    
    section Initial Execution
        Tasks 1-2 : Success
        Task 3 : Network timeout
        Tasks 4-8 : Blocked
    
    section Retry Phase
        Task 3 retry 1 : Failed again
        Task 3 retry 2 : Success
        Tasks 4-5 : Success
        Task 6 : Disk full error
    
    section Resource Recovery
        Clear temp files : Admin action
        Task 6 retry : Success
        Tasks 7-8 : Success
    
    section Completion
        All tasks : Completed
        Journal : Updated
        Artifacts : Generated
```

---

## Example 5: Parallel Execution Optimization

### Parallel vs Sequential Performance

```mermaid
kanban
    Sequential_Queue
        task1[DDL Generation<br/>80ms]
        task2[RLS Policies<br/>60ms]
        task3[TypeScript<br/>70ms]
        task4[Zod Schemas<br/>50ms]
    
    Parallel_Worker_1
        p1[DDL Generation<br/>80ms]
        p3[TypeScript<br/>70ms]
    
    Parallel_Worker_2
        p2[RLS Policies<br/>60ms]
        p4[Zod Schemas<br/>50ms]
    
    Completed
        done1[Total Sequential: 260ms]
        done2[Total Parallel: 150ms]
        done3[Speedup: 1.73x]
```

### Resource Utilization Comparison

```mermaid
treemap
    Resource Usage Comparison: 100
        Sequential Execution: 40
            CPU Utilization: 25
                Single Core: 25
            Memory Usage: 15
                Peak 150MB: 15
        
        Parallel Execution: 60
            CPU Utilization: 35
                Core 1: 18
                Core 2: 17
            Memory Usage: 25
                Peak 250MB: 25
```

---

## Example 6: Complex Enterprise Schema

### Execution Stages

```mermaid
C4Component
    title Enterprise Schema Generation Components
    
    Component_Boundary(stage0, "Stage 0: Foundation") {
        Component(parse, "Parser", "GraphQL", "100+ types")
        Component(validate, "Validator", "Rules", "500+ rules")
        Component(ir, "IR Builder", "Transform", "Complex graph")
    }
    
    Component_Boundary(stage1, "Stage 1: Database") {
        Component(tables, "Table Gen", "DDL", "150 tables")
        Component(relations, "Relations", "FK", "200+ FKs")
        Component(indexes, "Indexes", "Perf", "300+ indexes")
    }
    
    Component_Boundary(stage2, "Stage 2: Security") {
        Component(rls, "RLS Gen", "Policies", "500+ policies")
        Component(rbac, "RBAC", "Roles", "50 roles")
        Component(audit, "Audit", "Triggers", "100 triggers")
    }
    
    Component_Boundary(stage3, "Stage 3: Application") {
        Component(types, "TypeScript", "Types", "1000+ types")
        Component(api, "API Gen", "Routes", "200 endpoints")
        Component(docs, "Docs Gen", "OpenAPI", "Full spec")
    }
    
    Rel(parse, validate, "Validates")
    Rel(validate, ir, "Builds")
    Rel(ir, tables, "Generates")
    Rel(tables, relations, "Then")
    Rel(relations, indexes, "Then")
    Rel(indexes, rls, "Then")
    Rel(rls, rbac, "Then")
    Rel(rbac, audit, "Then")
    Rel(audit, types, "Then")
    Rel(types, api, "Then")
    Rel(api, docs, "Finally")
```

### Performance Metrics

```mermaid
xychart-beta
    title "Enterprise Generation Metrics"
    x-axis ["Parse", "Plan", "Stage 0", "Stage 1", "Stage 2", "Stage 3", "Write"]
    y-axis "Time (seconds)" 0 --> 30
    bar "Time" [2, 1.5, 5, 12, 8, 10, 3]
    line "Memory (GB)" [0.5, 0.6, 0.8, 1.2, 1.1, 1.3, 0.9]
```

---

## Example 7: Caching Strategy

### Cache Hit Rates Over Time

```mermaid
xychart-beta
    title "Cache Performance During Repeated Generations"
    x-axis ["Gen 1", "Gen 2", "Gen 3", "Gen 4", "Gen 5"]
    y-axis "Hit Rate %" 0 --> 100
    line "Schema Cache" [0, 100, 100, 100, 100]
    line "Template Cache" [0, 85, 92, 95, 98]
    line "IR Cache" [0, 100, 50, 100, 75]
    bar "Time Saved (s)" [0, 2.5, 2.2, 2.8, 2.6]
```

---

## Configuration Examples

### Minimal Configuration
```yaml
# wesley-minimal.yaml
schema: ./schema.graphql
output: ./generated
```

### Production Configuration
```yaml
# wesley-production.yaml
schema: ./schema/**/*.graphql
output: ./generated

orchestration:
  tasks:
    caching: true
    validation: strict
  
  slaps:
    concurrency: 8
    journal:
      type: sqlite
      checkpoint: stage
    retry:
      maxAttempts: 5
      backoff: exponential

generators:
  supabase:
    migrations: true
    rls: true
    audit: true
  
  typescript:
    strict: true
    zod: true
    docs: true
```

### Development Configuration
```yaml
# wesley-dev.yaml
schema: ./schema.graphql
output: ./generated
watch: true

orchestration:
  tasks:
    validation: relaxed
    verbose: true
  
  slaps:
    concurrency: 2
    journal:
      type: memory
    
generators:
  supabase:
    dryRun: true
    explain: true
```

---

## Performance Comparison

```mermaid
radar
    title Configuration Impact on Performance
    x-axis "Slower" --> "Faster"
    y-axis "Less Safe" --> "More Safe"
    
    "Minimal Config": [8, 3]
    "Development": [6, 5]
    "Production": [4, 9]
    "Optimized": [9, 7]
    "Paranoid": [2, 10]
```

---

## Summary

These examples demonstrate T.A.S.K.S. and S.L.A.P.S. handling various real-world scenarios:

1. **Simple schemas** execute quickly with minimal overhead
2. **Complex multi-tenant** systems benefit from parallel execution
3. **Incremental updates** use smart change detection
4. **Error recovery** maintains progress through failures
5. **Parallel optimization** provides significant speedups
6. **Enterprise scale** handles hundreds of tables efficiently
7. **Caching strategies** improve repeated generation performance

The system scales from simple blog schemas (< 1 second) to complex enterprise systems (< 1 minute) while maintaining reliability and resumability.