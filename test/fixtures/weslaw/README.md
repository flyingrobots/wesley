# weslaw Fixture Corpus

This corpus supports design packet
`docs/design/0019-weslaw-semantic-law-ir/`.

The files define the first v1 substrate target for `WLAW-008` and `WLAW-009`,
then serve as Rust parser and published-schema fixtures for `WLAW-011` through
`WLAW-020`, strict binding fixtures for `WLAW-021` through `WLAW-035`, and
canonical law hash fixtures for `WLAW-036` through `WLAW-045`. The `diff/`
fixtures pin the public semantic diff command output for `WLAW-053` through
`WLAW-059`.

## Files

| Path | Purpose |
| --- | --- |
| `contract-bundle-shape.graphql` | Minimal GraphQL shape used by accepted and rejected law fixtures. |
| `accepted/*.weslaw.yaml` | Law documents that `wesley law validate` must accept. |
| `rejected/*.weslaw.yaml` | Law documents that validation must reject. |
| `rejected/*.expected.txt` | Stable diagnostic code expected for each rejected fixture. |
| `diff/*.weslaw.yaml` | Old/new law documents used by semantic diff fixtures. |
| `diff/ci-semantic-diff.json` | CI-ready `wesley.law-diff/v1` output. |
| `diff/ci-semantic-diff.md` | PR-ready Markdown generated from structured diff events. |
| `diff/holmes-blade-binding-broken.json` | Holmes/BLADE-facing binding-break report. |

The schema hash anchors use the native Wesley `schema hash` output for
`contract-bundle-shape.graphql`.

```text
ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
```

## Fixture Policy

- Fixtures are compiler fixtures, not product ownership claims.
- Product names such as Echo, jedit, Continuum, and warp-ttd appear only to
  preserve the real semantic pressure that motivated `weslaw`.
- External repos remain the owners of their runtime and protocol meaning.
- Accepted fixtures must lower into typed Law IR and satisfy
  `schemas/weslaw-v1.schema.json`.
- Rejected fixtures pin stable structure and binding diagnostic codes for the
  strict schema-bound validation pass.
- Accepted fixtures also feed canonical Law IR hash, contract bundle manifest,
  and generated-artifact provenance tests.
- Diff fixtures must remain generated from `wesley law diff` and satisfy
  `schemas/wesley-law-diff-v1.schema.json` when JSON.
