# Scope Boundaries

## Executive Summary

This document clearly defines what is included and excluded from Wesley's production implementation scope. It serves as a reference for decision-making and prevents scope creep.

## In Scope

### Core Functionality

#### Schema Management
- ✅ GraphQL SDL as source of truth
- ✅ Custom directives for database features
- ✅ Schema validation and linting
- ✅ Introspection and drift detection
- ✅ Version tracking and hashing

#### DDL Generation
- ✅ PostgreSQL 11+ DDL generation
- ✅ Lock-aware operation planning
- ✅ Safe pattern transformations
- ✅ Transaction management
- ✅ Streaming SQL execution

#### Migration Safety
- ✅ CREATE INDEX CONCURRENTLY orchestration
- ✅ NOT VALID → VALIDATE pattern
- ✅ Advisory lock management
- ✅ Timeout configuration
- ✅ Rollback script generation

#### Type Generation
- ✅ TypeScript type definitions
- ✅ Zod runtime validators
- ✅ GraphQL Code Generator integration
- ✅ Custom scalar mapping
- ✅ Tree-shaking optimization

#### Developer Experience
- ✅ Watch mode with hot reload
- ✅ CLI with comprehensive commands
- ✅ Progress monitoring
- ✅ Explain and dry-run modes
- ✅ Structured error messages

#### Testing
- ✅ pgTAP test generation
- ✅ Property-based testing support
- ✅ Snapshot testing
- ✅ Integration test framework
- ✅ Performance benchmarks

### Target Databases

#### Supported
- ✅ PostgreSQL 11
- ✅ PostgreSQL 12
- ✅ PostgreSQL 13
- ✅ PostgreSQL 14
- ✅ PostgreSQL 15
- ✅ PostgreSQL 16
- ✅ Supabase (all versions)
- ✅ Amazon RDS PostgreSQL
- ✅ Google Cloud SQL PostgreSQL

#### Features
- ✅ Regular tables
- ✅ Partitioned tables
- ✅ Materialized views
- ✅ Indexes (B-tree, GiST, GIN, etc.)
- ✅ Foreign keys
- ✅ Check constraints
- ✅ Unique constraints
- ✅ Row-level security
- ✅ Triggers
- ✅ Functions (limited)

### Deployment Environments

- ✅ Local development
- ✅ Docker containers
- ✅ CI/CD pipelines
- ✅ Staging environments
- ✅ Production systems
- ✅ Multi-tenant SaaS
- ✅ Single-tenant enterprise

### Integration Points

- ✅ Node.js 18+ applications
- ✅ GraphQL servers
- ✅ REST APIs
- ✅ Serverless functions
- ✅ GitHub Actions
- ✅ GitLab CI
- ✅ Jenkins
- ✅ Command line

## Out of Scope

### Databases Not Supported

#### Other SQL Databases
- ❌ MySQL/MariaDB
- ❌ Microsoft SQL Server
- ❌ Oracle Database
- ❌ SQLite
- ❌ CockroachDB
- ❌ YugabyteDB

#### NoSQL Databases
- ❌ MongoDB
- ❌ DynamoDB
- ❌ Cassandra
- ❌ Redis
- ❌ Elasticsearch

### PostgreSQL Features Not Supported

#### Advanced Features
- ❌ Foreign Data Wrappers (FDW)
- ❌ Logical Replication setup
- ❌ Custom operators
- ❌ Custom types (beyond enums)
- ❌ Extensions management
- ❌ Tablespace management

#### Administrative Operations
- ❌ User/role management
- ❌ Permission grants
- ❌ Database creation/deletion
- ❌ Backup and restore
- ❌ Performance tuning
- ❌ Configuration management

### Application Features

#### Data Operations
- ❌ Data migration/ETL
- ❌ Seed data management
- ❌ Data validation beyond schema
- ❌ Business logic implementation
- ❌ API endpoint generation
- ❌ Authentication/authorization logic

#### ORM Features
- ❌ Query builder
- ❌ Model definitions
- ❌ Associations/relations API
- ❌ Lazy loading
- ❌ Connection pooling
- ❌ Transaction management (application-level)

### Development Tools

#### Not Included
- ❌ Visual schema designer
- ❌ Web-based UI
- ❌ Database client/browser
- ❌ Query analyzer
- ❌ Performance profiler
- ❌ Log analyzer

#### Not Integrated
- ❌ Prisma
- ❌ TypeORM
- ❌ Sequelize
- ❌ Knex
- ❌ Hasura
- ❌ PostGraphile

## Gray Areas (Require Decision)

### Potentially In Scope

These items require explicit decision before implementation:

#### Schema Features
- ⚠️ Computed columns (GENERATED)
- ⚠️ Domain types
- ⚠️ Composite types
- ⚠️ Array types
- ⚠️ JSON/JSONB operations

#### Migration Features
- ⚠️ Data backfill operations
- ⚠️ Cross-database migrations
- ⚠️ Schema renaming
- ⚠️ Data transformation during migration

#### Monitoring
- ⚠️ Performance metrics collection
- ⚠️ Query analysis
- ⚠️ Lock monitoring
- ⚠️ Slow query detection

#### Multi-tenancy
- ⚠️ Schema-per-tenant generation
- ⚠️ Dynamic tenant creation
- ⚠️ Cross-tenant migrations
- ⚠️ Tenant data isolation verification

## Scope Change Process

### Requesting Scope Change

1. **Identify Need**
   - Clear problem statement
   - Business justification
   - User impact assessment

2. **Document Request**
   - What: Specific feature/change
   - Why: Business value
   - When: Timeline requirements
   - Impact: Resources needed

3. **Evaluate Impact**
   - Technical feasibility
   - Resource requirements
   - Timeline impact
   - Risk assessment

4. **Decision Process**
   - Team discussion
   - Cost/benefit analysis
   - Stakeholder approval
   - Documentation update

### Approval Levels

| Change Size | Approver | Timeline |
|------------|----------|----------|
| Minor (< 8h) | Tech Lead | 1 day |
| Medium (8-40h) | Product Owner | 3 days |
| Major (> 40h) | Stakeholders | 1 week |
| Strategic | Executive | 2 weeks |

## Guiding Principles

### Include If

1. **Core to Migration Safety**
   - Prevents data loss
   - Avoids downtime
   - Ensures correctness

2. **PostgreSQL Standard**
   - Part of SQL standard
   - Widely used feature
   - Well-documented

3. **Developer Productivity**
   - Saves significant time
   - Reduces error rates
   - Improves experience

### Exclude If

1. **Database-Specific**
   - Proprietary extensions
   - Non-portable features
   - Version-specific

2. **Application Logic**
   - Business rules
   - Data validation
   - Computation logic

3. **Operational Concerns**
   - Infrastructure management
   - Security policies
   - Backup strategies

## Version-Specific Boundaries

### PostgreSQL Version Features

#### PG11+ Required
- Instant column defaults (constants)
- Partitioning improvements
- Covering indexes

#### PG12+ Optional
- Generated columns
- JSON path expressions
- CTE materialization control

#### PG13+ Optional
- Parallel vacuum
- Incremental sorting
- Hash aggregation improvements

#### PG14+ Optional
- Multirange types
- SEARCH and CYCLE
- Connection slots

## Integration Boundaries

### What Wesley Provides

#### Inputs
- GraphQL SDL files
- Configuration files
- Command-line arguments
- Environment variables

#### Outputs
- SQL DDL scripts
- TypeScript types
- Zod validators
- Test files
- Migration plans
- Rollback scripts

### What Wesley Expects

#### From Environment
- PostgreSQL connection
- Node.js 18+ runtime
- psql client available
- File system access
- Network connectivity

#### From User
- Valid GraphQL schemas
- Proper directives
- Connection credentials
- Resource allocation

## Non-Functional Boundaries

### Performance Targets

#### Included
- ✅ < 1s compilation for 100 tables
- ✅ < 500ms planning time
- ✅ Streaming for unlimited size
- ✅ < 200ms watch mode response

#### Not Guaranteed
- ❌ Sub-second migrations
- ❌ Real-time synchronization
- ❌ Zero-memory operations
- ❌ Offline operation

### Scale Limits

#### Tested Limits
- ✅ 1,000 tables
- ✅ 10,000 columns
- ✅ 100,000 indexes
- ✅ 1GB schema size

#### Not Tested
- ❌ 10,000+ tables
- ❌ 100,000+ columns
- ❌ Multi-GB schemas
- ❌ 1,000+ concurrent operations

## Summary Matrix

| Category | In Scope | Out of Scope |
|----------|----------|--------------|
| **Databases** | PostgreSQL 11+ | MySQL, NoSQL |
| **Operations** | DDL, Migrations | DML, Admin |
| **Safety** | Locks, Rollback | Backups, HA |
| **Types** | TypeScript, Zod | ORM Models |
| **Testing** | pgTAP, Unit | Load, Security |
| **UI** | CLI | Web, Desktop |
| **Integration** | GraphQL | REST, gRPC |
| **Deployment** | SQL Scripts | Infrastructure |

---

**[← Back to Definition of Done](./definition-of-done.md)** | **[↑ Back to README](../README.md)**