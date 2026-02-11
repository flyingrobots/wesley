# Execution Plan: Dependency Analysis & Phased Schedule

> Verified dependency graph, critical path identification, and parallelization strategy for the 22 Echo roadmap tasks (E0.1–E4.1).

---

## Task Dependency Graph

Complete dependency graph for all 22 tasks. `→` means "blocks" (left must complete before right can start). Tasks at the same indent level with no arrow between them can run in parallel.

```
E0.1 (GeneratorPlugin Contract)          ← ROOT NODE, blocks everything
 ├→ E0.2 (Plugin Discovery)
 │   ├→ E0.4 (Lifecycle Docs)            [also needs E0.3]
 │   └→ E0.5 (wesley doctor)
 ├→ E0.3 (Test Harness)
 │   └→ E0.4 (Lifecycle Docs)            [also needs E0.2]
 ├→ E1.1 (Canonical AST)                 [also needs E0.2— see note¹]
 │   ├→ E1.2 (schema_hash)
 │   │   ├→ E1.3 (registry_hash)         [also needs E0.1]
 │   │   │   └→ E1.4 (Hash Chain)        [also needs E1.1, E1.2]
 │   │   │       └→ E1.5 (echo-ir/v2)    [also needs E1.2, E1.3]
 │   │   └→ E1.4 (Hash Chain)
 │   ├→ E1.4 (Hash Chain)
 │   └→ E1.6 (SchemaDelta)
 │       └→ E1.7 (wesley diff)
 ├→ E2a.1 (raw_le Rust)                  [also needs E1.1, E1.5]
 │   ├→ E2a.2 (raw_le TypeScript)
 │   │   └→ E2d.1 (Golden Vectors)       [also needs E2a.1]
 │   ├→ E2a.3 (layout_hash)              [also needs E1.5]
 │   ├→ E2c.1 (GuardedView)
 │   └→ E2d.1 (Golden Vectors)
 ├→ E2b.1 (Core Type Schemas)            [also needs E1.5]
 │   └→ E4.1 (Privacy Types)             [also needs E2a.1, E2a.2]
 ├→ E3.1 (@wes_join Parsing)
 │   ├→ E3.2 (Join Codegen)              [also needs E1.5]
 │   ├→ E3.3 (Join Docs)
 │   └→ [E3.2, E3.3 are independent of each other]
 └→ E1.3 (registry_hash)                 [also needs E1.2]
```

> ¹ **Note on E1.1 deps:** The task spec says E1.1 is blocked by E0.1. The original E0.2 blocking list says it blocks E1.1 too, but this is a soft dependency — E1.1 needs the plugin interface (E0.1) and benefits from discovery (E0.2) for integration testing, but the core `canonicalize()` function can be built against E0.1 alone. The dependency is preserved as-is.

---

## Critical Path

The **critical path** is the longest chain of sequential dependencies — it determines the minimum total calendar time.

```
E0.1 → E1.1 → E1.2 → E1.3 → E1.4 → E1.5 → E2a.1 → E2a.2 → E2d.1
 6-10h  8-12h  3-5h   3-5h   4-6h   5-8h   16-24h  12-18h   8-12h

Critical path total: 65–100 human-hours
```

This is the **absolute floor** — nothing can make the project finish faster than this chain allows.

### Second-longest path (for context)
```
E0.1 → E1.1 → E1.2 → E1.3 → E1.4 → E1.5 → E2a.1 → E2a.2 → E4.1
                                                              (+ E2b.1)
```
E4.1 adds 6–10h on top, but E2b.1 can overlap with E2a work.

---

## Parallelization Opportunities

These task groups are **fully independent** of each other once their shared prerequisites are met:

### After E0.1 completes (3 parallel tracks open)
| Track A | Track B | Track C |
|---|---|---|
| E0.2 → E0.5 | E0.3 | E3.1 → E3.3 |

### After E0.1 + E0.2 complete
| Track A | Track B | Track C |
|---|---|---|
| E1.1 → E1.2 → ... | E0.3 (if not done) | E3.1 (if not done) |
| | E0.4 (once E0.3 done) | |

### After E1.5 completes (wide fan-out)
| Track A | Track B | Track C | Track D |
|---|---|---|---|
| E2a.1 → E2a.2 → E2d.1 | E2b.1 | E2a.3 (after E2a.1) | E3.2 (after E3.1) |

### E3 is fully parallelizable with E1 and E2
The entire E3 track (E3.1 → E3.2 → E3.3) only needs E0.1 to start. E3.2 also needs E1.5, but E3.1 and E3.3 don't. So:
- E3.1 can start as soon as E0.1 is done
- E3.3 can start as soon as E3.1 is done
- E3.2 must wait for both E3.1 AND E1.5

### E1.6 → E1.7 is a side branch
This branch only needs E1.1 (not E1.2/E1.3/E1.4). It delivers immediate user-facing utility (`wesley diff`) and can be shipped early.

---

## Recommended Execution Phases

### Phase 1: Foundation (est. 13–21h)
```
E0.1 ─────────────────────────────────  [6-10h, MUST be first]
  then in parallel:
  ├── E0.2 ─────────────────────────── [4-6h]
  └── E0.3 ─────────────────────────── [3-5h]
```
**Gate:** All three done before Phase 2 begins.
**E0.4** (docs) can be written incrementally alongside — not a gate.
**E0.5** (`wesley doctor`) can start once E0.2 is done — not a gate.

### Phase 2: Trust Root (est. 22–36h)
```
E1.1 (Canonical AST) ──────────────── [8-12h, CRITICAL PATH]
  then:
  ├── E1.2 (schema_hash) ──────────── [3-5h, CRITICAL PATH]
  │   then:
  │   └── E1.3 (registry_hash) ────── [3-5h, CRITICAL PATH]
  │       then:
  │       └── E1.4 (Hash Chain) ───── [4-6h, CRITICAL PATH]
  │           then:
  │           └── E1.5 (echo-ir/v2) ─ [5-8h, CRITICAL PATH]
  │
  ├── E1.6 (SchemaDelta) ──────────── [8-12h, can start immediately after E1.1]
  │   └── E1.7 (wesley diff) ──────── [4-6h]
  │
  └── E3.1 (@wes_join parsing) ────── [4-6h, can start in Phase 1 after E0.1]
      └── E3.3 (Join Docs) ────────── [4-6h]
```
**Gate:** E1.5 done before Phase 3.
**Key insight:** E1.6 → E1.7 runs in parallel with E1.2–E1.5. Ship `wesley diff` as soon as it's ready — immediate user value.
**Key insight:** E3.1 can start in Phase 1 (only needs E0.1), E3.3 can follow immediately.

### Phase 3: Deterministic Encoding (est. 32–48h)
```
E2a.1 (raw_le Rust) ───────────────── [16-24h, CRITICAL PATH, heaviest task]
  then in parallel:
  ├── E2a.2 (raw_le TypeScript) ───── [12-18h, CRITICAL PATH]
  ├── E2a.3 (layout_hash) ─────────── [4-6h]
  └── E3.2 (Join Codegen) ─────────── [10-16h, needs E3.1 + E1.5]

E2b.1 (Core Type Schemas) ─────────── [4-6h, can start as soon as E1.5 done]
```
**Gate:** E2a.1 + E2a.2 done before Phase 4.
**Key insight:** E2a.1 is the single heaviest task (16–24h). It's on the critical path and cannot be parallelized internally. This is the bottleneck.

### Phase 4: Cross-Platform Proof (est. 8–12h)
```
E2d.1 (Golden Vectors) ────────────── [8-12h, needs E2a.1 + E2a.2]
```
**Gate:** Golden vectors passing in CI before Phase 5.

### Phase 5: Views + Privacy (est. 16–26h)
```
In parallel:
├── E2c.1 (GuardedView) ──────────── [10-16h, needs E2a.1]
└── E4.1 (Privacy Types) ─────────── [6-10h, needs E2a.1 + E2a.2 + E2b.1]
```
These are terminal nodes — nothing depends on them.

---

## Summary Table

| Task | Est. Hours | Blocked By | Phase | On Critical Path? |
|---|---|---|---|---|
| E0.1 | 6–10 | nothing | 1 | YES |
| E0.2 | 4–6 | E0.1 | 1 | no (parallel) |
| E0.3 | 3–5 | E0.1 | 1 | no (parallel) |
| E0.4 | 4–6 | E0.1, E0.2, E0.3 | 1–2 | no (docs, incremental) |
| E0.5 | 3–5 | E0.1, E0.2 | 1–2 | no (diagnostic tool) |
| E1.1 | 8–12 | E0.1 | 2 | **YES** |
| E1.2 | 3–5 | E1.1 | 2 | **YES** |
| E1.3 | 3–5 | E0.1, E1.2 | 2 | **YES** |
| E1.4 | 4–6 | E1.1, E1.2, E1.3 | 2 | **YES** |
| E1.5 | 5–8 | E1.2, E1.3, E1.4 | 2 | **YES** |
| E1.6 | 8–12 | E1.1 | 2 | no (side branch) |
| E1.7 | 4–6 | E1.6 | 2 | no (side branch) |
| E2a.1 | 16–24 | E0.1, E1.1, E1.5 | 3 | **YES (bottleneck)** |
| E2a.2 | 12–18 | E2a.1 | 3 | **YES** |
| E2a.3 | 4–6 | E2a.1, E1.5 | 3 | no (parallel) |
| E2b.1 | 4–6 | E0.1, E1.5 | 3 | no (parallel) |
| E2c.1 | 10–16 | E0.1, E2a.1 | 5 | no (terminal) |
| E2d.1 | 8–12 | E2a.1, E2a.2 | 4 | **YES** |
| E3.1 | 4–6 | E0.1 | 1–2 | no (parallel track) |
| E3.2 | 10–16 | E3.1, E1.5 | 3 | no (parallel) |
| E3.3 | 4–6 | E3.1 | 2 | no (docs) |
| E4.1 | 6–10 | E2a.1, E2a.2, E2b.1 | 5 | no (terminal) |

**Critical path total:** 65–100 human-hours (9 tasks in sequence)
**Total project estimate:** 130–196 human-hours (all tasks, assumes max parallelism)
**Calendar time at 1 dev:** ~130–196h (no parallelism)
**Calendar time at 2 devs:** ~85–130h (critical path + one parallel track)

---

## Observations & Risks

### Bottleneck: E2a.1
At 16–24h, this is the single largest task and it's on the critical path. Consider:
- Breaking it into sub-tasks (type mapping, encoder gen, decoder gen, option encoding, tests)
- Starting design/prototyping during Phase 2 while E1.x is in progress

### Cross-repo coordination points
These tasks require synchronized Echo PRs:
- **E1.5** (echo-ir/v2) — `echo-wesley-gen` must accept v2
- **E2a.1** (raw_le Rust) — Echo must consume generated encoders
- **E2b.1** (Core Type Schemas) — replaces hand-written Rust structs
- **E3.2** (Join Codegen) — Echo's lattice merge must use generated joins

### Early wins (ship for user value)
- **E1.7** (`wesley diff`) — usable as soon as E1.1 + E1.6 are done (~Phase 2 midpoint)
- **E0.5** (`wesley doctor`) — usable as soon as E0.2 is done (~Phase 1 end)

### E0.4 and E3.3 are documentation
Both can be written incrementally and should not gate any engineering work.
