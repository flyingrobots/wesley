# CADET: Wesley Production Implementation

> **C**omprehensive **A**rchitecture **D**ocumentation for **E**xecution & **T**esting

## Executive Summary

Wesley is evolving from a GraphQL-to-PostgreSQL compiler into a production-grade database migration and code generation platform. This CADET documentation captures the complete vision, implementation plan, and technical specifications for making Wesley the "adult in the room" for database operations.

### Mission Critical Objectives

1. **Zero-Downtime Migrations** - All DDL operations use online, lock-aware strategies by default
2. **Schema-First Development** - GraphQL SDL as single source of truth for types, database, and validation
3. **Production Safety Rails** - Advisory locks, drift detection, and checkpoint recovery built-in
4. **Boring Reliability** - No surprises, no 3am pages, just predictable execution

### Key Deliverables

- **DDL Planner** with automatic safe operation rewriting
- **Streaming SQL Executor** with transaction awareness
- **Watch Mode** with incremental compilation
- **Schema Linting** via GraphQL ESLint
- **Dead Column Detection** using pg_stat_statements
- **TypeScript & Zod Generation** from GraphQL schema
- **Production CLI** with explain mode and dry-run

## Master of Contents

### Core Documentation

1. **[Architecture Overview](./01-architecture.md)** - System design and component interactions
2. **[DDL Safety Guide](./02-ddl-safety.md)** - Lock management and online operations
3. **[Execution Models](./03-execution-models.md)** - Wave-based vs Rolling Frontier
4. **[Resource Management](./04-resource-management.md)** - Handling exclusive resources and constraints
5. **[Testing Strategy](./05-testing-strategy.md)** - Property-based, snapshot, and round-trip testing
6. **[CLI Reference](./06-cli-reference.md)** - Complete command documentation
7. **[Roadmap](./07-roadmap.md)** - Phased implementation plan

### Technical Specifications

- **[DDL Planner Spec](./specs/ddl-planner.md)** - Detailed planner implementation
- **[SQL Executor Spec](./specs/sql-executor.md)** - Streaming execution with transactions
- **[Coordinator Spec](./specs/coordinator.md)** - Rolling frontier orchestration
- **[Schema Drift Spec](./specs/schema-drift.md)** - Runtime validation

### User Stories & Requirements

- **[User Stories](./requirements/user-stories.md)** - Feature requirements with acceptance criteria
- **[Definition of Done](./requirements/definition-of-done.md)** - Completion criteria for all work
- **[Scope Boundaries](./requirements/scope.md)** - What's in and out of scope

### T.A.S.K.S. Execution Artifacts

- **[features.json](./TASKS/features.json)** - High-level capabilities
- **[tasks.json](./TASKS/tasks.json)** - Detailed task definitions
- **[dag.json](./TASKS/dag.json)** - Dependency graph
- **[waves.json](./TASKS/waves.json)** - Execution strategies
- **[coordinator.json](./TASKS/coordinator.json)** - Orchestration config
- **[Plan.md](./TASKS/Plan.md)** - Human-readable execution plan
- **[Decisions.md](./TASKS/Decisions.md)** - Design decisions with rationale

## Quick Start

### For Developers

```bash
# Clone and setup
git clone https://github.com/your-org/wesley
cd wesley/packages/wesley-core
npm install

# Run tests to verify setup
npm test

# Start watch mode for development
npm run watch
```

### For Production Teams

```bash
# Install Wesley CLI
npm install -g @wesley/cli

# Generate migration with safety analysis
wesley migrate generate --explain --dry-run

# Execute with online DDL (default)
wesley migrate execute

# Force unsafe operations (requires confirmation)
wesley migrate execute --unsafe
```

## Technology Stack

### Core Dependencies
- **Node.js 18+** - ESM modules throughout
- **PostgreSQL 11+** - For instant ADD COLUMN DEFAULT
- **GraphQL.js** - Schema parsing and validation
- **pgsql-parser** - libpg_query for SQL validation
- **chokidar** - File watching with atomic saves
- **Zod** - Runtime validation

### Development Dependencies
- **@graphql-eslint** - Schema linting
- **fast-check** - Property-based testing
- **vitest** - Snapshot testing

## Production Guarantees

### What Wesley Promises

✅ **No blocking DDL by default** - All operations use CONCURRENTLY or NOT VALID patterns  
✅ **Transactional safety** - Advisory locks prevent concurrent migrations  
✅ **Checkpoint recovery** - Resume failed migrations from last good state  
✅ **Schema drift detection** - Runtime hash validation catches mismatches  
✅ **Resource awareness** - Automatic mutex handling for exclusive resources  

### What Wesley Won't Do

❌ **Magic performance** - We show lock levels, you decide timing  
❌ **Automatic rollbacks** - Provides tools, requires human decision  
❌ **Cross-table computed columns** - Uses triggers, not GENERATED  
❌ **Ignore Postgres limits** - One CIC per table, respects all constraints  

## Risk Mitigation

### High-Risk Operations
- **DROP TABLE/COLUMN** - Requires `--unsafe` flag
- **Type changes** - Generates shadow column strategy
- **NOT NULL additions** - Uses 3-phase approach

### Safety Mechanisms
- Lock timeout: 5 seconds default
- Statement timeout: 30 seconds default
- Advisory locks: Transaction-scoped
- Dry-run mode: Always available
- Explain mode: Shows exact lock impact

## Success Metrics

### Phase 1 (Foundation)
- [ ] DDL Planner with CIC orchestration
- [ ] SQL Executor with streaming
- [ ] Basic migration safety rails
- [ ] 12/14 tests passing (current: achieved)

### Phase 2 (Developer Experience)
- [ ] Watch mode with chokidar
- [ ] GraphQL ESLint integration
- [ ] Schema drift detection
- [ ] TypeScript/Zod generation

### Phase 3 (Production Ready)
- [ ] Dead column detection
- [ ] Resource bottleneck analysis
- [ ] Checkpoint/resume capability
- [ ] Production CLI with all flags

### Phase 4 (Scale)
- [ ] Rolling frontier execution
- [ ] Distributed coordinator
- [ ] Multi-database support
- [ ] Cloud deployment integration

## Team & Contributions

### Core Team
- **James** - Architecture & Vision
- **Claude** - Implementation & Documentation

### Contributing
See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

[MIT](../../LICENSE) - Because boring is beautiful.

---

## Navigation

**Next: [Architecture Overview →](./01-architecture.md)**

**Quick Links:**
- [DDL Safety Guide](./02-ddl-safety.md)
- [CLI Reference](./06-cli-reference.md)
- [User Stories](./requirements/user-stories.md)
- [T.A.S.K.S. Plan](./TASKS/Plan.md)