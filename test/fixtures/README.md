# Test Fixtures

Fixtures live here so tests, docs, and demos all reference the same canonical inputs. Each subdirectory has its own README with specifics.

## Directory Overview

| Directory | Purpose | Consumed By |
| --- | --- | --- |
| `examples/` | Canonical GraphQL schemas plus generated outputs for docs and HOLMES tests. | CLI bats (`holmes-e2e.bats`), documentation snippets. |
| `consumer-models/` | Hermetic consumer-shaped GraphQL fixtures for jedit and Stack Witness 0001 contract-boundary tests. | Wesley core operation catalog tests, Rust emitter tests, TypeScript emitter tests. |
| `blade/` | Daywalker Deploys demo assets (schemas, run script, signing key instructions). | Docs walkthrough, manual CLI demos. |
| `reference/` | Comprehensive SDL showcasing most directives; useful for experiments. | Manual runs, future regression suites. |
| `rls-schema.graphql` | Focused schema exercising RLS directives. | `cli-e2e.bats`, `cli-e2e-real.bats`. |

Always treat fixtures as immutable inputs. If you need to regenerate outputs, do so in a temporary workspace and update the fixture intentionally with accompanying tests/docs.

## Stack Witness 0001 Codec Note

`consumer-models/stack-witness-0001-*` uses `fixtureVarsEncoding:
utf8-semicolon-kv/v0` and `fixtureVarsBytes` only as temporary,
human-readable fixture metadata. Those strings are not Wesley's runtime
canonical variable codec. The durable target is `targetCodec:
wesley-binary/v0`: Wesley-generated deterministic binary codecs shared by Rust
and TypeScript. The fixture names the target now, but does not implement that
codec yet.
