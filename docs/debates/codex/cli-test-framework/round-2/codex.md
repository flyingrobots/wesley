# Round 2: Concrete Scenarios Where Hybrid Wins

## Bottom Line

I'm defending the hybrid approach. Pure Bats is great for end-to-end behavior, but there are specific, concrete scenarios where it either can't cover the risk at all or does so in a flaky, slow, or platform-limited way. Hybrid keeps Bats for the contract and adds a thin layer of language-level tests where Bats demonstrably struggles.

## Concrete Scenarios

**Windows arg parsing and paths:** A user runs `wesley generate --schema "C:\Users\Jane Doe\schema.graphql"`. On Windows, quoting/escaping differs (spaces, `^`, `%VAR%`, backslashes). Bats can't run natively on cmd/PowerShell and Git Bash/WSL won't reproduce Windows argv semantics. Hybrid: unit tests run on Windows CI, assert argv parsing, path normalization, and `CreateProcess`-style quoting without spawning a shell. This prevents "works on Unix, breaks on Windows" regressions you won't see with pure Bats.

**TTY-sensitive output (colors, progress):** Wesley prints colored output and progress bars only when stdout is a TTY. Bats runs non‑TTY; forcing a pty via `script` is brittle and not cross‑platform. Real bug: after refactor, ANSI codes leak into piped output (`wesley … > out.txt`) or progress bars render incorrectly. Hybrid: unit tests inject fake TTY/non‑TTY streams and assert ANSI on/off and carriage-return behavior deterministically.

**Time-dependent logic (polling/backoff):** `wesley introspect` polls with exponential backoff and cancels on timeout. In Bats, validating the schedule means waiting seconds or using `faketime` (flaky, non‑portable). Hybrid: unit tests with fake timers verify exact backoff sequence and cancellation in milliseconds, avoiding slow, flaky end‑to‑end sleeps.

**File watching and debouncing:** `wesley generate --watch` should coalesce rapid file changes into one regeneration. Bats can simulate `touch` but flaps on timing and requires long sleeps. Hybrid: unit tests drive the watcher with synthetic change events and assert debounce/throttle semantics reliably.

**Unicode and filesystem invariants:** Generating file names from schema types must avoid collisions across Unicode normalization and case rules (e.g., `Å` vs `Å`, macOS NFD vs NFC). Bats only surfaces this when you happen to hit the right FS/locale combo. Hybrid: property-based unit tests generate many names and assert uniqueness/normalization rules in milliseconds—finding issues before slow, platform-specific integration failures.

**Network stubbing fidelity:** If `wesley` calls HTTP/GraphQL, Bats can mock with `nc/socat`, but complex scenarios (retry on 429 with `Retry-After`; partial reads) get gnarly and slow. Hybrid: unit tests stub the HTTP client and deterministically assert retry, header parsing, and error classification without forking processes or binding ports.

## Targeted Rebuttals

**Fast inner loop:** Agreed that spawn+I/O dominates end-to-end tests; keep those in Bats. The inner-loop win matters for logic-heavy pieces (parsing, config merge, debounce, backoff, Unicode rules). These run sub‑second in unit tests and catch classes of bugs Bats won't exercise well.

**Refactor safety "locking in internals":** Don't test internals; test module contracts. Example: test "config merge precedence" via public merge function with fixture inputs/outputs, not private helpers. This improves refactorability compared to brittle end-to-end tests that must set up entire environments to probe one rule.

**Complexity tax:** Use a simple rule of thumb:
- If it spawns the CLI, needs shell/FS/network/pty: put it in Bats.
- If it's pure logic or cross‑platform invariants: unit test.
This avoids decision churn. Keep unit tests focused on 5–10 critical invariants, not blanket coverage.

**Windows "contradiction":** Full integration on Windows is expensive. Hybrid isn't advocating that. It advocates cheap, broad Windows coverage via fast unit tests plus a few Windows smoke Bats. That's risk‑proportional coverage, not a contradiction.

**"Edge cases will surface in integration":** Many won't, or will do so flakily and late (TTY, Unicode, debounce, backoff). When they do, Bats often makes them slow to diagnose. Unit tests make them easy to reproduce and fix.

## Pragmatic Hybrid

**Keep Bats as the source of truth:** Full workflows, exit codes, file outputs, error messages, smoke Windows runs.

**Add a slim unit layer:** Only for the scenarios above. A tiny `runCli()` helper and a small set of focused tests. No coverage goals, no sprawling test matrix.

## If You Still Prefer Pure Bats

Simplicity does win if:
- You don't ship native Windows support (WSL-only is acceptable).
- You avoid TTY/progress features and interactive flows.
- You don't need watch mode, debouncing, or time-dependent behavior.
- Unicode/path normalization is out of scope for now.

If any of those enters scope, hybrid saves real time and prevents user-visible breakage that pure Bats can't reliably catch.

Want me to sketch the minimal test skeleton (folders, a `runCli()` helper, and 6 exemplar unit tests for the cases above) so you can see the true size of the "tax"?

---

*Standing firm with concrete scenarios, but acknowledging simplicity wins for current scope...*