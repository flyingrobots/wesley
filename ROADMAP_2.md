# Wesley V2 — Roadmap of Record

> Canonical strategic roadmap for Wesley V2.
> Supersedes the earlier Alpha-centric master roadmap and absorbs the approved
> V2 sequencing, fixed contracts, and execution governance.

---

## 1. Ideal V2

Ideal V2 means:

- `transform` is the one true orchestration path.
- The append-only ledger is runtime truth; `.wesley/` and `out/` are projections and materializations.
- Plugins are pure, plans are deterministic and hashable, reducers are pure, and materialization is atomic.
- HOLMES, WATSON, and MORIARTY only consume certified evidence from real runs.
- Multi-transmutation workspaces are explicit, isolated, and ownership-checked.
- `plan`, `rehearse`, `certify`, `replay`, and `moriarty` all operate over the same run model.
- Docs stop presenting proposed behavior as if it were already shipped.

This order is driven by repo reality: the current center of gravity is still the
imperative CLI/compiler seam, not the full transmutation story; evidence on the
main path is still coarse; ops behavior is inconsistent across GraphQL and JSON;
and change concentrates in a narrow hotspot.

---

## 2. Fixed Contracts

- `transform` is canonical. `generate` becomes a noisy alias in Phase 1 and is removed in Phase 9.
- By the end of Phase 2, `transform`, `plan`, `rehearse`, `certify`, and `moriarty` are all ledger-backed flows over the same run model and all accept `--transmutation` and `--run-id`.
- The ledger is runtime truth. Snapshots are caches. Replay performs zero writes by default.
- `.wesley/snapshot.json` becomes a ledger-derived `SnapshotProjection` by the end of Phase 2 or it stops existing; it is never again an independent source of migration truth.
- External config uses singular `plugin` through Phases 1-5. Internally the runner may remain list-capable, but public config must not imply multi-plugin transmutations are already real.
- Reducers are pure. Materialization is separate, atomic, and idempotent. No reducer writes files.
- `EventStorePort` and `RunSchedulerPort` are real ports. Use a reducer registry plus materializers; do not add a `ProjectionPort`.
- No replay writes by default. Ever.
- No new directive semantics ship unless parser, IR, evidence, tests, and docs land together.
- No package rename lands before the old path is deleted.

### Event Envelope

Every stored event must carry:

- `eventId`
- `streamId`
- `sequence`
- `schemaVersion`
- `timestamp`
- `causationId`
- `correlationId`
- `idempotencyKey`
- `runId`
- `transmutation`
- `planHash`
- `inputDigest`
- provenance digests for config, Wesley version, plugin versions, git SHA, and dirty state

Required event types:

- `RunRequested`
- `SourcesResolved`
- `IRParsed`
- `TaskGraphBuilt`
- `TaskStarted`
- `TaskCompleted`
- `TaskFailed`
- `TaskSkipped`
- `RunResumed`
- `ArtifactsMaterialized`
- `EvidenceMerged`
- `ScoresComputed`
- `CertificateIssued`
- `RunCompleted`
- `RunFailed`
- `RunCancelled`

---

## 3. Phase Roadmap

### Phase 0 — Stop Lying

- Freeze a parity corpus for DDL, RLS, pgTAP, ops artifacts, snapshot state, and current bundle outputs.
- Add a docs truth manifest with `current`, `experimental`, and `proposed`, enforced in CI.
- Define and freeze the V2 glossary: `runId`, `streamId`, `transmutation`, `planHash`, `inputDigest`, `ownership`, `replay`, `resume`, `certified`.
- Publish a directive truth table covering real, deferred, and dead semantics.
- Split the current `generate` hotspot into phase modules immediately without changing behavior.
- Split example ops fixtures into schema-valid examples and explicit negative tests; stop treating the mixed example directory as a happy path.

Gate:

- Parity corpus 100% green.
- Every public doc page has a truth label and owner.
- Directive truth table is published and CI-enforced.
- No mixed example “happy path” contains known-invalid ops.

### Phase 1 — Move the Control Plane

- Make `TransmutationRunner` the only orchestration kernel.
- Keep `generate` as a noisy alias while `transform` becomes the real path.
- Introduce `legacy-supabase` as a shim transmutation that reuses the current DDL/RLS/pgTAP emitters through the new runner.
- Replace command-level writes with `event emission -> pure reduction -> materialization`.
- Keep execution deterministic and serial-over-DAG only.

Gate:

- `transform --transmutation legacy-supabase` reproduces current outputs byte-for-byte on the parity corpus.
- Zero direct artifact writes remain in command handlers.

### Phase 2 — Make It Durable

- Add `EventStorePort` with `MemoryEventStore` and `GitWarpEventStore`.
- Treat `git-warp` as the default dev/CI backend behind the port, not as architecture doctrine.
- Add reducer snapshots and compaction so replay stays bounded.
- Ship `wesley runs status`, `wesley runs inspect`, `wesley runs replay`, and `wesley runs doctor`.
- Make resume depend on deterministic task keys, atomic writes, and idempotent materialization.
- Make `plan`, `rehearse`, `certify`, and `moriarty` ledger-backed flows over the same run model.
- Add `WESLEY_CRASH_AFTER_EVENT=n` fault injection.

Gate:

- Crash-at-every-boundary matrix 100% green.
- Replay performs zero writes by default.
- Resume completes idempotently after injected crashes.
- All run-oriented commands accept `--transmutation` and `--run-id`.
- `.wesley/snapshot.json` is projection-only or deleted.

### Phase 3 — Make It Truthful

- Upgrade the plugin contract to API v2 with machine-checkable evidence primitives.
- Require exact source spans, artifact spans, source digests, artifact digests, claim kind, and plan linkage.
- Delete placeholder bundle synthesis from the main path.
- Make HOLMES and WATSON operate only on certified evidence bundles.
- Make MORIARTY learn only from certified runs with real provenance.
- Wire chosen directive semantics through parser -> IR -> evidence -> scoring, or demote them from docs.

Gate:

- 100% of certified claims are WATSON-verifiable.
- Zero placeholder spans survive in certified bundles.
- Docs/runtime agree on every scoring-relevant directive.

### Phase 4 — Make It Native

- Replace `legacy-supabase` with a native Supabase transmutation plugin.
- Add plugin capability descriptors such as `requiresSchema`, `requiresOps`, `touchesDatabase`, `producesEvidence`, and `resourceClasses`.
- Require plans to be serializable, deterministic, and hashable.
- Add a plugin conformance suite for parity, purity, evidence, digest stability, and replay safety.
- Migrate a second in-tree plugin through the full contract.

Gate:

- Native Supabase passes conformance.
- A second in-tree plugin passes the same conformance suite.
- No CLI orchestration path depends on old direct-emitter wiring.

### Phase 5 — Make Ops Consistent

- Unify GraphQL ops and JSON ops under one schema-aware planning and validation contract.
- Make one op IR and one failure model.
- Route op emission through the same runtime, reducers, materializer, evidence, and certification path.
- Make op registries and op artifacts projections, not bespoke side writes.
- Ensure ops compile once per transmutation context and inherit ownership and evidence rules.

Gate:

- One shared validator/planner package serves both GraphQL and JSON ops.
- Equivalent invalid GraphQL and JSON ops both fail.
- Equivalent valid GraphQL and JSON ops both pass.
- No schema-agnostic JSON escape hatch remains.

### Phase 6 — Make It a Real Platform

- Make the transmutations map fully first-class: `inputs`, `outDir`, `dependsOn`, `ownership`, and optional imports/exports.
- Validate ownership up front for schema namespaces, artifact roots, and later resource classes.
- Introduce a parent workspace run with child per-transmutation streams.
- Add shared source parsing and caching where safe, while keeping output, evidence, and certification isolated.
- Emit a workspace manifest that references per-transmutation artifacts and certificates.
- If real composition pressure exists here, this is the first phase allowed to introduce public plural `plugins` plus a config migration.

Gate:

- One run can execute multiple transmutations with clean isolation.
- Ownership conflicts fail at config validation time.
- Workspace outputs, manifests, and certificates are per-stream and coherent.

### Phase 7 — Make Change Safe

- Port the current additive planner fully onto the new runtime first.
- Then extend the plan model to `expand`, `backfill`, `validate`, `switch`, and `contract`.
- Add rename detection, destructive-change linting, lock estimation, and risk classification.
- Make `rehearse` execute the same plan model against disposable realms.
- Make `certify` consume the same plan model and real rehearsal evidence.

Gate:

- Additive, destructive, rename, backfill, and contract scenario corpus is 100% green.
- `plan`, `rehearse`, and `certify` all consume the same underlying plan representation.

### Phase 8 — Make It Fast Without Making It Weird

- Implement `RunSchedulerPort` with the real T.A.S.K.S./S.L.A.P.S. backend.
- Add resource-aware locking, leases, cancellation, and backpressure.
- Parallelize only tasks declared safe by capability and resource metadata.
- Keep DB-touching work serialized by resource class unless proven safe.
- Add content-addressed artifact caching only after plan hashes and materialization semantics are stable.

Gate:

- Serial and parallel artifact digests match exactly.
- Serial and parallel evidence digests match exactly.
- Lock-contention matrix is green.
- Reruns are faster without determinism regressions.

### Phase 9 — Make It Boring

- Remove the `generate` alias.
- Remove the V1 config path and all silent compatibility behavior.
- Rename `generator-*` packages to `transmute-*`.
- Delete legacy snapshot/bundle synthesis branches and dead detours.
- Freeze the public V2 contract and publish the migration guide.

Gate:

- One command surface remains.
- One config model remains.
- One naming scheme remains.
- Zero dual-architecture compatibility branches remain in runtime code.

### Phase 10 — V2.x Horizons

These are explicitly post-GA, not identity-critical:

- Additional durable backends such as SQLite or Postgres
- `wesley runs diff <a> <b>`
- Digest-tree certificates
- External plugin SDK
- Multi-host parity beyond Node
- Remote/shared execution

Gate:

- None for V2 GA. Each item must justify itself with a concrete operational or adoption win before entering the active roadmap.

---

## 4. Release Markers

- **Alpha:** end of Phase 3. One transmutation path is real, durable, and evidence-truthful.
- **Beta:** end of Phase 6. Multi-transmutation workspace semantics are real.
- **RC:** end of Phase 8. Migration lifecycle and scheduler are proven.
- **GA:** end of Phase 9. Old path removed. V2 is no longer half-pregnant.

---

## 5. Execution Appendix

### 5.1 Execution Governance

Before any phase starts, create an ADR for that phase boundary. The ADR must name:

- exactly one DRI
- the phase boundary being authorized
- the proof artifacts and tests that define the gate
- the legacy code that must be deleted before the phase is complete

The roadmap gate is not considered satisfied until the listed deletion has happened.

### 5.2 Compatibility Policy

| Compatibility Surface | Policy Window |
| --------------------- | ------------- |
| `generate` command | Accepted through Phase 8 / RC; removed in Phase 9 / GA |
| V1 config | Accepted through Phase 8 / RC; removed in Phase 9 / GA |
| Plugin API v1 | Accepted through Phase 3 / Alpha; removed when native API v2 plugins become required in Phase 4 |
| Singular public `plugin` | Enforced starting Phase 1; plural public `plugins` not allowed before Phase 6 |
| Ledger-backed `plan`, `rehearse`, `certify`, `moriarty` | Required starting Phase 2 and mandatory for every release marker after Alpha |

`wesley migrate-config --dry-run --write --check` must ship before any compatibility surface is removed.

### 5.3 Event Evolution Policy

- Stored event schema changes are additive-only.
- Old events remain supported through explicit upcasters.
- Snapshots are always disposable and rehydratable from the ledger.
- Replay semantics cannot depend on snapshot shape.
- If a non-additive event change is ever unavoidable, it requires a dedicated ADR and a new stream version rather than silent mutation.

### 5.4 Runtime Budgets

These budgets are phase gates, not aspirations:

- Representative replay time: `<= 10s` local dev, `<= 30s` CI
- Resume time after injected crash: `<= 15s` local dev, `<= 45s` CI
- Parity-suite runtime: `<= 10 minutes` in CI
- Materialization drift between serial and parallel execution: `0` digest delta
- WATSON verification rate for certified bundles: `100%` of certified claims

Any budget regression requires an ADR or a budget reset justified by a new representative workload.

### 5.5 Hard Red Lines

- Do not reintroduce public plural plugins before Phase 6.
- Do not let `.wesley/snapshot.json` survive as a second source of truth after Phase 2.
- Do not let replay write by default.
- Do not let Phase 8 scheduler work leak into earlier phases because it seems like “just a small optimization.”
- Do not ship new directive semantics unless parser, IR, evidence, tests, and docs land together.

---

## 6. Backlog

- Additional durable backends such as SQLite or Postgres
- `wesley runs diff <a> <b>`
- Digest-tree certificates
- External plugin SDK
- Multi-host parity beyond Node
- Remote/shared execution
