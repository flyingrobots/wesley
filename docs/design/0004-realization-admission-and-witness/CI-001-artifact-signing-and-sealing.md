---
title: CI-001 — Cryptographic Artifact Signing
legend: CI
packet: 0004-realization-admission-and-witness
status: shipped
release: v0.1.0
---

# CI-001 — Cryptographic Artifact Signing

## Scope

Seal generated artifacts with per-file HMAC signatures so witness can verify
that the inspected files are the exact emitted files, not a lookalike set that
was edited after generation.

## Playback

- Packet question: what is `realization/manifest.json` for?
  Answer: the realization shell now carries a signed artifact inventory, which
  is a packaging claim about file identity and integrity rather than a second
  source of semantics.
- Packet question: what does a witness command prove today?
  Answer: witness can now prove exact artifact-integrity properties such as
  `realization.echo.artifact-signatures`, rather than only generic coherence.
- Packet question: can the certified property be stated exactly?
  Answer: yes. The current claim is finite: all recorded generated files still
  match their stored content hashes and HMAC signatures.

## Retrospective

- Folding sealing into the realization shell kept the trust boundary simple:
  compile emits the inventory, witness verifies it.
- Environment-configured signing keys are enough for the release line, but key
  rotation and stronger operator-facing key management remain future work.

## Evidence

- [packages/wesley-cli/test/compile.bats](../../../packages/wesley-cli/test/compile.bats)
- [Wesley Extraction Map](../wesley-extraction-map.md)

The original Continuum realization verifier files were removed from generic
Wesley during the Domain-Empty cleanup. Recreate that behavior only through a
Continuum-owned module if it is still needed.
