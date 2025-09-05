# S.L.A.P.S. - Stateful Linearized Asynchronous Processing System

## Overview

S.L.A.P.S. is Wesley's execution engine that takes T.A.S.K.S. plans and executes them with journaling, retry logic, and resource management to ensure reliable, resumable generation pipelines.

```mermaid
architecture-beta
    group journal[Journal System]
    group execution[Execution Core]
    group policies[Policy Engine]

    service memory(database)[Memory Journal] in journal
    service sqlite(database)[SQLite Journal] in journal
    service file(disk)[File Journal] in journal
    
    service runner(server)[Task Runner] in execution
    service scheduler(server)[Stage Scheduler] in execution
    service handlers(server)[Handler Registry] in execution
    
    service retry(server)[Retry Policy] in policies
    service timeout(server)[Timeout Policy] in policies
    service concurrency(server)[Concurrency Policy] in policies

    runner:R <--> L:memory
    runner:R <--> L:sqlite
    runner:R <--> L:file
    scheduler:B --> T:runner
    handlers:L --> R:runner
    retry:T --> B:scheduler
    timeout:L --> R:scheduler
    concurrency:R --> L:scheduler
```

---

## Execution State Machine

```mermaid
stateDiagram-v2
    [*] --> Initializing: Load plan
    
    Initializing --> LoadingJournal: Initialize journal
    LoadingJournal --> CheckingProgress: Read existing entries
    
    CheckingProgress --> ResumingExecution: Has incomplete tasks
    CheckingProgress --> StartingFresh: No prior execution
    
    StartingFresh --> ProcessingStage
    ResumingExecution --> ProcessingStage: Skip completed
    
    state ProcessingStage {
        [*] --> AcquiringResources
        AcquiringResources --> ExecutingTasks: Resources locked
        ExecutingTasks --> ReleasingResources: Tasks complete
        ReleasingResources --> [*]
    }
    
    ProcessingStage --> CheckingStage: Stage complete
    CheckingStage --> ProcessingStage: More stages
    CheckingStage --> Finalizing: All stages done
    
    ProcessingStage --> ErrorHandling: Task failed
    
    state ErrorHandling {
        [*] --> CheckingRetries
        CheckingRetries --> RetryingTask: Retries remaining
        CheckingRetries --> FailingTask: No retries left
        RetryingTask --> [*]: Backoff wait
        FailingTask --> [*]: Record failure
    }
    
    ErrorHandling --> ProcessingStage: Retry
    ErrorHandling --> Rollback: Critical failure
    
    Rollback --> [*]: Cleanup
    Finalizing --> Success
    Success --> [*]
```

---

## Journal Entry Structure

```mermaid
classDiagram
    class JournalEntry {
        +String id
        +String taskId
        +String planHash
        +Status status
        +Number attempt
        +Date startedAt
        +Date completedAt
        +Object result
        +Error error
        +Metadata metadata
    }
    
    class Status {
        <<enumeration>>
        PENDING
        IN_PROGRESS
        COMPLETED
        FAILED
        SKIPPED
        RETRYING
    }
    
    class Journal {
        <<interface>>
        +read(taskId) JournalEntry
        +write(entry) void
        +list(planHash) JournalEntry[]
        +clear(planHash) void
        +lock(taskId) Boolean
        +unlock(taskId) void
    }
    
    class MemoryJournal {
        -Map entries
        +read(taskId) JournalEntry
        +write(entry) void
    }
    
    class SQLiteJournal {
        -Database db
        +read(taskId) JournalEntry
        +write(entry) void
        +vacuum() void
    }
    
    class FileJournal {
        -String directory
        +read(taskId) JournalEntry
        +write(entry) void
        +rotate() void
    }
    
    JournalEntry --> Status
    Journal <|.. MemoryJournal
    Journal <|.. SQLiteJournal
    Journal <|.. FileJournal
```

---

## Performance Metrics

```mermaid
xychart-beta
    title "S.L.A.P.S. Execution Performance"
    x-axis ["1 stage", "5 stages", "10 stages", "20 stages", "50 stages"]
    y-axis "Time (seconds)" 0 --> 60
    bar "Sequential" [2, 10, 20, 40, 100]
    bar "Parallel (4 workers)" [2, 4, 7, 12, 28]
    bar "Parallel (8 workers)" [2, 3, 5, 8, 18]
    line "Journal Overhead" [0.1, 0.3, 0.5, 0.9, 2.1]
```

---

## Resource Utilization

```mermaid
treemap
    Execution Time Distribution: 1000
        Task Execution: 750
            Generator Invocation: 400
            File I/O: 200
            Validation: 150
        
        Journal Operations: 100
            Write Entries: 60
            Read Entries: 25
            Lock Management: 15
        
        Resource Management: 80
            Acquire Locks: 40
            Release Locks: 20
            Conflict Resolution: 20
        
        Error Handling: 70
            Retry Logic: 40
            Backoff Delays: 20
            Recovery: 10
```

---

## Retry Policy Configuration

```mermaid
radar
    title Retry Policy Characteristics
    x-axis "Conservative" --> "Aggressive"
    y-axis "Low" --> "High"
    
    "Max Attempts": [3, 8]
    "Initial Delay (ms)": [100, 2]
    "Max Delay (ms)": [30000, 7]
    "Backoff Factor": [2, 6]
    "Jitter": [0.3, 4]
    "Timeout (s)": [60, 9]
```

---

## Execution Flow Analysis

```mermaid
sankey-beta

"Plan Input",100,"Journal Check"
"Journal Check",20,"Resume Previous"
"Journal Check",80,"Start Fresh"

"Resume Previous",20,"Skip Completed"
"Start Fresh",80,"Stage 0"
"Skip Completed",5,"Stage 1"
"Skip Completed",10,"Stage 2"
"Skip Completed",5,"Stage 3"

"Stage 0",40,"Parallel Tasks"
"Stage 0",40,"Sequential Tasks"

"Stage 1",20,"Parallel Tasks"
"Stage 1",20,"Sequential Tasks"

"Stage 2",15,"Parallel Tasks"
"Stage 2",15,"Sequential Tasks"

"Stage 3",10,"Final Tasks"

"Parallel Tasks",75,"Success"
"Sequential Tasks",75,"Success"
"Final Tasks",10,"Success"

"Parallel Tasks",5,"Retry"
"Sequential Tasks",5,"Retry"
"Retry",8,"Success"
"Retry",2,"Failure"

"Success",160,"Output Artifacts"
"Failure",2,"Error Report"
```

---

## Concurrency Control

```mermaid
packet-beta
    title Task Execution Packet
    0-3: "Stage"
    4-11: "Task ID"
    12-15: "Worker"
    16-19: "Priority"
    20-23: "Retries"
    24-31: "Started"
    32-39: "Duration"
    40-47: "Memory"
    48-51: "Status"
    52-55: "Flags"
    56-63: "Result Hash"
```

---

## Stage Execution Kanban

```mermaid
kanban
    Queued
        task1[Generate DDL<br/>Resources: db:write<br/>Priority: High]
        task2[Generate RLS<br/>Resources: db:write<br/>Priority: High]
        task3[Generate Types<br/>Resources: fs:write<br/>Priority: Medium]
    
    Executing
        task4[Create Indexes<br/>Worker: #2<br/>Started: 10:30:15]
        task5[Generate Zod<br/>Worker: #1<br/>Started: 10:30:18]
    
    Journaling
        task6[Write Entry<br/>Task: create-tables<br/>Status: completed]
    
    Complete
        task7[Tables Created<br/>Duration: 1.2s<br/>Result: ✓]
        task8[Constraints Added<br/>Duration: 0.8s<br/>Result: ✓]
```

---

## Error Recovery Strategies

```mermaid
quadrantChart
    title Error Recovery Strategy Selection
    x-axis "Low Impact" --> "High Impact"
    y-axis "Easy Recovery" --> "Hard Recovery"
    quadrant-1 "Retry with backoff"
    quadrant-2 "Rollback & retry stage"
    quadrant-3 "Skip & continue"
    quadrant-4 "Fail fast & alert"
    
    "Network timeout": [0.3, 0.2]
    "File locked": [0.2, 0.3]
    "Generator error": [0.7, 0.6]
    "Out of memory": [0.8, 0.8]
    "Invalid schema": [0.9, 0.9]
    "Disk full": [0.6, 0.7]
    "Permission denied": [0.5, 0.5]
```

---

## Journal Storage Comparison

```mermaid
%%{init: {"theme": "dark"}}%%
C4Component
    title Journal Implementation Components
    
    Component_Boundary(journal, "Journal Implementations") {
        Component(memory, "Memory Journal", "JavaScript Map", "Fast, volatile")
        Component(sqlite, "SQLite Journal", "SQLite DB", "Persistent, queryable")
        Component(file, "File Journal", "JSON files", "Simple, portable")
        
        ComponentDb(memstore, "In-Memory Store", "Map<string, Entry>")
        ComponentDb(sqlitedb, "SQLite Database", "journal.db")
        ComponentDb(jsonfiles, "JSON Files", "./journal/*.json")
    }
    
    Rel(memory, memstore, "Stores in")
    Rel(sqlite, sqlitedb, "Persists to")
    Rel(file, jsonfiles, "Writes to")
```

---

## Execution Timeline

```mermaid
timeline
    title S.L.A.P.S. Execution Lifecycle
    
    section Initialization
        Load Plan : Parse T.A.S.K.S. output
        Setup Journal : Initialize persistence
        Load Handlers : Register generators
    
    section Execution
        Stage 0 : Foundation tasks
        Stage 1 : Core generation
        Stage 2 : Dependent tasks
        Stage N : Final tasks
    
    section Completion
        Finalize : Verify all complete
        Report : Generate summary
        Cleanup : Release resources
```

---

## API Usage Example

```typescript
// Using S.L.A.P.S. to execute a plan
import { Runner, SQLiteJournal, RetryPolicy } from '@wesley/slaps';

const journal = new SQLiteJournal('./journal.db');
const policy = new RetryPolicy({
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: 0.3
});

const runner = new Runner({
  journal,
  policy,
  concurrency: 4,
  timeout: 60000
});

// Execute plan from T.A.S.K.S.
const result = await runner.run(plan, handlers);

console.log(`Execution ${result.success ? 'succeeded' : 'failed'}`);
console.log(`Completed ${result.completed}/${result.total} tasks`);
```

---

## Next: [Integration Patterns →](./03-integration-patterns.md)