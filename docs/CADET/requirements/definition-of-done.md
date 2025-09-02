# Definition of Done

## Overview

This document defines the criteria that must be met for any work item to be considered complete in the Wesley production implementation project.

## Universal Criteria

All work items must meet these criteria regardless of type:

### Code Quality
- [ ] Code follows project style guide (ESM, one class per file)
- [ ] No ESLint errors or warnings
- [ ] JSDoc comments for all public APIs
- [ ] No commented-out code
- [ ] No console.log statements (use proper logging)
- [ ] No TODO comments without issue numbers

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests where applicable
- [ ] Test coverage ≥ 80% for new code
- [ ] Property-based tests for generators
- [ ] Edge cases covered
- [ ] Error scenarios tested

### Documentation
- [ ] README updated if needed
- [ ] API documentation complete
- [ ] Examples provided for new features
- [ ] CHANGELOG entry added
- [ ] Migration guide if breaking changes

### Review
- [ ] Code reviewed by at least one team member
- [ ] Feedback addressed
- [ ] Approved by technical lead
- [ ] No unresolved comments

### Performance
- [ ] Performance benchmarks pass
- [ ] No memory leaks detected
- [ ] Resource usage within limits
- [ ] Load testing completed for critical paths

## Feature-Specific Criteria

### DDL Operations

#### Lock-Aware Planning
- [ ] All operations classified by lock level
- [ ] Lock impact documented
- [ ] Safe alternatives implemented
- [ ] Timeout configuration correct
- [ ] Advisory locks working

#### CREATE INDEX CONCURRENTLY
- [ ] Runs outside transaction
- [ ] One per table enforced
- [ ] Partitioned table handling
- [ ] Progress monitoring
- [ ] Error recovery implemented

#### Foreign Keys
- [ ] NOT VALID pattern implemented
- [ ] Validation scheduling working
- [ ] Circular FK detection
- [ ] Partitioned table special handling
- [ ] Rollback scripts generated

### Migration Execution

#### Streaming
- [ ] No full schema in memory
- [ ] Backpressure handled
- [ ] Progress events emitted
- [ ] Resource monitoring active
- [ ] Cleanup on failure

#### Transactions
- [ ] SET LOCAL timeouts working
- [ ] Advisory locks acquired
- [ ] Proper rollback on error
- [ ] Checkpoints saved
- [ ] State consistent

#### Recovery
- [ ] Checkpoints created at intervals
- [ ] Resume from checkpoint works
- [ ] State verification passes
- [ ] Cleanup automated
- [ ] Manual intervention documented

### Developer Experience

#### Watch Mode
- [ ] File changes detected < 200ms
- [ ] Debouncing prevents floods
- [ ] Atomic saves handled
- [ ] Error notifications clear
- [ ] Performance acceptable

#### Type Generation
- [ ] TypeScript types accurate
- [ ] Zod validators complete
- [ ] Custom scalars mapped
- [ ] Tree-shaking friendly
- [ ] Import paths configurable

#### CLI
- [ ] Commands have help text
- [ ] Exit codes documented
- [ ] JSON output available
- [ ] Progress indicators work
- [ ] Error messages helpful

### Production Readiness

#### Safety
- [ ] Dangerous operations require --unsafe
- [ ] Confirmation prompts work
- [ ] Dry-run mode available
- [ ] Explain mode accurate
- [ ] Rollback scripts tested

#### Monitoring
- [ ] Metrics exported
- [ ] Logging structured
- [ ] Alerts configured
- [ ] Dashboard updated
- [ ] Runbooks written

#### Operations
- [ ] Deployment automated
- [ ] Configuration documented
- [ ] Secrets managed properly
- [ ] Backup strategy defined
- [ ] Disaster recovery tested

## Type-Specific Criteria

### Bug Fixes
- [ ] Root cause identified
- [ ] Fix addresses root cause
- [ ] Regression test added
- [ ] Related issues checked
- [ ] Patch notes written

### New Features
- [ ] User story satisfied
- [ ] Acceptance criteria met
- [ ] Feature flag if needed
- [ ] Analytics instrumented
- [ ] A/B test configured

### Refactoring
- [ ] Behavior unchanged
- [ ] Tests still pass
- [ ] Performance not degraded
- [ ] Code cleaner/simpler
- [ ] Technical debt reduced

### Documentation
- [ ] Technically accurate
- [ ] Examples work
- [ ] Spelling/grammar checked
- [ ] Diagrams updated
- [ ] Links valid

### Infrastructure
- [ ] Terraform/scripts updated
- [ ] Rollback plan exists
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] Runbook updated

## Validation Checklist

### Before Marking Done

1. **Self Review**
   - [ ] I have tested this thoroughly
   - [ ] I would be comfortable with this in production
   - [ ] I have considered edge cases
   - [ ] I have updated all relevant documentation

2. **Automated Checks**
   - [ ] CI pipeline green
   - [ ] No security vulnerabilities
   - [ ] Dependencies up to date
   - [ ] License compliance checked

3. **Manual Testing**
   - [ ] Happy path works
   - [ ] Error cases handled
   - [ ] Performance acceptable
   - [ ] UX/DX satisfactory

4. **Team Review**
   - [ ] Code reviewed and approved
   - [ ] QA testing complete
   - [ ] Product owner acceptance
   - [ ] No blocking concerns

## Exceptions

Exceptions to the DoD require:
1. Written justification
2. Risk assessment
3. Mitigation plan
4. Team lead approval
5. Documentation in issue

Common valid exceptions:
- Hotfixes for production issues
- Proof of concept code
- Temporary workarounds with follow-up tickets
- Third-party limitations

## Continuous Improvement

The Definition of Done should be reviewed and updated:
- After each sprint retrospective
- When new requirements emerge
- When quality issues are identified
- At major milestones

Proposed changes require:
1. Team discussion
2. Impact assessment
3. Consensus agreement
4. Documentation update
5. Communication to stakeholders

## Enforcement

### Responsibilities

**Developer**: Ensure all criteria met before requesting review
**Reviewer**: Verify criteria during code review
**QA**: Validate acceptance criteria and testing
**Team Lead**: Final approval and exception handling
**Scrum Master**: Process enforcement and improvement

### Consequences

Work not meeting DoD:
- Cannot be merged to main branch
- Cannot be included in release
- Must be returned to development
- May require retrospective discussion

## Quick Reference

### Minimum for All Items
```
✓ Code quality (lint, style, comments)
✓ Tests (unit, coverage > 80%)
✓ Documentation (API, examples)
✓ Review (approved, no comments)
✓ Performance (benchmarks, no leaks)
```

### Additional for Features
```
✓ User story satisfied
✓ Acceptance criteria met
✓ Integration tests
✓ Feature documentation
✓ Migration guide if breaking
```

### Additional for Production
```
✓ Safety checks (--unsafe, dry-run)
✓ Monitoring (metrics, logs, alerts)
✓ Operations (deploy, config, secrets)
✓ Recovery (rollback, DR tested)
```

---

**[← Back to User Stories](./user-stories.md)** | **[↑ Back to README](../README.md)**