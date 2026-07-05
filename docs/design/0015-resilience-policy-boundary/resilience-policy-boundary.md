---
title: Resilience Policy Boundary
legend: OWN
packet: 0015-resilience-policy-boundary
status: active
release: v0.0.6
---

# Resilience Policy Boundary

## Sponsors

- Human: I can decide when compiler and tooling work should use resilience
  policy instead of ad hoc timeouts, retries, or hung-process assumptions.
- Agent: I can choose `ninelives` for Rust and `@git-stunts/alfred` for
  JavaScript without smuggling product/runtime semantics into Wesley core.

## Hill

Wesley has a narrow, explicit resilience boundary:

- Rust compiler and capability seams use `ninelives`.
- JavaScript tooling and process boundaries use `@git-stunts/alfred` when they
  need bounded execution, deterministic timeout tests, or output-buffer guards.
- Core compiler semantics remain domain-empty and deterministic.

Resilience policy is an execution wrapper around compiler and tooling seams. It
is not a place to add product, database, scheduler, transport, or runtime
ownership to Wesley.

Rust in-process lowering timeouts are cooperative async deadlines. They observe
yield/cancellation points; they do not preempt synchronous CPU-bound parser
work that runs to completion inside a single future poll. A lowerer that needs
a hard execution deadline must run behind a process, thread, or runtime
boundary that can be cancelled independently.

## Why This Cycle Exists

v0.0.6 has made Rust IR parity and module-boundary evidence real enough that
bounded execution is now useful. The parity and performance scripts call native
lowerers repeatedly. Future WASM and module capability seams will do the same
under less controlled conditions.

The repo already carries both tools:

- `crates/wesley-core` depends on `ninelives`
- root JavaScript tooling depends on `@git-stunts/alfred`

This packet turns that fact into policy and proof instead of leaving it as
incidental dependency drift.

## Boundary Contract

### Rust

- Use `ninelives` at Rust compiler or capability execution seams.
- Preserve the existing direct deterministic lowering path for ordinary
  in-process compiler work.
- Expose resilience policy as explicit configuration or wrappers, not ambient
  retry behavior hidden inside semantic lowering.
- Do not retry deterministic parse or semantic errors.
- Treat in-process lowering timeouts as cooperative. Do not present them as
  hard preemption for synchronous parser/lowering work.

### JavaScript

- Use `@git-stunts/alfred` for JavaScript-side tool/process bounds when a child
  process can hang or emit unbounded output.
- Prefer `TestClock` in tests for timeout behavior.
- Keep process limits as evidence controls; do not let them rewrite compiler
  semantics.

### Non-Ownership

Resilience policy does not make Wesley the owner of:

- Echo, jedit, Continuum, WARPspace, `warp-ttd`, or `git-warp` runtime
  behavior
- PostgreSQL/Supabase execution, migrations, RLS, pgTAP, or database safety
  primitives
- deployment, scheduler, transport, replication, or substrate semantics

## First Five Slices

1. Align BEARING and the backlog with the `ninelives`/Alfred decision.
2. Add an explicit Rust core resilience policy wrapper backed by `ninelives`.
3. Prove the wrapper preserves normal lowering errors, maps cooperative policy
   timeouts to Wesley resilience diagnostics, and does not claim hard
   preemption of synchronous parser work.
4. Bound the JS parity sentinel's native CLI process calls with Alfred timeout
   and buffer controls.
5. Update CHANGELOG and docs so v0.0.6 says what is proved and what remains
   future module/runtime work.

## Current Proof

- `crates/wesley-core` exposes `ResiliencePolicy` and
  `ResilientLoweringPort` for opt-in cooperative Rust lowering timeouts.
- Rust policy tests use paused Tokio time to prove timeout mapping without
  sleeping on wall-clock time.
- Rust policy tests include a synchronous-poll guard proving the wrapper does
  not present CPU-bound in-process parser work as preemptible.
- `scripts/resilient-process.mjs` centralized Alfred-backed child-process
  timeout and output-buffer policy for historical JavaScript tooling.
- Historical `pnpm parity:ir` and `pnpm perf:ir` probes used the shared runner
  before legacy Node retirement.
- Current Rust-native IR benchmark evidence is emitted by
  `cargo xtask bench-ir`.
- JavaScript timeout behavior is covered with Alfred `TestClock`.

## Playback Questions

1. Does Wesley name `ninelives` as the Rust resilience policy tool?
2. Does Wesley name `@git-stunts/alfred` as the JavaScript tooling resilience
   tool?
3. Does Rust lowering preserve deterministic compiler errors instead of
   wrapping them as policy failures?
4. Does Rust timeout documentation stay honest that in-process lowering
   deadlines are cooperative, not hard preemption?
5. Do JS parity child processes have bounded timeout and output behavior?
6. Does the design keep resilience policy outside product and database
   ownership?

## Non-Goals

- Do not add retries around deterministic compiler semantic errors.
- Do not add live runtime control planes in this packet.
- Do not move database behavior into Wesley.
- Do not retire legacy Node lowering in this packet.
