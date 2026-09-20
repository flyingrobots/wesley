---
Status: Accepted
Binding: true
Adopted: 2026-09-20
Scope: every automated assertion in this repository
Basis: the portable Testing Standards of 2026-08-16; this is its binding Wesley profile
---

# Testing Standards

A test is an experiment: it manipulates a system under controlled conditions and
reads a gauge. A suite is an instrument, and CI is the protocol that keeps it
honest between readings.

An instrument lies in three ways, and every rule below suppresses one of them.

- **False confidence.** Green while the system is wrong: vacuous assertions,
  drifted fakes, goldens blessed unread, coverage theatre. This is the worst,
  because it converts uncertainty into unwarranted certainty.
- **False alarm.** Red while the system is right: change detectors, brittle
  interaction tests, flakes. The cost is not the failed run but the trained
  response. At a high enough ratio, red stops meaning anything.
- **Decay.** Readings stay accurate but stop being affordable or believed: the
  suite slows until nobody runs it and grows until nobody reads it.

The meta-rule: **every rule names the failure it prevents.** A rule that cannot
is a superstition with a lint check.

Three sentences hold the rest: test promises at boundaries, prove every test can
fail, control everything a test observes.

Do not count tests. Account for claims, counterexamples, and blind spots.

**How to read this.** The rules state requirements, in the present tense. They do
not describe the suite as it is: the
[compliance ledger](#compliance-ledger-at-adoption) does that.

## Wesley profile

These rules bind every new or materially changed assertion from adoption onward.
Existing assertions are governed by the same standard, and their compliance is
not presumed because they predate it. The [compliance ledger](#compliance-ledger-at-adoption)
names the inherited gaps.

**Wesley's contract boundaries.** A test enters through one of these and asserts
on what comes out of it:

| Boundary                     | What crosses it                                                     |
| ---------------------------- | ------------------------------------------------------------------- |
| The `wesley` CLI             | arguments, files read, stdout, stderr, exit status, files written   |
| The crate root of each crate | `lower_schema_sdl`, `compute_registry_hash`, `emit_rust`, and so on |
| The L1 IR                    | a versioned JSON document, described by `schemas/ir.schema.json`    |
| Emitted source               | Rust and TypeScript that must compile and mean what the IR says     |
| The registry hash            | a value other systems store and compare                             |
| Law and manifest files       | `weslaw/v1`, `wesley.config.json`, the JSON Schemas in `schemas/`   |
| `cargo xtask` commands       | exit status and report, as the workflows consume them               |

**What is not a test here.** Documentation, workflow YAML, and source text are
not test subjects. No assertion searches a Markdown file, a workflow, or a
source file for a string. Such a check fails when a sentence is reworded and
passes when the behavior is broken, which is both false alarm and false
confidence at once. Two checks touch documentation, and both execute something:
links are followed and must resolve, and a `wesley` command shown in the docs
must be one the CLI registers. A workflow's safety properties are protected by
review and by tests that execute the logic the workflow calls, such as the
autotag planner's unit tests. A workflow linter belongs in that list and is not
in it yet: see the ledger.

**Tools.** Rust tests run under `cargo test --workspace`. Node tests run under
`node --test`. Shell-level tests of the CLI, the fixture generators, and the
static server are bats suites under `test/`. `cargo xtask preflight` is the
gate. Property testing, fuzzing, mutation analysis, and interleaving exploration
have no tooling in the workspace yet; the ledger says so, and rules 4, 5, 13,
and 14 say what is owed.

## 1. Test at the narrowest boundary that is a contract

A boundary is a contract when someone outside the change-control of the code
depends on it. If nobody outside the module would have to be told about a
change, it is not a boundary, and a test pinned to it is a liability.

Test through the boundary that owns the behavior: the crate root, the CLI, the
IR. _Narrowest_ matters: "test through the CLI" does not mean test only through
the CLI, which is how a suite becomes a handful of slow end-to-end runs. _Promote
rather than reach_: if an internal needs its own tests, that is a signal it
wants to be a module with its own narrow API. Do not add an accessor "for
tests"; it becomes API.

**Prevents:** refactoring deadlock where every internal move breaks tests;
change detectors; contract-freeze of things that are not contracts.

## 2. Assert on outputs, not internals. Harvest universals, enumerate existentials

Assert what a user or a downstream system observes: the IR, the emitted source,
the hash, the diff classification, the exit status, the refusal message. The
absence of a forbidden effect counts as an output.

When asserting a property over an output (every hash is 64 hex characters, no
generated identifier is a keyword, every field has a type) walk the output and
check every match; do not list the fields you expect. A hand-listed set is blind
to the new field, which is where the next bug arrives. Every harvested assertion
reports a **witness count**: "checked 37 fields" and never "all found fields
passed", because a universal over zero matches passes gloriously. Harvesting
cannot see what is missing, so required things are enumerated separately.
Unknown shapes fail closed.

Interaction assertions are allowed only where the interaction crosses a contract
boundary and _is_ the behavior. Prefer real implementations, then fakes verified
by a contract suite that runs against both the fake and the real thing; mocks
last.

**Prevents:** tests that fail on refactors and pass on bugs; enumeration
blindness; vacuous universals; the drifted fake that keeps a broken integration
green.

## 3. One test per behavior, and every change declares its kind

A method-shaped suite changes every time methods move. A behavior-shaped suite
changes only when promises change. Name a test as a sentence about behavior:
`field_removal_is_breaking`, not `test_diff_2`. One behavior is not one
assertion: several assertions are right when together they establish one
promise. Needing "and" in a name means two tests.

Every pull request declares which of four kinds of change it is, and the test
diff must match:

| Kind            | Tests                                     |
| --------------- | ----------------------------------------- |
| Refactoring     | No test and no golden changes             |
| New feature     | Adds tests; edits none                    |
| Bug fix         | Adds a test, observed red first (rule 12) |
| Behavior change | The only kind that edits an existing test |

If a declared refactoring forces a test edit, either the change affects
behavior or the test was at the wrong level of abstraction.

**Prevents:** suites rewritten whenever methods move; test edits smuggled into
refactorings; the 300-line "behavior" test.

## 4. Every assertion must be shown able to fail

Break the thing an assertion protects, run it, and require it to go red and to
name itself. An assertion that survives the deletion of its own subject is not a
weak test; it is not a test.

Every new or materially changed load-bearing assertion is demonstrated red at
authoring time, and the pull request says how. Prefer a mutation that changes
only what the assertion reads. Four traps:

- **Red for the wrong reason is not evidence.** If the mutation breaks the
  program before the assertion runs, nothing was learned. A compile error is not
  a kill.
- **Stale artifacts.** Make sure the mutated code is what ran.
- **Equivalent mutants are a tax, not a finding.** Do not assert on incidental
  behavior to kill one.
- **Unexecuted assertions.** A test skipped by a filter, stranded after an early
  return, or relying on a missing tool proves nothing. A command that is not
  installed exits 127, which satisfies "expect failure".

Never gate on a mutation score. A percentage re-imports the coverage problem one
level up.

**Prevents:** the vacuous test in all its forms; false all-clears from the
calibration itself; testimony in place of evidence.

## 5. For "nothing changed" claims, use generated evidence

When a promise quantifies over inputs (for all, never, always agrees) the test
must quantify over inputs. Examples are for promises about points; generated
evidence is for promises about spaces.

In Wesley those promises include: lowering is deterministic; the hash ignores
whitespace and comments and nothing else; `normalize_schema_sdl` is idempotent;
the Rust and TypeScript codec emitters agree on the wire; a refactoring of the
lowerer changes no IR. The instruments, weakest machinery first: differential
against the previous commit, differential between two implementations, property
tests, and metamorphic relations where no single-output oracle exists.

Seeds are logged outside the test process. Shrinking is mandatory. Every
minimized counterexample is checked in and replayed forever. State the two lies
of a differential oracle: two implementations can share a misreading, and a
reference can freeze its own bug into the new code.

**Prevents:** false confidence in "this refactor changed nothing", the most
common lie in maintenance; suites that sample a space three times and call it
covered; lost reproducers.

## 6. Every assertion names its oracle

State in one sentence where the expected value comes from. Strongest first:

1. **Specified:** written from a requirement, independently of the code. The
   GraphQL specification is one.
2. **Derived:** a reference implementation or a published vector.
3. **Invariant or relational:** properties and metamorphic relations.
4. **Differential:** the old version, another engine.
5. **Change detection:** goldens and snapshots, where the oracle is whatever the
   code does today.

Class 5 must be labeled and is governed by rule 17. A test that re-implements
the function and compares the two is a tautology. When a class-1 test fails the
code is wrong; when a class-5 test fails something _changed_ and a person must
decide. A suite that cannot say which kind of red it is has only a pass rate.

**Prevents:** the tautological test; a snapshot presented as a specification;
goldens generated from the current build and accepted unread.

## 7. Determinism is constructed, not assumed

A test does not consult the wall clock, the network, ambient randomness, thread
scheduling, or ambient identity unless the harness supplied and logged a
controlled substitute. Every source of nondeterminism enters through a seam, and
the seam's default is deterministic. Never synchronize with a bare sleep; wait
on a condition.

Wesley's core promise is determinism, so this rule guards the product as well as
the suite: the same SDL gives the same IR, hash, and emitted bytes on any
machine. Iteration order, locale, timezone, and path separators are the usual
leaks.

**Prevents:** the failure that reproduces only in CI; the suite that is green
when re-run.

## 8. Hermetic by default

A result depends only on the code under test, checked-in inputs, and the
harness. A test creates what it needs in a sandbox it owns and destroys it. No
ambient network. No shared mutable fixtures. No hardcoded ports: bind port 0 and
read the assignment back. No dependence on a tool the harness did not verify is
present, or on a variable the runner happens to set. A test passes alone,
shuffled, and in parallel with itself.

Share what is a contract: conformance vectors, fixtures, corpora. Do not share
code that merely sets a scene.

**Prevents:** order dependence; "works on my machine"; the test that can never
pass on a runner because the runner sets `GITHUB_SHA`.

## 9. Size classes and a latency budget

| Size   | May use                                       | Budget per test |
| ------ | --------------------------------------------- | --------------- |
| Small  | one process; no network, database, or sleeps  | 100 ms          |
| Medium | one machine; loopback; temp files; subprocess | 5 s             |
| Large  | anything else                                 | declared        |

Rust unit tests are small. Tests that spawn `wesley`, run a generator, or start
the static server are medium. A test that exceeds its class fails review. The
suite budget is a number: `cargo xtask preflight` within 10 minutes on a
developer machine, all bats suites within 60 seconds. A slow suite is an unrun
suite.

**Prevents:** every test paying the slowest test's schedule; the suite that runs
after lunch instead of before merge.

## 10. Flakiness has a policy

A flaky test is a bug in the test or in the system, never a fact of nature. It
leaves the gate the same day, with an owner and an expiry of at most four weeks,
after which it is fixed or deleted. It keeps running and reporting while
quarantined. Nothing is retried into green. Treat every flake as a bug report
about the system until proven otherwise.

**Prevents:** the re-run culture in which red stops being a signal; regressions
hiding in a noise band; the permanent allow-failure lane.

## 11. Coverage is an inspection instrument, never an objective

Coverage answers one question: what did we not exercise? It may be read in
review. No percentage is a gate or a target. Coverage says where tests are not;
rule 4 says whether tests work; never let the first impersonate the second.

**Prevents:** assertion-free tests written to move a number; 80% as a ceiling.

## 12. Every bug fix ships with a test observed red on the unfixed code

A bug is an experimentally confirmed hole in the suite: the one moment you hold
a test guaranteed not to be vacuous. The red is observed on the unfixed code,
not asserted afterwards, and the pull request shows it. The test encodes the
correct behavior at the boundary, not the mechanism of the fix. Fix the class,
not only the instance.

An irreproducible failure converts the obligation: add the instrumentation that
would make the next occurrence self-reporting, widen exploration, and record
what was tried. "Too trivial", "hard to test", and "the patch is obvious" are
not exemptions.

**Prevents:** regressions walking back in through the same hole; folklore in
place of suite state.

## 13. Fuzz what parses; property-test what transforms; keep the corpus

Wesley parses untrusted text: GraphQL SDL, operations, law files, and manifests.
Each of those entry points owes a fuzz target. Each total transformation owes a
property: lowering is deterministic, normalization is idempotent, a codec
round-trips (`decode(encode(x)) == x`), and the Rust and TypeScript codecs agree
byte for byte. Strengthen the oracle past "does not crash" wherever a second
implementation or a round trip exists. The corpus is minimized, checked in, and
replayed in CI on machines that never run the fuzzer.

**Prevents:** the parser as attack surface; the round-trip bug found by the first
user with non-ASCII input; a fuzzer no CI runs.

## 14. Concurrency is tested by exploring interleavings

Looping a racy workload and hoping is a coin flip with a CI budget. Inject
executors so concurrent code runs deterministically; use a seeded scheduler;
explore systematically where the core justifies it. State safety and liveness
separately. Every failure carries its schedule or seed.

Wesley's kernel is synchronous. This rule applies to the `resilience` feature's
async port and its cooperative timeout, and to anything concurrent added later.

**Prevents:** the race that appears once in months; a load test posing as
correctness evidence.

## 15. Durability and recovery promises are tested by seeded fault injection

If the system claims to survive a failed write, a full disk, or an interrupted
run, those faults are injected on a schedule from a seed, including a fault
during recovery from a fault. Wesley writes generated files and publishes
releases; where it promises an all-or-nothing write or a safe re-run, that
promise gets a fault test.

**Prevents:** the recovery path that has never executed.

## 16. Performance tests are controlled experiments

State a hypothesis. Report distributions, not points. Compare against a baseline
measured in the same run, not against a number from another day or another
machine. Validate the harness by showing it can see a deliberately slowed build.
Say exactly how a figure was counted: a dependency count that does not name its
command, its target, and whether it includes the root crate is not a
measurement. `cargo xtask bench-ir` is advisory and gates nothing.

**Prevents:** decisions driven by noise; figures nobody else can reproduce.

## 17. Golden files live under re-baseline discipline

A golden's entire evidentiary value is a person reading its diff. Each one is
minimized to the behavior it guards, canonicalized to remove incidental
variation, and re-baselined only through a diff small enough to read. No bulk
"update all" commits. A golden that moves during a declared refactoring _is_ the
bug report.

Goldens are legitimate where the whole artifact is the contract, which in Wesley
is common: emitted Rust and TypeScript, the L1 IR for a fixture schema, law
diffs, CLI diagnostics. They are class-5 oracles and are labeled as such. Pair
them with an assertion that the emitted code compiles or parses, which is a
stronger oracle than its text.

A reproduced but unfixed bug is pinned as an expected failure that asserts the
_correct_ behavior, with an owner, an issue, and an expiry. An unexpected pass
fails until the pin is removed. A commented-out test is a landfill.

**Prevents:** approval fatigue; the refactoring that silently changed output
because goldens were re-blessed in bulk.

## 18. Test code is production code, with recorded deletion criteria

Review tests as rigorously as production code, and optimize them for
obviousness: straight-line bodies, no conditionals, descriptive names, some
duplication tolerated. A failure message states what was expected, what
happened, and the inputs, well enough that investigation starts from the name
and the message.

A test is deleted when one of these holds, and the commit says which:

- the behavior it protected was removed;
- a stronger, cheaper test subsumes it;
- it passed its quarantine expiry;
- it is a golden nobody can interpret any more;
- it fails rule 4 and nobody can say what it protects;
- it is not a test of behavior at all: it searches documentation, configuration,
  or source text.

Deleting a red test to make CI green is not a criterion. Deleting a test is a
coverage decision: say where the displaced risk now lives.

**Prevents:** the suite as landfill; `expected false to be true` and nothing
else; deletion as cleanup.

## 19. CI gates on trustworthy signals, and on nothing else

**May gate:** the hermetic Rust, Node, and bats suites, green with no retries;
clippy and formatting; `lean-core-check`; link resolution; registered-command
checks; `cargo audit` at release; crash-level fuzz findings once targets exist.

**May not gate:** coverage percentages; mutation scores; advisory benchmarks;
anything whose natural variance exceeds its threshold; anything retried into
green; anything that reads prose.

A failure blocks by default and has an owner. A broken `main` outranks feature
work. Before trusting a green check, find out what it looked at: a check that
examined one crate, zero suites, or the local checkout instead of the registry
reports success just as confidently.

**Prevents:** required checks nobody believes; green that means "did not look".

## Test types, oracles, and what they are for

| Test type            | Oracle (rule 6)             | Use it for                               |
| -------------------- | --------------------------- | ---------------------------------------- |
| Behavioral example   | specified (1)               | one promise at one point                 |
| Boundary case        | specified (1)               | discontinuities                          |
| Property             | invariant (3)               | promises over a space of inputs          |
| Metamorphic          | relational (3)              | where no single right answer is known    |
| Differential         | derived or differential     | equivalence and "nothing changed" claims |
| Golden               | change detection (5)        | artifacts that are themselves contracts  |
| Expected failure pin | specified, inverted (1)     | known bugs awaiting a fix                |
| Fuzz                 | no crash, or differential   | parsers at a trust boundary              |
| Contract suite       | shared across real and fake | keeping a double honest                  |
| Fault injection      | specified under failure     | recovery promises                        |
| Performance          | same-run baseline           | regression detection                     |

## Wesley risk map

| Risk                                            | Boundary           | Oracle                          | Blind spot today                      |
| ----------------------------------------------- | ------------------ | ------------------------------- | ------------------------------------- |
| The hash changes for an unchanged schema        | registry hash      | specified; metamorphic          | no generated inputs                   |
| Two machines lower the same SDL differently     | L1 IR              | differential across platforms   | CI runs one platform                  |
| A breaking change is classified as safe         | `schema diff`      | specified from the GraphQL spec | examples only                         |
| Emitted code does not compile                   | emitted source     | the compiler                    | TypeScript output is not type-checked |
| Rust and TypeScript codecs disagree on the wire | LE-binary codecs   | differential between the two    | no cross-language round-trip test     |
| Malformed SDL crashes or hangs the parser       | `lower_schema_sdl` | no crash; then differential     | no fuzz target                        |
| A release publishes the wrong or partial set    | `cargo xtask`      | the registry, asked directly    | the publish path runs only for real   |

## Compliance ledger at adoption

Recorded on 2026-09-20. Each line is a debt, not an excuse.

- **Rule 1.** At adoption, 112 of 128 bats tests, 16 xtask unit tests, and
  assertions inside two `wesley-core` tests searched documentation, workflow
  YAML, or source text. They were removed under rule 18's last criterion.
  `crates/wesley-holmes/tests/architecture.rs` has not been reviewed against
  this rule.
- **Rule 4.** No mutation tooling. Calibration is by hand, recorded in commit
  messages and pull requests. Most inherited assertions have no recorded
  demonstration.
- **Rules 5 and 13.** No property-testing or fuzzing dependency in the
  workspace. No fuzz target exists for any parser. No corpus.
- **Rule 6.** Inherited tests do not name their oracles. Goldens are not labeled
  as class 5.
- **Rule 8.** `law_backed_generated_rust_compiles_as_crate` in
  `wesley-emit-rust` is not hermetic. It writes a manifest that depends on
  `serde` from crates.io and runs `cargo check` on it with no offline or
  vendored source, so `cargo test --workspace` fails on a runner without
  registry access. It is the only test that does this.
- **Rule 9.** Size classes are not declared or enforced.
- **Rule 14.** The `resilience` feature's async policy is tested with real
  timers.
- **Rule 17.** Fixture goldens under `test/fixtures/` have no re-baseline
  procedure beyond review.
- **Rule 19.** Nothing lints the workflows. `actionlint` is configured in
  `.pre-commit-config.yaml`, which the installed hooks do not run, and no
  workflow or preflight invokes it, so a malformed workflow is caught by review
  or not at all. Tracked in issue 828.

## Reviewer checklist, ordered by kill rate

The first five catch most of what matters. A "no" needs a revision or a written
risk decision.

1. Was every new load-bearing assertion shown able to fail, and did the failure
   name the check? (4)
2. Can the oracle be stated in one sentence? If it is a golden, is it minimized
   and is the diff small enough to read? (6, 17)
3. For a bug fix: where is the test observed red on the unfixed code? (12)
4. Does the pull request declare its kind of change, and does the test diff
   match? (3)
5. Does the test enter through the narrowest contract boundary and execute
   something? Does any assertion read documentation, configuration, or source
   text? (1, 18)
6. Do assertions read observable outcomes? Do universals report a witness count?
   (2)
7. Is it hermetic and deterministic: owned scratch space, no network, no bare
   sleeps, no unverified tools, no ambient variables? (7, 8)
8. Is the name a sentence about behavior, and the body straight-line? (3, 18)
9. For generated tests: seed logged, shrinking on, counterexample checked in?
   (5, 13)
10. For a figure: can someone else reproduce it from what is written? (16)
11. Are tests being deleted? Which criterion fired, and where does the risk now
    live? (18)
12. Does any new gate read a signal that can be trusted, and do we know what it
    looks at? (19)

## Positions on contested questions

- **Mocks.** Real implementations by default; doubles only at owned boundaries
  and verified by contract; interaction assertions only where the interaction is
  the behavior.
- **Coverage numbers.** A signal in review, never a target.
- **Red first.** The portable standard mandates only that a test has been seen
  red for the right reason, and mandates the order for bug fixes alone. This
  profile is stricter, to agree with the repository's operating rules: in
  Wesley, write the test first and watch it fail, for every kind of change. For
  a bug fix the red is also the diagnosis.
- **Test plans.** No prose plans that enumerate cases; a well-named suite is the
  plan. The risk map above is reviewed when it is wrong.
- **Pyramid ratios.** None is mandated. Small tests dominate because speed and
  determinism are what a gate needs.

## The standard, compressed

1. Test at the narrowest boundary that is a contract; promote an internal to a
   module before testing it.
2. Assert observable outcomes; harvest universals with a witness count;
   enumerate existentials.
3. One behavior per test; every change declares its kind; only a behavior change
   edits an existing expectation.
4. Every load-bearing assertion is shown able to fail and names itself; never
   gate on a mutation score.
5. Equivalence claims are proven by generated evidence, with seeds logged,
   shrinking on, and counterexamples kept.
6. Every assertion names its oracle; change detection is legitimate only when
   labeled, minimized, and reviewed.
7. Determinism is constructed at seams for time, randomness, scheduling,
   environment, and identity.
8. Hermetic by default: owned scratch state, no ambient network, no shared
   mutable fixtures, no unverified tools.
9. Size classes with budgets; the suite has a latency budget.
10. Flakes leave the gate the same day with an owner and an expiry, and are
    never retried into green.
11. Coverage maps what was not exercised; it is never a target.
12. Every bug fix ships a test observed red on the unfixed code.
13. Fuzz what parses, property-test what transforms, keep the corpus.
14. Concurrency is tested by exploring interleavings with recorded schedules.
15. Durability and recovery promises are tested by seeded fault injection.
16. Performance tests are controlled experiments, and every figure says how it
    was counted.
17. Goldens are minimized, canonicalized, and re-baselined only through reviewed
    diffs; known failures are pinned, not commented out.
18. Test code is production code, deletable only under a recorded criterion.
19. CI gates on trustworthy signals and on nothing else, and we know what each
    gate looks at.

A good test is a deterministic, self-contained experiment that fails if and only
if a stated promise is broken, and whose failure names the promise.
