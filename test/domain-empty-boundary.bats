#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "front-door docs point to the domain-empty boundary packet" {
  run grep -F "[Domain-Empty Core Boundary](./docs/design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" README.md
  assert_success

  run grep -F "[design/0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" docs/GUIDE.md
  assert_success

  run grep -F "[Domain-Empty Core Boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" docs/ARCHITECTURE.md
  assert_success
}

@test "domain-empty boundary card is pulled from asap into design" {
  run test -e docs/method/backlog/asap/SOURCE_domain-empty-wesley-core-boundary.md
  assert_failure

  run test -e docs/design/0014-domain-empty-core-boundary/SOURCE_domain-empty-wesley-core-boundary.md
  assert_success

  run grep -F "0014-domain-empty-core-boundary" docs/design/README.md
  assert_success
}

@test "legacy JS compile command is retired instead of owning product targets" {
  run test ! -e packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -F "wesley schema lower" docs/GUIDE.md
  assert_success
}

@test "end-to-end validation diagram routes node retirement through Rust preflight" {
  run grep -F "RustPreflight --> NodeRetirement[Node retirement ledger guard]" docs/END_TO_END.md
  assert_success

  run grep -F "LegacyPreflight --> NodeRetirement[Node retirement ledger guard]" docs/END_TO_END.md
  assert_failure
}

@test "BEARING keeps roadmap authority before tensions and closeouts" {
  run awk '
    /^## Roadmap Authority$/ { authority = NR }
    /^## Active Gravity$/ { gravity = NR }
    /^## Tensions$/ { tensions = NR }
    /^## Durable Closeouts$/ { closeouts = NR }
    /^## Next Target$/ { next_target = NR }
    END {
      exit !(authority && gravity && tensions && closeouts && next_target &&
        authority < gravity && gravity < tensions &&
        tensions < closeouts && closeouts < next_target)
    }
  ' docs/BEARING.md
  assert_success
}

@test "wesley-core operation facts do not expose runtime dispatch ids" {
  run rg -n "stable_op_id|operation_type_rank|EINT envelopes|deployed contract|op ids" crates/wesley-core/src/domain/operation.rs
  assert_failure
}

@test "generic TypeScript LE emitter does not generate runtime op constants" {
  run rg -n "stable_op_id|OP_[A-Z_]+|EINT op id|op id" crates/wesley-emit-typescript/src/le_binary.rs
  assert_failure
}

@test "wesley-core operation artifact model does not expose host authority vocabulary" {
  run rg -n "CapabilityGrant|CapabilityPresentation|AdmissionTicket|ArtifactHandle|Echo-owned|admission" crates/wesley-core/src/domain/operation_artifact.rs crates/wesley-core/src/adapters/apollo.rs
  assert_failure
}

@test "active operation artifact surfaces use generic vocabulary" {
  run rg -n "\\b[oO]ptic\\b|compile_runtime_optic|OpticArtifact|runtime-optics|domain/optic" README.md docs/NORTHSTAR.md docs/SDL.md docs/VISION.md docs/END_TO_END.md docs/TECHNICAL_TEARDOWN.md docs/design/0010-wesley-graft-mcp-boundary docs/design/0004-realization-admission-and-witness crates/wesley-core/src crates/wesley-core/tests
  assert_failure
}

@test "operation artifact claim ids are explicitly operation scoped" {
  run rg -n "\"shape.valid.v1\"|\"codec.canonical.v1\"|\"footprint.closed.v1\"" docs/NORTHSTAR.md docs/SDL.md crates/wesley-core/src crates/wesley-core/tests
  assert_failure
}

@test "active SDL docs use contract requirements vocabulary" {
  run rg -n "OpticAdmissionRequirements|admission truth|admission-facing|runtime optic|OpticRequirements" docs/SDL.md
  assert_failure
}

@test "Continuum architecture notes are retired extraction context" {
  run grep -F "This note is retained as historical extraction context only." docs/architecture/continuum-wesley-role.md
  assert_success

  run grep -F "Generic Wesley has no current Continuum-specific minimum shared contract" docs/architecture/continuum-minimum-shared-contract-surface.md
  assert_success

  run rg -n '"docs/architecture/continuum-(minimum-shared-contract-surface|wesley-role)\\.md"' docs/truth-manifest.json
  assert_failure
}

@test "current architecture does not claim a Wesley-owned Continuum package" {
  run rg -n "@wesley/continuum|wesley-continuum|Continuum-specific defaults" docs/README.md docs/architecture/wesley-core-vs-toolchain.md
  assert_failure
}
