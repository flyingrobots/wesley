# Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph "Input Layer"
        GQL[GraphQL Schema SDL]
        DIR[Directives]
        CFG[wesley.config.js]
    end
    
    subgraph "Parser Layer"
        PARSER[GraphQL Parser]
        VALIDATOR[Schema Validator]
        LINTER[GraphQL ESLint]
    end
    
    subgraph "IR Layer"
        IR[Wesley IR]
        SCHEMA[Schema Model]
        EVIDENCE[Evidence Map]
    end
    
    subgraph "Planner Layer"
        DDLPLAN[DDL Planner]
        MIGPLAN[Migration Planner]
        SAFETY[Safety Analyzer]
    end
    
    subgraph "Generator Layer"
        SQLGEN[SQL Generator]
        TSGEN[TypeScript Generator]
        ZODGEN[Zod Generator]
        TESTGEN[pgTAP Test Generator]
    end
    
    subgraph "Executor Layer"
        EXECUTOR[SQL Executor]
        MONITOR[Progress Monitor]
        CHECKPOINT[Checkpoint Manager]
    end
    
    subgraph "Output Layer"
        SQL[PostgreSQL DDL]
        TS[TypeScript Types]
        ZOD[Zod Schemas]
        TESTS[pgTAP Tests]
    end
    
    GQL --> PARSER
    DIR --> PARSER
    CFG --> PARSER
    
    PARSER --> VALIDATOR
    VALIDATOR --> LINTER
    LINTER --> IR
    
    IR --> SCHEMA
    SCHEMA --> EVIDENCE
    
    SCHEMA --> DDLPLAN
    SCHEMA --> MIGPLAN
    DDLPLAN --> SAFETY
    MIGPLAN --> SAFETY
    
    SAFETY --> SQLGEN
    SCHEMA --> TSGEN
    SCHEMA --> ZODGEN
    SCHEMA --> TESTGEN
    
    SQLGEN --> EXECUTOR
    EXECUTOR --> MONITOR
    EXECUTOR --> CHECKPOINT
    
    EXECUTOR --> SQL
    TSGEN --> TS
    ZODGEN --> ZOD
    TESTGEN --> TESTS
```

## Component Details

### Input Layer

#### GraphQL Schema SDL
- **Purpose**: Single source of truth for data model
- **Format**: Standard GraphQL SDL with custom directives
- **Location**: `schema/**/*.graphql`
- **Example**:
```graphql
type User @table @tenant(column: "org_id") {
  id: ID! @primaryKey
  email: String! @unique
  org_id: ID! @index
  created_at: DateTime! @default(expr: "NOW()")
}
```

#### Custom Directives
- `@table` - Marks type for table generation
- `@tenant` - Multi-tenant configuration
- `@rls` - Row-level security policies
- `@index` - Index generation
- `@check` - Check constraints
- `@computed` - Computed columns

### Parser Layer

#### GraphQL Parser
- **Library**: graphql-js
- **Function**: Parse SDL into AST
- **Validation**: Schema validity, directive usage
- **Output**: GraphQLSchema object

#### Schema Validator
- **Purpose**: Validate Wesley-specific rules
- **Checks**:
  - Valid directive combinations
  - Type safety
  - Naming conventions
  - Circular reference detection

#### GraphQL ESLint
- **Purpose**: Enforce best practices
- **Rules**:
  - PascalCase types
  - camelCase fields
  - Required descriptions
  - No deprecated patterns

### IR Layer (Intermediate Representation)

#### Wesley IR Structure
```javascript
{
  tables: Map<string, Table>,
  operations: Map<string, Operation>,
  evidence: EvidenceMap,
  metadata: {
    version: string,
    hash: string,
    timestamp: Date
  }
}
```

#### Schema Model
- **Table**: Name, fields, constraints, policies
- **Field**: Type, nullability, directives
- **Constraint**: Primary key, foreign key, unique, check
- **Policy**: RLS rules per operation

#### Evidence Map
- **Purpose**: Track source locations for errors
- **Content**: File, line, column for each element
- **Usage**: Error reporting, debugging

### Planner Layer

#### DDL Planner Flow

```mermaid
flowchart LR
    START[Migration Steps] --> CLASSIFY[Classify Operations]
    CLASSIFY --> SAFE{Safe Operation?}
    
    SAFE -->|Yes| BATCH[Add to Transaction Batch]
    SAFE -->|No| REWRITE[Rewrite to Safe Version]
    
    REWRITE --> CIC{Index Operation?}
    CIC -->|Yes| NONTXN[Non-Transaction Phase]
    CIC -->|No| FK{FK/Check Constraint?}
    
    FK -->|Yes| NOTVALID[Add NOT VALID]
    FK --> VALIDATE[Schedule Validation]
    
    NOTVALID --> BATCH
    VALIDATE --> VALPHASE[Validation Phase]
    
    NONTXN --> PHASE1[Phase 1: CIC Operations]
    BATCH --> PHASE2[Phase 2: Transaction Batch]
    VALPHASE --> PHASE3[Phase 3: Validations]
    
    PHASE1 --> OUTPUT[Execution Plan]
    PHASE2 --> OUTPUT
    PHASE3 --> OUTPUT
```

#### Migration Planner
- **Diff Calculation**: Compare old vs new schema
- **Risk Assessment**: Calculate operation risk scores
- **Snapshot Generation**: Pre-flight snapshots for rollback
- **Dependency Ordering**: Ensure correct execution order

#### Safety Analyzer
- **Lock Analysis**: Determine lock levels for each operation
- **Resource Conflicts**: Identify exclusive resource needs
- **Time Estimation**: Calculate expected duration
- **Rollback Planning**: Generate compensating operations

### Generator Layer

#### SQL Generator
- **AST Building**: Create PostgreSQL AST nodes
- **Deparsing**: Convert AST to SQL strings
- **Features**:
  - Table DDL with all constraints
  - Index generation with CONCURRENTLY
  - RLS policy creation
  - Trigger generation for computed columns

#### TypeScript Generator
- **Source**: GraphQL schema
- **Output**: Type definitions
- **Integration**: GraphQL Code Generator
- **Features**:
  - Exact type mapping
  - Enum generation
  - Interface exports

#### Zod Generator
- **Purpose**: Runtime validation
- **Source**: GraphQL schema
- **Plugin**: @use-pico/graphql-codegen-zod
- **Features**:
  - Input validation schemas
  - Custom scalar handling
  - Composable validators

#### pgTAP Test Generator
- **Purpose**: Database testing
- **Coverage**:
  - Table existence
  - Column properties
  - Constraint validation
  - RLS policy testing
  - Performance checks

### Executor Layer

#### SQL Executor Design

```mermaid
sequenceDiagram
    participant CLI
    participant Executor
    participant Planner
    participant PSQL
    participant DB
    
    CLI->>Executor: Execute Migration
    Executor->>Planner: Get Execution Plan
    Planner-->>Executor: Phased Plan
    
    loop Phase 1: CIC Operations
        Executor->>PSQL: Spawn Process
        Executor->>PSQL: Stream CIC SQL
        PSQL->>DB: CREATE INDEX CONCURRENTLY
        DB-->>PSQL: Index Created
        PSQL-->>Executor: Success
    end
    
    Executor->>PSQL: BEGIN Transaction
    Executor->>DB: SET LOCAL timeouts
    Executor->>DB: pg_advisory_xact_lock()
    
    loop Phase 2: DDL Operations
        Executor->>PSQL: Stream DDL
        PSQL->>DB: Execute DDL
        DB-->>PSQL: Success
    end
    
    Executor->>PSQL: COMMIT
    
    loop Phase 3: Validations
        Executor->>PSQL: VALIDATE CONSTRAINT
        PSQL->>DB: Validate
        DB-->>PSQL: Validated
    end
    
    Executor-->>CLI: Migration Complete
```

#### Progress Monitor
- **Heartbeat**: Every 30 seconds
- **Checkpoints**: At 25%, 50%, 75%
- **Metrics**: Operations completed, time elapsed
- **Logging**: Structured JSON logs

#### Checkpoint Manager
- **State Capture**: Serialize execution state
- **Storage**: Local filesystem
- **Recovery**: Resume from checkpoint
- **Cleanup**: Remove after completion

## Data Flow

### Compilation Flow

```mermaid
graph LR
    SDL[schema.graphql] --> PARSE[Parse]
    PARSE --> VALIDATE[Validate]
    VALIDATE --> IR[Build IR]
    IR --> PLAN[Plan DDL]
    PLAN --> GEN[Generate SQL]
    GEN --> STREAM[Stream to DB]
```

### Migration Flow

```mermaid
graph LR
    OLD[Previous Schema] --> DIFF[Calculate Diff]
    NEW[Current Schema] --> DIFF
    DIFF --> RISK[Risk Analysis]
    RISK --> SAFE{Safe?}
    SAFE -->|Yes| EXECUTE[Execute]
    SAFE -->|No| REWRITE[Rewrite Operations]
    REWRITE --> EXECUTE
    EXECUTE --> VERIFY[Verify]
```

### Watch Mode Flow

```mermaid
graph LR
    WATCH[File Watcher] --> CHANGE{File Changed?}
    CHANGE -->|Yes| DEBOUNCE[Debounce]
    DEBOUNCE --> LINT[Lint Schema]
    LINT --> COMPILE[Compile]
    COMPILE --> TEST[Run Tests]
    TEST --> NOTIFY[Notify Result]
    NOTIFY --> WATCH
```

## Module Structure

```
packages/wesley-core/
├── src/
│   ├── cli/                    # CLI entry points
│   │   └── wesley.mjs          # Main CLI
│   ├── domain/                 # Core domain logic
│   │   ├── Schema.mjs          # Schema model
│   │   ├── DDLPlanner.mjs      # DDL planning
│   │   ├── MigrationSafety.mjs # Safety analysis
│   │   └── generators/         # Code generators
│   │       ├── PostgreSQLGenerator.mjs
│   │       ├── TypeScriptGenerator.mjs
│   │       └── PgTAPTestGenerator.mjs
│   ├── infrastructure/         # External integrations
│   │   ├── SQLExecutor.mjs     # Database execution
│   │   ├── FileWatcher.mjs     # Watch mode
│   │   └── CheckpointStore.mjs # State persistence
│   ├── application/            # Use cases
│   │   ├── Commands.mjs        # Command handlers
│   │   └── UseCases.mjs        # Business logic
│   └── ports/                  # Interfaces
│       └── Ports.mjs           # Port definitions
├── test/                       # Test files
├── docs/                       # Documentation
└── package.json
```

## Dependency Graph

```mermaid
graph TD
    CLI[CLI Layer] --> APP[Application Layer]
    APP --> DOMAIN[Domain Layer]
    APP --> PORTS[Ports Layer]
    PORTS --> INFRA[Infrastructure Layer]
    INFRA --> EXTERNAL[External Services]
    
    DOMAIN -.->|implements| PORTS
    
    EXTERNAL --> DB[(PostgreSQL)]
    EXTERNAL --> FS[File System]
    EXTERNAL --> PROC[Child Process]
```

## Technology Choices

### Core Technologies

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 18+ | ESM support, stable |
| Language | JavaScript | Simple, fast iteration |
| Schema | GraphQL | Industry standard |
| Database | PostgreSQL 11+ | Online DDL features |
| Parser | graphql-js | Reference implementation |
| SQL Parser | pgsql-parser | libpg_query accuracy |
| File Watch | chokidar | Reliable, configurable |
| Validation | Zod | Runtime type safety |

### Design Patterns

| Pattern | Usage | Benefit |
|---------|-------|---------|
| Command | CLI operations | Separation of concerns |
| Repository | Data access | Testability |
| Factory | Generator creation | Flexibility |
| Observer | Event handling | Loose coupling |
| Strategy | Execution models | Runtime selection |
| Template Method | Code generation | Consistency |

## Security Considerations

### Input Validation
- All SDL parsed and validated
- Directive arguments sanitized
- SQL injection prevention via AST

### Database Security
- Advisory locks prevent races
- Transaction isolation
- Timeout limits on all operations

### Secret Management
- No secrets in generated code
- Environment variables for credentials
- Redaction in logs

## Performance Characteristics

### Compilation Performance
- **Parse**: ~10ms per file
- **Validation**: ~5ms per table
- **Generation**: ~20ms per table
- **Total**: <1s for 50 tables

### Execution Performance
- **CIC**: 2-10x slower than regular index
- **NOT VALID FK**: Instant with later validation
- **ADD COLUMN DEFAULT**: Instant on PG11+
- **Streaming**: No memory limit on schema size

### Resource Usage
- **Memory**: ~100MB baseline
- **CPU**: Single core for planning
- **I/O**: Streaming minimizes disk usage
- **Network**: Single database connection

## Error Handling

### Error Categories
1. **Parse Errors**: Invalid SDL syntax
2. **Validation Errors**: Schema rule violations
3. **Planning Errors**: Impossible migrations
4. **Execution Errors**: Database failures
5. **Resource Errors**: Lock timeouts

### Error Recovery
- Checkpoint-based resume
- Transaction rollback
- Compensating operations
- Manual intervention guides

## Monitoring & Observability

### Metrics
- Migration duration
- Lock wait time
- Resource utilization
- Error rates
- Checkpoint success rate

### Logging
- Structured JSON
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs
- Performance timing

### Health Checks
- Database connectivity
- Schema drift detection
- Resource availability
- Worker pool status

---

**Next: [DDL Safety Guide →](./02-ddl-safety.md)**

**[← Back to README](./README.md)**