# weslaw Fixture Corpus

This corpus supports design packet
`docs/design/0019-weslaw-semantic-law-ir/`.

It is intentionally checked in before the Rust parser exists. The files define
the first v1 substrate target for `WLAW-008` and `WLAW-009`.

## Files

| Path | Purpose |
| --- | --- |
| `contract-bundle-shape.graphql` | Minimal GraphQL shape used by accepted and rejected law fixtures. |
| `accepted/*.weslaw.yaml` | Law documents that future `wesley law validate` must accept. |
| `rejected/*.weslaw.yaml` | Law documents that future validation must reject. |
| `rejected/*.expected.txt` | Stable diagnostic code expected for each rejected fixture. |

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
- These fixtures should become parser/binder tests when `WLAW-011` through
  `WLAW-035` land.
