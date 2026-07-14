# Test Fixtures

Fixtures live here so tests, docs, and demos all reference the same canonical inputs. Each subdirectory has its own README with specifics.

## Directory Overview

| Directory               | Purpose                                                                                                                                       | Consumed By                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `examples/`             | Canonical GraphQL schemas plus generated outputs for docs and HOLMES tests.                                                                   | CLI bats (`holmes-e2e.bats`), documentation snippets.                              |
| `consumer-models/`      | Hermetic consumer-shaped GraphQL schemas used by fixture extensions.                                                                          | Wesley core operation catalog tests, Rust emitter tests, TypeScript emitter tests. |
| `extensions/`           | Descriptor-only fixture extension packages that point at schemas, vectors, and intended capabilities without becoming Wesley product modules. | Boundary tests and emitter tests that need external-consumer realism.              |
| `extension-generation/` | Domain-empty semantic source, generated output, and canonical input/provenance/review artifacts.                                              | `wesley-core` extension-generation contract and JSON Schema tests.                 |
| `blade/`                | Daywalker Deploys demo assets (schemas, run script, signing key instructions).                                                                | Docs walkthrough, manual CLI demos.                                                |
| `reference/`            | Comprehensive SDL showcasing most directives; useful for experiments.                                                                         | Manual runs, future regression suites.                                             |
| `rls-schema.graphql`    | Focused schema exercising RLS directives.                                                                                                     | `cli-e2e.bats`, `cli-e2e-real.bats`.                                               |

Always treat fixtures as immutable inputs. If you need to regenerate outputs, do so in a temporary workspace and update the fixture intentionally with accompanying tests/docs.

## Stack Witness 0001 Codec Note

`consumer-models/stack-witness-0001-*` uses `fixtureVarsEncoding:
utf8-semicolon-kv/v0` and `fixtureVarsBytes` only as temporary,
human-readable fixture metadata. Those strings are not Wesley's runtime
canonical variable codec. The durable target is `targetCodec:
wesley-binary/v0`: Wesley-generated deterministic binary codecs shared by Rust
and TypeScript. The fixture names the target now, but does not implement that
codec yet.

## Fixture Extension Boundary

Consumer-shaped schemas may use product-like nouns because they emulate
external repositories. They do not grant Wesley base platform ownership over
those nouns.

When a fixture needs more than standalone SDL, describe it under
`extensions/<name>/` as a fixture extension package. The descriptor should point
at the schema, vectors, and expected capability surfaces. Tests may consume
those files as hermetic inputs, but generic unit tests and public emitter docs
should stay domain-neutral.
