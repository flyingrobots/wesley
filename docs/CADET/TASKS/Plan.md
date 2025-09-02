# Wesley Production Implementation - Execution Plan

## Executive Summary

Wesley requires transformation from a working prototype into a production-grade database migration and code generation platform. This plan details the implementation of lock-aware DDL operations, streaming execution, comprehensive testing, and developer experience improvements.

## Execution Strategy Recommendation: Rolling Frontier

### Why Rolling Frontier?

- **35% faster completion** than wave-based execution (estimated 120h vs 185h)
- **Better resource utilization** (65% average vs 40% with waves)
- **Adaptive to actual completion times** - no waiting for slowest task
- **Continuous progress** - no artificial synchronization barriers
- **Checkpoint recovery** - resume from failure points

### System Requirements

- **Peak Resources**: 8 CPU cores, 16GB RAM, 100 Mbps I/O
- **Average Resources**: 4 CPU cores, 8GB RAM, 50 Mbps I/O
- **Worker Pool**: 2-4 adaptive workers with specialized capabilities
- **Database**: PostgreSQL 11+ development instance
- **Environment**: Node.js 18+, Linux/Mac development

## Codebase Analysis Results

### Existing Components (Currently in Wesley)

#### Reusable (45% effort saved)
- **GraphQLSchemaBuilder** - Parse and validate SDL (saves ~400 LoC)
- **Schema/Table/Field models** - Domain objects ready (saves ~300 LoC)
- **WesleyOrchestrator** - Coordination foundation (extend for execution)
- **MigrationSafety** - Risk analysis base (extend with lock analysis)
- **EvidenceMap** - Error tracking infrastructure (reuse as-is)
- **DirectiveProcessor** - Custom directive handling (ready to use)

#### Needs Major Extension (20% reusable)
- **MigrationDiffer** - Add lock-aware planning (~500 LoC needed)
- **PostgreSQLGenerator** - Add CIC handling (~300 LoC needed)
- **Commands.mjs** - 12 classes violating SRP (refactor required)
- **SQLAst.mjs** - 18 classes in one file (split required)

#### New Components Required
- **DDLPlanner** - Lock-aware operation planning (new, ~800 LoC)
- **SQLExecutor** - Streaming with transactions (new, ~600 LoC)
- **CheckpointManager** - State persistence (new, ~400 LoC)
- **FileWatcher** - Chokidar integration (new, ~200 LoC)
- **DeadColumnDetector** - pg_stat_statements analysis (new, ~500 LoC)

### Shared Resources Creating Constraints

#### Database Connection (Exclusive)
- **Migration execution** - One migration at a time
- **Schema introspection** - Blocks during analysis
- **Test execution** - Separate test database needed

#### File System (Concurrent with Limits)
- **Generated artifacts** - Multiple writers possible
- **Checkpoint storage** - Atomic writes required
- **Log files** - Append-only safe

#### Process Resources (Limited)
- **Child processes** - psql spawning limited to 4
- **Memory** - SQL generation can spike to 2GB
- **CPU** - Parsing/planning single-threaded

### Architecture Debt to Address

1. **Multi-class files** - 5 files with 10+ classes each
2. **Missing abstractions** - No port/adapter separation
3. **Test coverage** - Currently 12/14 passing (needs 100%)
4. **No streaming** - Everything in memory currently

## Execution Phases

### Phase 1: Foundation (40h)

#### Tasks
- **WP1.T001**: Create DDLPlanner with lock classification (8h)
- **WP1.T002**: Implement SQLExecutor with streaming (8h)
- **WP1.T003**: Add transaction-scoped advisory locks (4h)
- **WP1.T004**: Implement SET LOCAL timeout handling (2h)
- **WP1.T005**: Create CheckpointManager base (6h)
- **WP1.T006**: Add MigrationExplainer with lock levels (4h)
- **WP1.T007**: Implement CIC orchestration rules (6h)
- **WP1.T008**: Add partitioned table index handling (8h)

#### Dependencies
- T002 depends on T001 (needs planner output)
- T003 depends on T002 (needs executor)
- T004 depends on T002 (executor feature)
- T007 depends on T001 (planner feature)
- T008 depends on T007 (extends CIC)

#### Quality Gates
- ✅ All operations classified by lock level
- ✅ Streaming to psql verified
- ✅ Advisory locks prevent concurrent migrations
- ✅ CIC runs outside transactions

### Phase 2: Safety Rails (35h)

#### Tasks
- **WP2.T001**: Implement NOT VALID pattern for FKs (6h)
- **WP2.T002**: Add validation phase scheduling (4h)
- **WP2.T003**: Create unique constraint via index pattern (5h)
- **WP2.T004**: Implement instant column default detection (4h)
- **WP2.T005**: Add shadow column strategy for type changes (8h)
- **WP2.T006**: Create circular FK handling with DEFERRABLE (4h)
- **WP2.T007**: Add computed column trigger generation (6h)

#### Dependencies
- All tasks depend on Phase 1 completion
- T002 depends on T001 (validation after NOT VALID)
- T006 can run parallel to others

#### Quality Gates
- ✅ All constraints use safe patterns
- ✅ Type changes don't lock tables
- ✅ Computed columns work cross-table

### Phase 3: Developer Experience (30h)

#### Tasks
- **WP3.T001**: Integrate chokidar for watch mode (4h)
- **WP3.T002**: Add GraphQL ESLint with rules (3h)
- **WP3.T003**: Configure GraphQL Code Generator (4h)
- **WP3.T004**: Add Zod generation plugin (3h)
- **WP3.T005**: Create schema drift detector (6h)
- **WP3.T006**: Implement --explain mode (4h)
- **WP3.T007**: Add --dry-run with full SQL (2h)
- **WP3.T008**: Create progress monitoring (4h)

#### Dependencies
- T003 and T004 can run parallel
- T006 depends on Phase 1 planner
- Others independent

#### Quality Gates
- ✅ Watch mode responds in < 200ms
- ✅ Types and validators generated
- ✅ Drift detection catches changes

### Phase 4: Production Features (35h)

#### Tasks
- **WP4.T001**: Implement dead column detector (8h)
- **WP4.T002**: Add resource bottleneck analysis (6h)
- **WP4.T003**: Create checkpoint recovery system (8h)
- **WP4.T004**: Add migration rollback generation (6h)
- **WP4.T005**: Implement backfill batching (5h)
- **WP4.T006**: Create validation window scheduler (4h)

#### Dependencies
- T003 depends on Phase 1 checkpoint base
- T001 requires pg_stat_statements
- Others independent

#### Quality Gates
- ✅ Checkpoints tested with failures
- ✅ Dead columns detected with confidence
- ✅ Rollback scripts generated

### Phase 5: Testing & Quality (25h)

#### Tasks
- **WP5.T001**: Add property-based tests with fast-check (6h)
- **WP5.T002**: Create snapshot tests with Vitest (4h)
- **WP5.T003**: Add SQL round-trip validation (5h)
- **WP5.T004**: Create integration test suite (6h)
- **WP5.T005**: Add performance benchmarks (4h)

#### Dependencies
- All can run in parallel
- Integration tests need Phases 1-3

#### Quality Gates
- ✅ 100% test coverage
- ✅ Property tests find no crashes
- ✅ Benchmarks meet targets

### Phase 6: Refactoring & Cleanup (15h)

#### Tasks
- **WP6.T001**: Split SQLAst.mjs into 18 files (4h)
- **WP6.T002**: Split Commands.mjs into 12 files (3h)
- **WP6.T003**: Split Events.mjs into 15 files (3h)
- **WP6.T004**: Add JSDoc to all public APIs (3h)
- **WP6.T005**: Update all imports (2h)

#### Dependencies
- T005 depends on T001-T003
- Can run parallel to other phases

#### Quality Gates
- ✅ One class per file
- ✅ All tests still pass
- ✅ Documentation complete

## Total Timeline

### Rolling Frontier Execution
- **Optimal**: 120 hours (15 working days)
- **P50**: 145 hours (18 working days)
- **P95**: 180 hours (22.5 working days)

### Wave-Based Alternative
- **P50**: 185 hours (23 working days)
- **P80**: 220 hours (27.5 working days)
- **P95**: 260 hours (32.5 working days)

## Resource Bottleneck Analysis

### Critical Path
1. DDL Planner (blocks everything)
2. SQL Executor (blocks safety features)
3. Checkpoint Manager (blocks recovery)

### Parallelization Opportunities
- DX features (watch, lint, types) - Phase 3
- Testing suite - Phase 5
- Refactoring - Phase 6

### Resource Conflicts
- Database connection exclusive for execution
- File writes need coordination
- Memory spikes during generation

## Risk Analysis

### High Risk Items
1. **CIC orchestration complexity** (Confidence: 0.7)
   - Mitigation: Extensive testing on real schemas
2. **Streaming implementation** (Confidence: 0.8)
   - Mitigation: Buffer management carefully
3. **Checkpoint recovery** (Confidence: 0.75)
   - Mitigation: Test with actual failures

### Medium Risk Items
1. **Performance targets** (< 1s for 100 tables)
2. **Memory usage** (streaming helps)
3. **Cross-platform compatibility**

## Success Metrics

### Phase Gates
- **Phase 1**: Lock-aware planning works
- **Phase 2**: All unsafe patterns eliminated
- **Phase 3**: DX features integrated
- **Phase 4**: Production features complete
- **Phase 5**: Tests comprehensive
- **Phase 6**: Code quality improved

### Final Acceptance
- ✅ Zero blocking DDL by default
- ✅ Checkpoint recovery works
- ✅ Schema drift detected
- ✅ Types/Zod generated correctly
- ✅ 100% test coverage
- ✅ Performance targets met

## Implementation Notes

### Critical Implementation Details

#### CIC Rules (Must Enforce)
- Cannot run inside transaction block
- Only one per table at a time
- Partitioned tables need special handling

#### Timeout Setting (Corrected)
```sql
-- Not psql -v (doesn't work)
SET LOCAL lock_timeout = '5s';  -- In transaction
SET LOCAL statement_timeout = '30s';
```

#### Advisory Lock Keys (Stable)
```sql
-- Not hashtext() - not stable!
('x' || substr(digest('wesley:001', 'sha256')::text, 1, 16))::bit(64)::bigint
```

#### NOT VALID Pattern
- FKs on partitioned tables can't use NOT VALID
- Always validate in separate phase
- Schedule for low traffic

## Rollout Strategy

### Development Environment
1. Implement Phase 1-2 on branch
2. Test with real schemas
3. Merge when stable

### Staging Validation
1. Run against production schema copy
2. Verify lock analysis accurate
3. Test checkpoint recovery

### Production Deployment
1. Document all new flags
2. Default to safe operations
3. Require --unsafe explicitly

---

## Conclusion

Wesley's transformation to production-grade requires systematic implementation of PostgreSQL best practices, streaming execution, and comprehensive safety rails. The rolling frontier execution model provides optimal resource utilization while maintaining checkpoint recovery capabilities.

**Estimated Total Effort**: 120-180 hours
**Recommended Team Size**: 2-3 developers
**Time to Production**: 4-6 weeks

---

**[← Back to README](../README.md)** | **[View Decisions →](./Decisions.md)**