# Design Decisions & Rationale

## Executive Summary

This document captures the key design decisions made for Wesley's production implementation, including the rationale, alternatives considered, and implications of each choice.

## Decision Log

### D001: JavaScript Over TypeScript

**Decision**: Keep Wesley implementation in JavaScript (ES modules) rather than TypeScript

**Rationale**:
- Faster iteration cycles during development
- No build step required for core functionality
- Simpler debugging and stack traces
- Team expertise in JavaScript
- Wesley generates TypeScript for consumers

**Alternatives Considered**:
- Full TypeScript implementation
- Hybrid approach (TS for types, JS for logic)

**Implications**:
- Must maintain JSDoc for type hints
- Runtime type checking via Zod where critical
- IDE support slightly reduced

**Status**: APPROVED

---

### D002: Streaming SQL Execution

**Decision**: Stream SQL to psql stdin rather than using node-postgres

**Rationale**:
- No memory limits on schema size
- Native PostgreSQL client compatibility
- Better handling of CIC and transaction boundaries
- Simpler error handling for DDL operations

**Alternatives Considered**:
- node-postgres with prepared statements
- Direct libpq bindings
- REST API to PostgreSQL

**Implications**:
- Dependency on psql binary
- Process spawning overhead
- Output parsing complexity

**Status**: APPROVED

---

### D003: Rolling Frontier Execution Model

**Decision**: Use rolling frontier instead of wave-based execution

**Rationale**:
- 35% faster completion (120h vs 185h)
- 65% resource utilization vs 40%
- Adaptive to actual task durations
- No artificial synchronization barriers

**Alternatives Considered**:
- Wave-based synchronous execution
- Pure parallel execution
- Manual task scheduling

**Implications**:
- More complex monitoring required
- Checkpoint system critical
- Higher cognitive load for operators

**Status**: APPROVED

---

### D004: Transaction-Scoped Advisory Locks

**Decision**: Use pg_advisory_xact_lock with SHA256 key generation

**Rationale**:
- Auto-release on commit/rollback
- No manual cleanup required
- Stable key generation across runs
- Prevents concurrent migrations naturally

**Alternatives Considered**:
- Session-level advisory locks
- Application-level locking
- Database flag tables

**Implications**:
- Must be inside transaction
- Key collision possibility (minimal)
- PostgreSQL-specific solution

**Status**: APPROVED

---

### D005: GraphQL as Schema Source

**Decision**: Use GraphQL SDL as single source of truth

**Rationale**:
- Industry standard schema language
- Rich directive system for extensions
- Excellent tooling ecosystem
- Type-safe by design

**Alternatives Considered**:
- Custom DSL
- JSON Schema
- TypeScript interfaces
- SQL DDL directly

**Implications**:
- Must translate GraphQL types to SQL
- Custom directives for database features
- Learning curve for SQL developers

**Status**: APPROVED

---

### D006: CIC Outside Transactions

**Decision**: Run CREATE INDEX CONCURRENTLY outside transaction blocks

**Rationale**:
- PostgreSQL requirement for CIC
- Allows concurrent reads and writes
- Production-safe index creation

**Alternatives Considered**:
- Regular CREATE INDEX in low-traffic windows
- Deferred index creation
- External index building tools

**Implications**:
- Complex orchestration logic
- Cannot rollback automatically
- One CIC per table limit

**Status**: APPROVED

---

### D007: NOT VALID → VALIDATE Pattern

**Decision**: Use NOT VALID for constraints with separate validation

**Rationale**:
- Instant constraint addition
- Validation in low-traffic windows
- No table locking during addition

**Alternatives Considered**:
- Direct constraint addition
- Check constraints as alternative
- Application-level validation only

**Implications**:
- Two-phase deployment
- Validation scheduling complexity
- Not available for partitioned tables

**Status**: APPROVED

---

### D008: File-per-Class Architecture

**Decision**: Enforce one class per file rule

**Rationale**:
- Single Responsibility Principle
- Easier navigation and maintenance
- Better git history
- Clearer dependencies

**Alternatives Considered**:
- Module-based grouping
- Feature-based organization
- Keep current multi-class files

**Implications**:
- More files to manage
- Import statement verbosity
- Potential circular dependencies

**Status**: APPROVED

---

### D009: Checkpoint-Based Recovery

**Decision**: Implement filesystem-based checkpointing

**Rationale**:
- Simple and reliable
- No external dependencies
- Fast recovery times
- Debugging-friendly

**Alternatives Considered**:
- Database state storage
- Redis-based checkpoints
- In-memory only

**Implications**:
- Filesystem I/O overhead
- Cleanup management
- Storage space requirements

**Status**: APPROVED

---

### D010: Shadow Column Strategy

**Decision**: Use shadow columns for type migrations

**Rationale**:
- Zero-downtime type changes
- Gradual migration possible
- Rollback capability maintained
- No table rewrites

**Alternatives Considered**:
- Direct ALTER COLUMN TYPE
- Application-level type coercion
- Blue-green deployments

**Implications**:
- Temporary storage overhead
- Trigger complexity
- Multi-step process

**Status**: APPROVED

---

### D011: Property-Based Testing

**Decision**: Add fast-check for generative testing

**Rationale**:
- Finds edge cases automatically
- Higher confidence in correctness
- Shrinking finds minimal failures
- Complements unit tests

**Alternatives Considered**:
- Exhaustive unit testing only
- Fuzzing with AFL
- Manual test case generation

**Implications**:
- Learning curve for property tests
- Longer test execution times
- Complex test debugging

**Status**: APPROVED

---

### D012: Chokidar for File Watching

**Decision**: Use chokidar instead of native fs.watch

**Rationale**:
- Cross-platform reliability
- Configurable and stable
- Handles edge cases well
- Active maintenance

**Alternatives Considered**:
- Native fs.watch/watchFile
- Watchman
- Custom polling solution

**Implications**:
- Additional dependency
- Configuration complexity
- Memory overhead

**Status**: APPROVED

---

### D013: SET LOCAL for Timeouts

**Decision**: Use SET LOCAL instead of psql variables

**Rationale**:
- Correct PostgreSQL behavior
- Transaction-scoped settings
- Auto-reset on commit/rollback
- No global side effects

**Alternatives Considered**:
- psql -v variables
- SET SESSION
- Application-level timeouts

**Implications**:
- Must be inside transaction
- Per-transaction overhead
- PostgreSQL-specific

**Status**: APPROVED

---

### D014: Schema Drift Detection

**Decision**: Implement deterministic schema hashing

**Rationale**:
- Catches configuration drift
- Prevents "works on my machine"
- CI/CD integration possible
- Fast validation

**Alternatives Considered**:
- Full schema introspection
- Checksum files
- Version tracking only

**Implications**:
- Hash stability requirements
- False positive possibility
- Runtime overhead

**Status**: APPROVED

---

### D015: Dead Column Detection

**Decision**: Analyze pg_stat_statements for usage

**Rationale**:
- Real usage data
- Confidence levels possible
- No application changes
- Historical data available

**Alternatives Considered**:
- Static code analysis
- Application logging
- Manual tracking

**Implications**:
- pg_stat_statements required
- Parser complexity
- False negative possibility

**Status**: APPROVED

---

## Design Principles

### 1. Boring Reliability
- Prefer proven patterns over clever solutions
- "Adult in the room" approach to production systems
- No surprises in production

### 2. Safety First
- Default to safe operations
- Require explicit flags for dangerous operations
- Make the right thing easy, wrong thing hard

### 3. Progressive Disclosure
- Simple things simple
- Complex things possible
- Advanced features behind flags

### 4. Observability
- Progress visible at all times
- Clear error messages with remediation
- Structured logging throughout

### 5. Resumability
- Every long operation checkpointed
- Failures recoverable
- State management explicit

## Trade-offs

### Performance vs Safety
- **Choice**: Safety
- **Rationale**: Data integrity > speed
- **Example**: CIC instead of regular index

### Flexibility vs Simplicity
- **Choice**: Simplicity with escape hatches
- **Rationale**: 80/20 rule
- **Example**: Sensible defaults with overrides

### Memory vs Speed
- **Choice**: Memory efficiency
- **Rationale**: Large schemas must work
- **Example**: Streaming instead of buffering

### Automation vs Control
- **Choice**: Automation with visibility
- **Rationale**: Reduce human error
- **Example**: Automatic safety patterns

## Risk Mitigations

### Technical Risks
1. **CIC Complexity**: Extensive testing, clear documentation
2. **Stream Handling**: Buffer management, backpressure
3. **Checkpoint Corruption**: Verification, redundancy
4. **Lock Conflicts**: Timeouts, monitoring

### Operational Risks
1. **Learning Curve**: Documentation, examples
2. **Migration Failures**: Rollback scripts, testing
3. **Performance Issues**: Benchmarks, profiling
4. **Resource Exhaustion**: Limits, monitoring

### Business Risks
1. **Adoption Barriers**: Migration guides, support
2. **Compatibility**: Version detection, fallbacks
3. **Maintenance**: Clean architecture, tests
4. **Evolution**: Extensible design, plugins

## Future Considerations

### Potential Enhancements
1. **AI-Assisted Planning**: ML for duration estimation
2. **Cloud Integration**: AWS RDS, Google Cloud SQL
3. **Multi-Database**: MySQL, SQLite support
4. **Visual Editor**: Web-based schema designer

### Technical Debt
1. **Refactoring**: Split multi-class files (Phase 6)
2. **Documentation**: Complete JSDoc coverage
3. **Testing**: 100% coverage target
4. **Performance**: Optimization opportunities

### Scaling Considerations
1. **Large Teams**: Concurrent development
2. **Multiple Environments**: Environment management
3. **CI/CD Integration**: GitHub Actions, GitLab
4. **Monitoring**: Prometheus, Grafana

## Conclusion

These decisions prioritize production reliability, developer experience, and maintainability. The chosen approaches favor "boring" solutions that work reliably at scale over clever optimizations that might fail unexpectedly.

The rolling frontier execution model with checkpoint recovery provides the best balance of performance and reliability for the production implementation of Wesley.

---

**[← Back to Plan](./Plan.md)** | **[↑ Back to README](../README.md)**