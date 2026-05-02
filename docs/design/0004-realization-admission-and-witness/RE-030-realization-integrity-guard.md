---
title: RE-030 — Realization Integrity Guard
legend: RE
packet: 0004-realization-admission-and-witness
status: shipped
release: v0.1.0
---

# RE-030 — Realization Integrity Guard

## Scope

Reject stale realization shells before they become repo truth. The guard exists
to prove that `realization/manifest.json` still traces back to the current
authored SDL instead of silently letting generated residue drift.

## Playback

- Packet question: which surface is the only authored contract authority?
  Answer: the authored SDL remains authority because `verify-realization`
  recomputes the schema hash from the source file and compares it to the
  manifest `sourceHash`. The manifest cannot redefine the contract.
- Packet question: what is `realization/manifest.json` for?
  Answer: it is a packaging shell that records source identity, generated-file
  inventory, and signatures so later verification can stay mechanical.
- Packet question: what does a witness command prove today?
  Answer: this slice does not widen witness semantics. It ensures the shell is
  honest before witness claims are trusted.

## Retrospective

- Sharing one `verify-realization` path across CLI use, pre-commit, and CI was
  the right implementation cut. It avoided three slightly-different guards.
- The guard is most effective on tracked or explicit output roots. Broader
  consumer-side mirror verification still belongs in the contract-bundle lane.

## Evidence

- [.githooks/pre-commit](../../../.githooks/pre-commit)
- [.github/workflows/preflight.yml](../../../.github/workflows/preflight.yml)
- [Wesley Extraction Map](../wesley-extraction-map.md)

The original `verify-realization` implementation was a Continuum two-leg guard.
It has been removed from generic Wesley; any replacement belongs in a
Continuum-owned module.
