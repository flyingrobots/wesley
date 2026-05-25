# Canonicalization And Diagnostics

## Status

Design-lock substrate for `WLAW-005`, `WLAW-006`, and `WLAW-007`.

This note defines how Law IR v1 becomes stable bytes and how the first compiler
diagnostics must behave.

## Canonicalization Goal

Two semantically identical active Law IR bundles must produce the same
`lawHash`, regardless of:

- YAML key order;
- file order;
- comments;
- whitespace;
- source spans;
- rationale prose;
- omitted defaults that equal explicit defaults.

If this is not true, law diffs become noise and generated artifacts lose
traceability.

## Canonical Codec

Canonical bytes use:

```text
wesley.law-ir.canonical-json.v1
```

This codec is a Wesley-owned canonical JSON profile.

## Canonical JSON Rules

Canonical JSON v1 uses:

- UTF-8 bytes;
- no insignificant whitespace;
- lexicographic object key ordering by Unicode scalar value;
- lowercase JSON literals;
- decimal integer representation with no leading zeroes;
- strings escaped according to JSON, with no optional escaping except where
  required;
- explicit defaults materialized before serialization;
- `null` omitted unless a field explicitly distinguishes null from absent.

Floating point values are not admitted to Law IR v1.

## Entry Ordering

Before hashing:

- active law entries sort by `id`;
- registry resources sort by `id`;
- registry verifiers sort by `id`;
- registry channels sort by `name` then `version`.

Duplicate ids are rejected before canonicalization.

## Array Semantics

Every Law IR array is classified as set-like or order-sensitive.

Set-like arrays:

- sort lexicographically after binding;
- reject duplicates;
- hash independent of authored order.

Order-sensitive arrays:

- preserve authored semantic order;
- reject duplicates only where the specific law kind requires uniqueness;
- hash with order.

| Field | Semantics |
| --- | --- |
| `entries` | set-like by `id`. |
| `tags` | set-like. |
| `requires` / `forbids` | set-like. |
| scalar `forbids` | set-like. |
| footprint `reads` / `writes` / `creates` / `forbids` | set-like. |
| footprint `slots` | set-like by `name`. |
| footprint `closures` | set-like by `name`. |
| footprint `createSlots` | set-like by `name`. |
| footprint `updates` | set-like by `slot` plus field set. |
| channel `messages` | order-sensitive. |

Channel messages are order-sensitive because ordered channel law may care about
message family presentation and stable manifest output.

## Default Materialization

The canonicalizer materializes these v1 defaults:

| Field | Default |
| --- | --- |
| common `tags` | `[]` |
| scalar `opaque` | `false` |
| variant case `requires` | `[]` |
| variant case `forbids` | `[]` |
| footprint `reads` | `[]` |
| footprint `writes` | `[]` |
| footprint `creates` | `[]` |
| footprint `forbids` | `[]` |
| footprint `slots` | `[]` |
| footprint `closures` | `[]` |
| footprint `createSlots` | `[]` |
| footprint `updates` | `[]` |
| channel compatibility `semverCoupled` | `false` |

## Hash Set

The contract bundle records:

| Hash | Source |
| --- | --- |
| `schemaHash` | canonical Shape IR. |
| `lawHash` | canonical active semantic Law IR. |
| `profileHash` | canonical Policy/Profile IR, or a known empty-profile hash. |
| `bundleHash` | schema hash, law hash, profile hash, compiler identity, and codec ids. |
| `lawDocumentHash` | optional provenance-bearing law document hash. |

`lawHash` must not include rationale prose or comments. `lawDocumentHash` may
include rationale and provenance so audits can distinguish semantic changes
from documentation changes.

## Active Versus Draft

Authoring files may contain:

```yaml
status: active
```

or:

```yaml
status: draft
```

Default status is not allowed in v1 authoring files. Authors must choose.

Active entries:

- must bind;
- must validate;
- enter canonical Law IR;
- affect `lawHash`;
- may affect generated artifacts.

Draft entries:

- may be emitted by `wesley init-law`;
- do not enter canonical Law IR;
- do not affect `lawHash`;
- do not affect generated artifacts;
- may have unresolved subjects without failing bundle compilation.

## Diagnostic Contract

Diagnostics must be stable enough for tests and operators.

Minimum fields:

```text
code
severity
message
lawId?
subject?
path?
schemaHash?
closestMatches?
```

Severity values:

```text
error
warning
info
```

Active law validation failures are errors. Draft law suggestions may produce
warnings.

## v1 Diagnostic Catalog

| Code | Severity | Meaning |
| --- | --- | --- |
| `WESLAW_SCHEMA_HASH_MISMATCH` | error | Law anchor does not equal active schema hash. |
| `WESLAW_INVALID_COORDINATE` | error | Subject or reference coordinate does not parse. |
| `WESLAW_UNRESOLVED_SUBJECT` | error | Active law subject does not bind. |
| `WESLAW_WRONG_SUBJECT_KIND` | error | Law kind is not valid for the bound subject kind. |
| `WESLAW_UNKNOWN_KIND` | error | Active entry uses a kind outside Law IR v1. |
| `WESLAW_DUPLICATE_ID` | error | Two active entries share a law id. |
| `WESLAW_UNRESOLVED_REFERENCE` | error | A field, enum value, argument path, resource, verifier, or channel carrier does not bind. |
| `WESLAW_CONFLICT` | error | Two active entries assert contradictory semantics. |
| `WESLAW_OVERLAY_RELAXATION` | error | Overlay weakens base law. |
| `WESLAW_CHANNEL_VERSION_MISMATCH` | error | Channel coordinate version and law body version disagree. |
| `WESLAW_RAW_EXPR_REJECTED` | error | Active invariant uses raw executable expression text. |
| `WESLAW_DRAFT_UNBOUND` | warning | Draft suggestion does not currently bind. |

## Diagnostic Examples

Schema hash mismatch:

```text
error[WESLAW_SCHEMA_HASH_MISMATCH]:
  law document expects schema hash sha256:111...
  active schema hash is sha256:222...

  law:
    family: jedit-hot-text-runtime
    path: test/fixtures/weslaw/rejected/schema-hash-mismatch.weslaw.yaml
```

Unresolved subject:

```text
error[WESLAW_UNRESOLVED_SUBJECT]:
  unresolved operation coordinate operation:Mutation.replaceRange

  law:
    id: jedit.op.replaceRange.footprint
    subject: operation:Mutation.replaceRange

  closest matches:
    operation:Mutation.replaceRangeAsTick
```

Raw expression rejected:

```text
error[WESLAW_RAW_EXPR_REJECTED]:
  invariant law cannot use raw executable expr text in Law IR v1

  law:
    id: continuum.invariant.translated-evidence-not-native
```

## Non-Determinism Guardrails

The canonicalizer must not read:

- current time;
- current working directory;
- absolute local paths;
- environment variables;
- filesystem traversal order;
- locale collation;
- git metadata.

Inputs must be explicit. The same Shape IR, active Law IR, profile IR, compiler
identity, and canonical codec ids must always produce the same hashes.
