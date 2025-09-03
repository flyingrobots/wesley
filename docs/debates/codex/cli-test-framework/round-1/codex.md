# Round 1: Defense of Hybrid Approach

## Position

Hybrid wins: Bats for black‑box CLI behavior, Node runner (Vitest) for fast, focused logic/contract tests. Integration tests remain the primary signal; unit/contract tests add speed, precision, and refactor safety.

## Coverage & Snapshots

**Coverage**: a lever, not a religion. Use it to guard core logic (flag parsing, config merge, path/glob normalization), not the shell surface. Low, targeted thresholds prevent dead code and catch "works in E2E, broken in edge case" bugs.

**Snapshots**: selective, stable outputs only. Great for `--help`, error suggestions, scaffolded files, and JSON event shapes. Avoid brittle TTY/noise by using serializers and trimming nondeterminism (timestamps, paths). Treat as contract tests with review on updates.

## Windows Compatibility

Pragmatic stance: we don't need full support, but a tiny smoke matrix on Windows catches quoting, path separators, CRLF, EOL, and `NO_COLOR`/TTY quirks early. Even if our main users are macOS/Linux, contributors and downstream CI often run on Windows.

**Cost control**: run 5–10 Bats smokes on `windows-latest`; keep the rest on Unix. This is cheap insurance against surprise support costs later.

## Hybrid Complexity vs. Benefit

**Overhead kept minimal**: one extra dev dep (Vitest), a `tests/fixtures` folder, and a tiny `runCli()` helper. No duplication: Bats owns end‑to‑end; Vitest owns internals and stable contracts.

**Payoff**: faster feedback (ms vs seconds), precise failure diffs, deterministic isolation, and safe refactors. Integration-only suites tend to get slow and brittle over time.

## Why Not Pure Bats

**Hard to isolate logic**: mocking time/network, faking TTY/stderr, simulating file watchers, and asserting complex JSON are awkward and flaky in shell.

**Poor diffs and speed**: multiline output diffs and parallelization are weak; iteration slows as suite grows.

**Edge gaps**: path normalization, glob edge cases, config precedence, color/TTY detection, and CRLF handling are far easier to validate in-process.

## Integration > Unit?

**Agree on priority**: CLI integration tests deliver the highest user value and should dominate the pyramid.

But **"integration-only" leaves blind spots**: integration can pass while logic is incidentally masked by forgiving behavior. Targeted unit/contract tests catch boundary math, parser edges, and platform seams quickly and cheaply.

**Refactor safety**: when reorganizing internals, unit/contract tests keep intent intact while integration ensures the UX is unchanged.

## Where Node Runner Shines

- **Fast inner loop**: sub-second runs with watch mode for parser/config utilities
- **Rich assertions**: structured diffs for JSON, snapshots for help/error text, stable redactions for nondeterminism
- **Environment control**: simulate TTY, colors, time, locale, and platform path cases without spawning shells
- **Parallelism and flake reduction**: fewer race conditions than process-spawn heavy Bats-only suites

## Minimal Hybrid Plan

- **Tests pyramid**: 70–80% Bats integration; 20–30% Vitest unit/contract on core utilities and output contracts
- **Snapshots policy**: only for `--help`, scaffold templates, and JSON shapes; custom serializer + redactions
- **Coverage policy**: enforce thresholds only on core libs; exclude CLI wrapper and Bats
- **CI matrix**: Unix full suite; Windows smoke subset

If you want, I can sketch the exact folder layout, a `runCli()` helper, snapshot serializer, and the small Windows smoke matrix to keep this lean.

---

*Standing firm on hybrid approach while acknowledging integration test primacy...*