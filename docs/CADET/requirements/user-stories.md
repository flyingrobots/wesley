# User Stories & Acceptance Criteria

## Epic: Production-Grade Database Migrations

### Story 1: Safe Index Creation
**As a** database administrator  
**I want** to create indexes without blocking production traffic  
**So that** I can optimize queries without downtime  

#### Acceptance Criteria
- [ ] System automatically uses CREATE INDEX CONCURRENTLY for all index operations
- [ ] CIC operations run outside transaction blocks
- [ ] Only one CIC operation per table can run at a time
- [ ] System detects and handles partitioned tables with proper index attachment
- [ ] Lock level shown as SHARE UPDATE EXCLUSIVE in explain mode
- [ ] Progress monitoring shows index build phases

#### Definition of Done
- All index creation uses CONCURRENTLY by default
- Tests verify CIC runs outside transactions
- Documentation explains lock impact
- Monitoring shows index build progress

---

### Story 2: Zero-Downtime Foreign Key Addition
**As a** developer  
**I want** to add foreign keys without locking tables  
**So that** I can enforce referential integrity safely  

#### Acceptance Criteria
- [ ] FK additions use NOT VALID pattern automatically
- [ ] Validation scheduled for low-traffic window
- [ ] System shows estimated validation time
- [ ] Circular FKs handled with DEFERRABLE
- [ ] Partitioned table FKs handled correctly (no NOT VALID)
- [ ] Rollback script generated automatically

#### Definition of Done
- Two-phase FK addition implemented
- Validation window configurable
- Tests cover normal and circular FKs
- Documentation explains validation timing

---

### Story 3: Column Addition with Defaults
**As a** developer  
**I want** to add columns with defaults efficiently  
**So that** I can extend schemas without table rewrites  

#### Acceptance Criteria
- [ ] Constant defaults use PG11+ instant addition
- [ ] Volatile defaults use multi-step approach
- [ ] System detects PostgreSQL version automatically
- [ ] Backfill operations run in configurable batches
- [ ] Progress tracking for backfill operations
- [ ] NOT NULL added only after backfill complete

#### Definition of Done
- Version detection implemented
- Batch size configurable
- Tests verify no table rewrite for constants
- Performance metrics collected

---

### Story 4: Migration Safety Analysis
**As a** team lead  
**I want** to preview migration impact before execution  
**So that** I can schedule maintenance windows appropriately  

#### Acceptance Criteria
- [ ] --explain shows lock level for each operation
- [ ] --dry-run generates complete SQL without execution
- [ ] Risk score calculated for migration
- [ ] Time estimates provided per operation
- [ ] Resource conflicts identified
- [ ] Suggested execution schedule provided

#### Definition of Done
- Explain mode shows all lock levels
- Risk scoring algorithm documented
- Time estimates based on table size
- Report exportable as JSON/Markdown

---

### Story 5: Checkpoint Recovery
**As an** operations engineer  
**I want** to resume failed migrations from checkpoints  
**So that** I don't lose progress on long operations  

#### Acceptance Criteria
- [ ] Checkpoints created at 25%, 50%, 75% progress
- [ ] State serialized to filesystem
- [ ] Resume command picks up from last checkpoint
- [ ] Checkpoint cleanup after successful completion
- [ ] Rollback possible from any checkpoint
- [ ] Checkpoint storage location configurable

#### Definition of Done
- Checkpoint manager implemented
- Resume tested with actual failures
- Storage format documented
- Cleanup verified

---

### Story 6: Schema Drift Detection
**As a** DevOps engineer  
**I want** runtime validation of schema state  
**So that** I catch configuration drift early  

#### Acceptance Criteria
- [ ] Schema hash calculated deterministically
- [ ] Runtime introspection compares with compiled hash
- [ ] Clear error message on drift detection
- [ ] Fix command suggested in error
- [ ] Drift report shows exact differences
- [ ] CI/CD integration documented

#### Definition of Done
- Hash algorithm deterministic across runs
- Drift detection runs on startup
- Tests verify drift catching
- Integration guide written

---

### Story 7: Dead Column Detection
**As a** database administrator  
**I want** to identify unused columns  
**So that** I can clean up technical debt safely  

#### Acceptance Criteria
- [ ] pg_stat_statements analyzed for column usage
- [ ] Confidence levels (LOW/MEDIUM/HIGH) assigned
- [ ] Sample size affects confidence calculation
- [ ] JSON report generated with findings
- [ ] Exclude list for known-unused columns
- [ ] Historical tracking of usage patterns

#### Definition of Done
- Parser handles normalized queries
- Confidence algorithm documented
- Report includes remediation suggestions
- False positive rate < 5%

---

### Story 8: Watch Mode Development
**As a** developer  
**I want** automatic recompilation on schema changes  
**So that** I get immediate feedback during development  

#### Acceptance Criteria
- [ ] File changes detected within 200ms
- [ ] Debouncing prevents multiple compilations
- [ ] Atomic saves handled correctly
- [ ] Lint → Compile → Test pipeline
- [ ] Error notifications to console
- [ ] Excluded paths configurable

#### Definition of Done
- Chokidar integrated with proper settings
- Debounce timing configurable
- Tests verify compilation triggers
- Performance acceptable (< 1s for 50 tables)

---

### Story 9: TypeScript & Zod Generation
**As a** full-stack developer  
**I want** type-safe interfaces generated from schema  
**So that** I have compile-time safety across the stack  

#### Acceptance Criteria
- [ ] TypeScript types match GraphQL schema exactly
- [ ] Zod validators generated for all inputs
- [ ] Custom scalars mapped correctly
- [ ] Enums generated as const objects
- [ ] Import paths configurable
- [ ] Tree-shaking friendly output

#### Definition of Done
- GraphQL Code Generator configured
- All types have Zod validators
- Tests verify type correctness
- Bundle size optimized

---

### Story 10: Production CLI
**As an** operations engineer  
**I want** comprehensive CLI tools  
**So that** I can manage migrations in production  

#### Acceptance Criteria
- [ ] wesley migrate generate creates migrations
- [ ] wesley migrate execute runs with safety checks
- [ ] wesley migrate rollback reverses changes
- [ ] wesley migrate status shows current state
- [ ] --unsafe flag required for dangerous operations
- [ ] All commands support --json output

#### Definition of Done
- All commands implemented
- Help text comprehensive
- Exit codes documented
- Shell completion available

---

## Epic: Multi-Tenant Support

### Story 11: Tenant Isolation via RLS
**As a** SaaS provider  
**I want** automatic row-level security policies  
**So that** tenant data is isolated by default  

#### Acceptance Criteria
- [ ] @tenant directive generates RLS policies
- [ ] Policies use auth.jwt_claim('org_id')
- [ ] Helper functions created for tenant context
- [ ] Indexes added on tenant columns
- [ ] Policy bypass for migrations
- [ ] Test coverage for isolation

#### Definition of Done
- RLS policies enforced automatically
- Performance acceptable with indexes
- Tests verify tenant isolation
- Documentation includes examples

---

### Story 12: Schema-per-Tenant Mode
**As an** enterprise provider  
**I want** separate schemas per tenant  
**So that** I can guarantee complete isolation  

#### Acceptance Criteria
- [ ] Schema creation automated
- [ ] Connection routing by tenant
- [ ] Migration runs across all schemas
- [ ] Tenant onboarding scripted
- [ ] Backup/restore per tenant
- [ ] Resource limits enforced

#### Definition of Done
- Schema management automated
- Performance scales to 1000 tenants
- Monitoring per schema
- Disaster recovery tested

---

## Epic: Testing & Quality

### Story 13: Property-Based Testing
**As a** quality engineer  
**I want** comprehensive fuzz testing  
**So that** edge cases are caught automatically  

#### Acceptance Criteria
- [ ] Fast-check generates random schemas
- [ ] All generators tested with random input
- [ ] SQL output validates with parser
- [ ] Round-trip stability verified
- [ ] Shrinking finds minimal failures
- [ ] Coverage metrics tracked

#### Definition of Done
- 1000+ random schemas tested
- No crashes on valid input
- Shrinking implemented
- CI runs property tests

---

### Story 14: Snapshot Testing
**As a** developer  
**I want** golden file testing  
**So that** output changes are intentional  

#### Acceptance Criteria
- [ ] Vitest snapshots for all generators
- [ ] Snapshots version controlled
- [ ] Update mechanism documented
- [ ] Diff output on failures
- [ ] Fixtures cover all features
- [ ] CI validates snapshots

#### Definition of Done
- All generators have snapshots
- Update process documented
- Review process defined
- No accidental changes

---

## Epic: Performance & Scale

### Story 15: Streaming SQL Execution
**As a** DBA  
**I want** memory-efficient SQL execution  
**So that** large schemas don't cause OOM  

#### Acceptance Criteria
- [ ] SQL streams to psql stdin
- [ ] No full schema in memory
- [ ] Progress reported per operation
- [ ] Partial results on failure
- [ ] Resource usage monitored
- [ ] Backpressure handled

#### Definition of Done
- 10GB+ schemas handled
- Memory usage constant
- Tests verify streaming
- Monitoring integrated

---

### Story 16: Incremental Compilation
**As a** developer  
**I want** fast incremental builds  
**So that** large projects remain responsive  

#### Acceptance Criteria
- [ ] Only changed files recompiled
- [ ] Dependency graph tracked
- [ ] Cache invalidation correct
- [ ] Hash-based change detection
- [ ] Parallel compilation where possible
- [ ] Cache persistence between runs

#### Definition of Done
- < 100ms for single file change
- Cache hit rate > 90%
- Tests verify correctness
- Performance benchmarked

---

## Non-Functional Requirements

### Performance
- Compilation: < 1s for 100 tables
- Migration planning: < 500ms
- Schema drift check: < 100ms
- Watch mode reaction: < 200ms

### Reliability
- Zero data loss on failure
- Checkpoint recovery tested
- Rollback always possible
- Advisory locks prevent races

### Security
- No credentials in code
- SQL injection prevented
- Audit logging available
- Secrets redacted in logs

### Usability
- Clear error messages
- Suggested fixes provided
- Progress indicators everywhere
- --help comprehensive

### Compatibility
- PostgreSQL 11+ supported
- Node.js 18+ required
- Linux/Mac/Windows tested
- Docker-friendly

---

**Next: [Definition of Done →](./definition-of-done.md)**

**[← Back to README](../README.md)**