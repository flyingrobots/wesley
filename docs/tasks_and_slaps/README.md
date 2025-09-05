# T.A.S.K.S. and S.L.A.P.S. Documentation

## Overview

Wesley's orchestration engine consists of two complementary systems that work together to provide deterministic, resumable, and safe execution of complex generation pipelines.

- **T.A.S.K.S.** (Topologically Arranged Sequential Knowledge System) - DAG planning and dependency resolution
- **S.L.A.P.S.** (Stateful Linearized Asynchronous Processing System) - Execution engine with journaling

```mermaid
architecture-beta
    group tasks[T.A.S.K.S.]
    group slaps[S.L.A.P.S.]
    group output[Output]

    service dag(server)[DAG Builder] in tasks
    service topo(server)[Topological Sort] in tasks
    service hash(server)[Hash Generator] in tasks
    
    service exec(server)[Executor] in slaps
    service journal(database)[Journal] in slaps
    service retry(server)[Retry Logic] in slaps
    
    service files(disk)[Generated Files] in output
    service logs(disk)[Execution Logs] in output

    dag:R --> L:topo
    topo:R --> L:hash
    hash:B --> T:exec
    exec:R <--> L:journal
    exec:B --> T:retry
    exec:R --> L:files
    journal:B --> T:logs
```

---

## Table of Contents

1. [T.A.S.K.S. - DAG Planning System](./01-tasks-overview.md)
2. [S.L.A.P.S. - Execution Engine](./02-slaps-overview.md)
3. [Integration Patterns](./03-integration-patterns.md)
4. [Performance Characteristics](./04-performance.md)
5. [Error Handling & Recovery](./05-error-recovery.md)
6. [Real-World Examples](./06-examples.md)

---

## Quick Start

```mermaid
kanban
    Todo
        Build Plan[Build DAG Plan<br/>Define dependencies<br/>Set resources]
        Validate[Validate DAG<br/>Check cycles<br/>Verify resources]
    
    InProgress
        Execute[Run with SLAPS<br/>Process stages<br/>Update journal]
    
    Testing
        Verify[Check outputs<br/>Validate results<br/>Test idempotency]
    
    Done
        Deploy[Generated artifacts<br/>Documentation<br/>Tests passed]
```

---

## Core Concepts

```mermaid
block-beta
  columns 3
  
  block:group1:2
    columns 2
    TaskNode["Task Node<br/>ID, Dependencies, Resources"]
    TaskEdge["Edge<br/>Dependency relationship"]
    TaskStage["Stage<br/>Parallel execution group"]
    TaskHash["Hash<br/>Deterministic ID"]
  end
  
  block:group2:1
    JournalEntry["Journal Entry<br/>Task ID, Status, Result"]
    ExecutionPolicy["Policy<br/>Retry, Timeout, Concurrency"]
  end
```

---

## System Architecture Levels

```mermaid
C4Container
    title Container Diagram for T.A.S.K.S. and S.L.A.P.S.
    
    Person(dev, "Developer", "Uses Wesley CLI")
    
    Container_Boundary(wesley, "Wesley System") {
        Container(cli, "CLI", "Pure JavaScript", "Command interface")
        Container(tasks, "T.A.S.K.S.", "Pure JavaScript", "DAG planning")
        Container(slaps, "S.L.A.P.S.", "Pure JavaScript", "Execution engine")
        Container(journal, "Journal", "JSON/SQLite", "Execution state")
    }
    
    System_Ext(generators, "Generators", "Code emission plugins")
    System_Ext(filesystem, "File System", "Output destination")
    
    Rel(dev, cli, "Executes commands")
    Rel(cli, tasks, "Builds execution plan")
    Rel(tasks, slaps, "Provides DAG")
    Rel(slaps, journal, "Reads/writes state")
    Rel(slaps, generators, "Invokes")
    Rel(generators, filesystem, "Writes artifacts")
```

---

## Detailed Documentation

- [T.A.S.K.S. Deep Dive →](./01-tasks-overview.md)
- [S.L.A.P.S. Deep Dive →](./02-slaps-overview.md)
- [Integration Guide →](./03-integration-patterns.md)