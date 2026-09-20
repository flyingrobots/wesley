---
Status: Accepted
Binding: true
Adopted: 2026-09-20
Scope: every Rust source file, Cargo manifest, lockfile, and toolchain or lint configuration in this repository
Basis: the Keep Rust Engineering Standard; this is its binding Wesley profile
Posture: strict by default; an exception requires a written reason
---

# Rust Engineering Standard

Section numbers follow the Keep standard so that the two can be read side by
side. Where Keep speaks about storage, this profile speaks about a compiler.
Sections that do not apply to Wesley say so instead of being dropped.

**Primary objective:** make incorrect compiler behavior difficult to express,
easy to find, and impossible to merge unnoticed.

**How to read this.** Sections 1 to 28 state requirements. They are written in
the present tense, as the state the repository is required to reach. They do not
describe the repository as it is: the [compliance ledger](#compliance-ledger-at-adoption)
at the end does that, and [CI](ci.md) says what is checked today. Where a
section says something "runs" or "is gated", read "must".

## 1. Governing doctrine

Wesley is compiler infrastructure. Other systems store its hashes, compile its
output, and gate releases on its diffs. It does not get to be "probably
correct", clever but undocumented, tolerant of malformed input, dependent on the
machine it ran on, difficult to search, difficult to review, or difficult to
delete.

The priorities, in order:

1. **Correctness**
2. **Determinism**
3. **Auditability**
4. **Maintainability**
5. **Predictability**
6. **Performance**
7. **Convenience**

Determinism is second only to correctness because it is Wesley's product: the
same schema gives the same IR, the same hash, and the same emitted bytes on
every machine. A slower implementation with explicit invariants is preferable
to a faster one whose safety depends on tribal knowledge.

## 2. Toolchain

**2.1 Edition.** The workspace uses `edition = "2024"` and pins an explicit
stable toolchain in `rust-toolchain.toml`, with `clippy`, `rustfmt`, and
`rust-src`. CI never uses an unpinned `stable`. A toolchain upgrade is its own
pull request, carrying the version change, the formatter and clippy diffs, the
dependency-resolution diff, test results, and any newly allowed lint with its
reason.

**2.2 MSRV.** Every published crate declares `rust-version`. MSRV is a contract
with everyone who depends on the crates. CI checks it:
`cargo +${MSRV} check --workspace --all-targets --all-features`. Raising it
needs its own pull request, a changelog entry, and a reason.

**2.3 Formatting.** Formatting is not discussed in review. CI runs
`cargo fmt --all --check` on stable `rustfmt`, with `rustfmt.toml` stating
`edition`, `style_edition`, `max_width = 100`, and `newline_style = "Unix"`. No
manual alignment. The formatter wins.

## 3. Compiler and lint policy

**3.1 Workspace lints.** Every crate inherits `[workspace.lints]`. The Rust
lints forbid `unsafe_code` and deny `missing_docs`, `unused_must_use`,
`unreachable_pub`, `unexpected_cfgs`, `rust_2018_idioms`, and
`rust_2024_compatibility`. The clippy lints deny `all`, `pedantic`, and
`nursery`, and specifically: `unwrap_used`, `expect_used`, `panic`, `todo`,
`unimplemented`, `dbg_macro`, `exit`, `indexing_slicing`, `integer_division`,
`arithmetic_side_effects`, `as_conversions` and the `cast_*` family,
`mem_forget`, `needless_pass_by_value`, `needless_collect`, `implicit_clone`,
`clone_on_ref_ptr`, `string_slice`, `wildcard_imports`, `enum_glob_use`,
`missing_errors_doc`, and `missing_panics_doc`. `module_name_repetitions` and
`must_use_candidate` are allowed.

`print_stdout` and `print_stderr` are denied in library crates. `wesley-cli` and
`xtask` are programs whose contract is what they print, so they allow those two
lints at the crate root, with that reason.

Clippy's pedantic group is aggressive and produces false positives. That is
accepted. Exceptions are local and justified; the workspace is not weakened.

**3.2 No broad suppression.** `#![allow(clippy::pedantic)]`,
`#![allow(dead_code)]`, and `#[allow(warnings)]` are forbidden. An exception
targets one lint, in the smallest scope, with a `reason` that says why the code
is clearer or safer with it. An exception without a reason fails CI
(`allow_attributes_without_reason`).

**3.3 Invocation.** CI runs clippy twice, because "all features pass" does not
prove the lean build compiles, and Wesley ships a lean build:

```bash
cargo clippy --workspace --all-targets --all-features --locked -- -D warnings
cargo clippy --workspace --all-targets --no-default-features --locked -- -D warnings
```

## 4. Unsafe Rust

`unsafe` is forbidden: `#![forbid(unsafe_code)]` in every crate. A compiler that
parses text and prints text has no need of it. If that ever changes, the unsafe
code lives in a dedicated crate with `#![deny(unsafe_op_in_unsafe_fn)]`, no
unrelated logic, a `SAFETY:` comment proving the preconditions of every block,
Miri-compatible tests, and a written analysis of the alternatives. "Required for
performance" is not a proof.

## 5. Repository and crate structure

**5.1 Crate split rule.** A new crate is allowed only when it establishes an
enforceable dependency boundary, isolates `unsafe`, supports a materially
different platform, avoids forcing heavy dependencies on core consumers, has an
independent public API and release purpose, substantially improves compile
times, or is a reusable conformance package. "The file count is getting large"
is not a reason.

**5.2 Dependency direction.** Acyclic and obvious:

```text
wesley-core            IR, hashing, lowering, diff, law
      ↓
wesley-emit-codec      codec plan
      ↓
wesley-emit-rust, wesley-emit-typescript
      ↓
wesley-cli
```

Lower layers never import the CLI, an emitter, logging policy, or a
higher-level error type. `wesley-core` attaches no database, runtime, or product
behavior to any directive or target: it records what the schema says. It does
canonicalize a fixed set of directive aliases, which
[architecture](architecture.md) lists, and any addition to that set changes
hashes and is a format change under section 14. A cycle disguised
through a trait is still a cycle.

## 6. File size and findability

These limits are intentionally severe.

**6.1 Files.** Counted as nonblank, non-comment lines. Target 200. Review
required above 300. **Absolute maximum 500**; tests 750. Generated code is
exempt only in clearly marked directories. A file above 500 lines does not
merge.

**6.2 Functions.** Target 20 logical lines; maximum 60. Cognitive complexity at
most 12. Nesting at most 3. Parameters at most 5. **Boolean parameters: none.**
Tuple returns at most 3 wide. A parser's state machine may exceed the function
limits only when its states are named, its transitions are exhaustive, and every
transition is tested.

**6.3 Modules.** Each module can finish the sentence "this module owns…". If
the answer needs "and" more than once, the module is too broad. A `mod.rs` holds
declarations, re-exports, module documentation, and very small coordination
logic.

**6.4 Forbidden file names.** `utils.rs`, `helpers.rs`, `common.rs`, `misc.rs`,
`shared.rs`, `manager.rs`, `service.rs`, `types.rs`, `models.rs`. They hide
ownership. `error.rs` is permitted.

**6.5 Findability.** Someone unfamiliar with the code finds a concept by
filename search within two attempts. Public nouns map to modules: `WesleyIR` in
`ir`, `SchemaDelta` in `schema_delta`, `SchemaOperation` in `operation`.

## 7. Naming

Follow the Rust API Guidelines: getters omit `get_`; `into_` consumes, `as_`
borrows, `to_` may be expensive.

**7.1** Names carry meaning. Not `data`, `info`, `item`, `ctx`, `mgr`,
`handler`, `process`, `do_work`. Single letters are for trivial iterators,
generic parameters, and very short closures.

**7.2** Acronyms are words: `SdlHash`, `IrVersion`, `IoError`; not `SDLHash`.

**7.3** Units and meaning live in types, not in names or comments. A `String`
that is a registry hash is a `RegistryHash`.

## 8. Type system

**8.1 No primitive obsession.** Values with distinct meaning get distinct types:
type names, field names, directive names, registry hashes, content hashes, IR
versions, schema paths. A function that takes three `&str` has three chances to
be called wrongly.

**8.2 Illegal states are unrepresentable.** Use an enum with data, not a struct
of flags and options that must agree.

**8.3 Parse, then validate, then admit.**

```text
SDL text  →  parsed document  →  validated, lowered IR  →  emitted or hashed
```

Untrusted text is never deserialized straight into a type whose existence
implies validity.

**8.4 No boolean parameters** in public functions. Use an enum that says what
the choice is.

**8.5 `Option` means absence, not failure.** A missing required thing is an
error with a name.

**8.6 Collections.** Slices over `&Vec<T>`. Iterators over needless collection.
**`BTreeMap` wherever order can reach an output.** `HashMap` only where
iteration order cannot affect behavior. Never derive the IR, a hash, or emitted
source from `HashMap` iteration: that is a determinism bug that passes every
test on the machine that wrote it.

## 9. Errors

**9.1 No panics in library paths.** Malformed SDL, a missing file, an
unsupported version, an overflow: each is a typed error. `unwrap`, `expect`,
`panic!`, `todo!`, `unimplemented!`, and `unreachable!` are forbidden outside
tests. `unreachable!` is still a panic; model the state space so it is not
needed.

**9.2 Errors are domain artifacts**, typed by the boundary that failed: a
lowering error, a diff error, a law validation error, a manifest error. No
single universal error internally; a facade may aggregate.

**9.3 Variants are actionable.** Not `InvalidData`. Say what failed, which
named thing was involved, what was expected, and what was observed, with the
source location in the schema where there is one.

**9.4 Preserve sources.** Never stringify an error early.

**9.5 Messages** begin lowercase, have no trailing period, do not repeat the
type name, and carry stable facts. Nobody should have to parse an error string.

## 10. Arithmetic and bounds

**10.1** Externally influenced arithmetic is checked: `checked_add`, not `+`.

**10.2** `usize::try_from(value)?`, never `value as usize`.

**10.3** `slice.get(range)`, never `&slice[a..b]`, in production paths.

**10.4 Explicit bounds.** Every parser and every collection built from input
has a limit, and rejects before allocating: schema size, type count, field
count, nesting depth of types and selections, directive argument size, list
wrapping depth. A schema is an input from a stranger.

## 11. Ownership and allocation

Borrow by default. Every nontrivial `.clone()` is review-worthy; "the borrow
checker was annoying" is not a reason. `Arc` is for genuine shared ownership. An
API that allocates in proportion to its input says so in its name and
documentation. Do not preallocate from an untrusted declared length.

## 12. Concurrency

The kernel is synchronous and stays synchronous until a real consumer proves
otherwise. Async lives above it, behind a feature, as the `resilience` feature
does today. Channels are bounded. A lock-owning type documents what it protects,
its lock order, and whether I/O may happen while it is held. Do not introduce an
async trait because something might block one day.

## 13. Files and output

Keep's durability rules are about a storage engine and do not apply. What
applies to a tool that reads and writes files:

- A file existing proves nothing about its content. Validate what was read.
- Use `write_all`. Never assume one `write` wrote everything.
- A command that writes generated output writes all of it or reports failure. It
  does not leave a half-written file that looks finished: write to a temporary
  file in the same directory and rename.
- `Drop` is not relied on for anything that can fail.
- Output does not depend on the working directory, the locale, the timezone,
  the path separator, or the order in which the filesystem lists a directory.

## 14. Formats are protocols

The L1 IR, the registry hash, the LE-binary codec layout, the law IR, and the
manifests are contracts with other systems, not implementation details.

**14.1** Each has a version, a canonical encoding, explicit endianness where it
is binary, fixed limits, defined behavior for an unknown version, and golden
fixtures.

**14.2 Serde assists; it does not define.** "The format is whatever
`serde_json` emits for this struct today" is not a format. The JSON Schemas in
`schemas/` are the definition, and the hash is computed over a canonical form
that is specified, not inherited.

**14.3 Decoders** reject trailing bytes, duplicate fields, non-canonical
encodings, unknown mandatory flags, and anything over a limit.

**14.4 Round-trip is not enough.** `decode(encode(x)) == x` passes when encoder
and decoder share a bug. Add golden bytes, and compare the Rust and TypeScript
codecs against each other.

## 15. Public API

**15.1** Everything is private by default. `pub(crate)` before `pub`. A symbol
becomes public when a consumer needs it, its invariants are stable, it is
documented, and it is tested through the public API. `pub use` is deliberate.

**15.2** Validated types do not expose public fields. They have checked
constructors.

**15.3** Types that represent unfinished or consequential work are
`#[must_use]`.

**15.4** Public enums that may grow are `#[non_exhaustive]`. Enums describing a
frozen wire value reject unknown values explicitly instead.

**15.5** Do not make an API generic to look flexible. Be generic at stable
boundaries and concrete inside.

**15.6** Builders only where construction is genuinely complex. Required fields
stay required.

## 16. Documentation

**16.1** `missing_docs = "deny"`. Every public item says what it means, its
invariants, how it fails, whether it allocates in proportion to its input, and
whether it performs I/O.

**16.2** Fallible functions have `# Errors`. Anything that can panic has
`# Panics`; for library APIs the expected content is "This function does not
intentionally panic."

**16.3 Examples are tests.** Every important public workflow has a compiling
documentation example, run by `cargo test --doc`.

**16.4** Comments explain why, invariants, non-obvious ordering, and format
constraints. They do not narrate syntax.

**16.5 Decisions.** A decision that changes the IR, the hash, a wire format, a
public API's compatibility, or the dependency direction is recorded in the pull
request that makes it and in `CHANGELOG.md`. There is no design archive in the
tree; Git is the archive.

## 17. Testing

[The testing standard](testing-standard.md) is binding and governs every
assertion. What this profile adds for Rust:

- Test names state the law: `field_removal_is_breaking`, not `test_diff`.
- Assert the whole error: `assert!(matches!(result, Err(E::Variant { .. })))`
  with its fields, not `assert!(result.is_err())`.
- At least half of behavioral tests use a crate exactly as an external consumer
  would, from `tests/`.
- Run tests in both profiles: `cargo test --workspace --all-features --locked`
  and again with `--release`, because overflow and optimization-sensitive
  behavior differ.
- No coverage percentage is a target. Keep sets one; Wesley's testing standard
  forbids it, and that rule wins here.

## 18. Benchmarks

Benchmarks are regression instruments, not advertisements. `cargo xtask
bench-ir` is advisory. A benchmark reports distributions against a baseline
measured in the same run, and says exactly how it was measured. "Faster" code
that weakens validation, drops a limit, or reduces determinism does not merge.

## 19. Dependencies

**19.1** Every dependency adds API risk, supply-chain risk, compile cost, MSRV
pressure, and maintenance. A new one needs written answers: why is it needed;
why not the standard library; why not fifty lines of local code; what unsafe
code does it contain; what is its MSRV; is it maintained; does it enter the
public API; which features are enabled; what arrives transitively; what is the
exit strategy.

**19.2** Features are chosen deliberately: `default-features = false` plus the
ones needed. Using defaults needs a reason. `wesley-core` with default features
off must stay free of an async runtime, and `cargo xtask lean-core-check`
enforces it.

**19.3** A dependency's type does not appear in a public API unless that
dependency is deliberately part of the stability contract.

**19.4** `cargo deny check` and `cargo audit` are required in CI, over the whole
workspace. Neither runs on a pull request today: there is no `deny.toml`, and
`cargo audit` runs only inside `release-guard`. The ledger carries both. `deny.toml` admits only licenses compatible with Apache-2.0. The
lockfile is committed. Published crates pin their siblings exactly.

## 20. Features

Features are additive. None may change the meaning of an existing API, the IR,
a hash, or a canonical encoding, or weaken validation. Feature combinations are
tested, not only `--all-features`.

## 21. Logging

Library crates do not print. Diagnostics are return values. If tracing is added
it sits behind an optional feature and carries no schema content that a user
might consider sensitive.

## 22. Pull requests

Small enough to review rigorously: at most about 400 changed non-generated
lines, about 10 production files, one purpose, no unrelated cleanup. A larger
one says why. Every description covers:

```text
Problem
Invariant affected
Approach
Alternatives rejected
Failure modes
Tests added
Kind of change (refactoring, feature, bug fix, or behavior change)
Format/API compatibility
Determinism implications
Security implications
```

A commit does not mix mechanical refactoring with semantic change.

## 23. Review

Reviewers ask: what invariant does this establish; what malformed input can
reach this branch; which arithmetic is externally influenced; what is the
maximum allocation; is iteration order observable in any output; could this API
represent an invalid state; does this error lose context; is the hash still
stable; can the behavior be tested without private access; is this abstraction
simpler than the code it replaced?

"Looks good" is not a review of IR, hashing, wire-format, or diff-classification
code. Those need the reviewer to restate the invariant in their own words.

## 24. CI gates

This is the required set, not a description of what runs today.
[CI](ci.md) says what runs today, and the ledger below lists what is missing.
Every pull request is required to pass:

```bash
cargo fmt --all --check
cargo check  --workspace --all-targets --all-features       --locked
cargo check  --workspace --all-targets --no-default-features --locked
cargo clippy --workspace --all-targets --all-features       --locked -- -D warnings
cargo clippy --workspace --all-targets --no-default-features --locked -- -D warnings
cargo test   --workspace --all-features --locked
cargo test   --workspace --all-features --release --locked
cargo test   --workspace --doc --locked
cargo +${MSRV} check --workspace --all-targets --all-features --locked
cargo deny --workspace check
cargo xtask lean-core-check
```

Markdown link resolution is gated today. **Not yet gated, and therefore resting
on review:** source-file line limits, forbidden file names, function limits, and
committed generated-code cleanliness. Nothing in `cargo xtask` or any workflow
inspects them, so a new 600-line file or a `utils.rs` passes every check. They
become gates when a check exists that executes and can fail; the ledger below
carries that debt. `cargo audit` gates a release. Before trusting any gate, know what it looks at: a gate that examined
one crate, or no suites, reports success too.

## 25. Forbidden patterns

`unwrap()`, `expect()`, `panic!()`, `todo!()`, `unimplemented!()`,
`unreachable!()`, `dbg!()`, `process::exit()` outside a program's `main`,
`unsafe`, `static mut`, `mem::forget()`, `Box::leak()`; and `println!`/`eprintln!`
in library crates.

Also: public boolean parameters; stringly typed identities; implicit integer
casts; unchecked indexing; unbounded channels; ambient global configuration;
hidden filesystem or network access; hidden allocation proportional to input;
wall-clock time or randomness in anything that reaches an output; hashing
whatever a serializer happens to emit; catch-all error strings; silently
repairing malformed input; output that depends on hash-map iteration;
constructors that bypass validation; tests that sleep to synchronize.

## 26. Rust philosophy

- **Rust is not Java with ownership errors.** Build values and transitions
  (`ParsedSchema`, `WesleyIR`, `SchemaDelta`), not `SchemaManager` and
  `LoweringService`.
- **Traits are not interfaces for everything.** Create one when several
  implementations exist now and consumers need substitution. Concrete types are
  good.
- **Enums beat flag soup.** Do not encode a state machine in six booleans.
- **Ownership is architecture.** Design who owns a value before appeasing the
  borrow checker.
- **Lifetimes are not merit badges.** A readable owned value is sometimes right.
- **Zero-copy is not automatically better.** Measure first.
- **Macros need suspicion.** Avoid ones that invent a mini-language, hide
  control flow, or make symbols unsearchable.
- **Generic code is paid for in comprehension.**
- **Explicit beats magical.** Boring code: parse, validate, lower, hash, emit,
  each a visible call.
- **The type system proves structure, not reality.** A type can prove the
  program went through a constructor. It cannot prove the constructor checked
  what it claims.

## 27. Judgment

- **The file-size limit is about ownership, not size.** A 900-line file usually
  means several concepts share a namespace because nobody decided where the
  seams are. Splitting blindly is also bad: one concept should be understandable
  without loading an unrelated one.
- **Complexity is stored confusion.** Account for it and bound it.
- **Every hidden assumption becomes a bug report later.** A sentence beginning
  "normally", "this cannot happen", or "the input will already be" becomes a
  proven invariant, a validated precondition, a typed error, or a test.
- **Malformed input is part of the model**, not an exception to it.
- **Abstraction debt is real debt.** Add an abstraction only where it removes
  more reasoning than it introduces.
- **Make the good path obvious and the dangerous path loud.**
- **Quality is not prettiness.** It means invariants are local, behavior is
  searchable, errors preserve truth, allocation is bounded, arithmetic is
  checked, and no claim is stronger than its evidence.

## 28. Final law

Wesley has one unforgiving promise:

> The same schema gives the same IR, the same hash, and the same emitted bytes
> on every machine, and they mean what the schema says, or Wesley refuses.

No silent fallback. No best-effort lowering presented as success. No output that
depends on where or when it was produced. No directive given a meaning the
schema did not give it. Wesley either knows and says so, or it tells the truth
about what it could not do.

## Compliance ledger at adoption

Measured on 2026-09-20. This standard binds all new and materially changed code
from adoption. Existing code is not presumed compliant, and none of it is
exempt: each line below is a debt with a direction.

| Section | Requirement                         | State at adoption                                                    |
| ------- | ----------------------------------- | -------------------------------------------------------------------- |
| 2.1     | edition 2024, pinned toolchain      | all 7 manifests are edition 2021; no `rust-toolchain.toml`           |
| 2.2     | `rust-version` declared, MSRV in CI | declared in 0 of 7 manifests; no MSRV job                            |
| 2.3     | `rustfmt.toml`                      | absent; `cargo fmt --check` runs with defaults                       |
| 3.1     | `[workspace.lints]` inherited       | absent; clippy runs with defaults and `-D warnings`                  |
| 3.3     | clippy on the lean build            | only the default feature set is linted                               |
| 6.1     | source files at most 500 lines      | 19 of 70 exceed it; the largest is `xtask/src/main.rs` at 4,115      |
| 9.1     | no `expect`/`panic` in library code | 131 `.expect(`, 2 `panic!`, 1 `unreachable!`, 1 `.unwrap()` in `src` |
| 10.2    | no `as` conversions                 | 4 in `src`                                                           |
| 13      | generated output written atomically | `wesley-cli` writes every output with a truncating `fs::write`       |
| 19.4    | `cargo deny` over the workspace     | no `deny.toml`; `cargo audit` runs at release only                   |
| 24      | release-profile and doc tests in CI | not run                                                              |
| 6, 24   | file, function, and filename limits | no check exists; enforced by review only                             |

Counts are of lines matching the pattern under `crates/*/src`, nonblank and
non-comment for file sizes. Some `println!` calls in `wesley-cli` are its
contract and are not debts.

**The ratchet.** Until a row is cleared:

1. New files obey every limit from their first commit.
2. A file over a limit does not grow. A change that adds to one also moves
   something out of it.
3. A touched function is left compliant: no new `expect`, `unwrap`, `as`, or
   unchecked index, and the ones in the lines being changed are removed.
4. Turning on a lint is its own pull request, with the diff it forces.
5. The counts above only go down. A pull request that raises one says why.
