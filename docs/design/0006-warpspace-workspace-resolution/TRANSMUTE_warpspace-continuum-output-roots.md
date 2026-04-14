---
title: WARPspace Continuum Output Roots
legend: TRANSMUTE
packet: 0006-warpspace-workspace-resolution
status: shipped
release: v0.1.0
---

# WARPspace Continuum Output Roots

## Scope

Extend the first WARPspace slice from single-file generators into the
Continuum-oriented multi-file emitters, so host projects can declare where
`compile-ttd` and `bundle-echo` land their generated roots without repeating
`--out-dir` on every run.

## Shipped Surface

The repo now ships:

- WARPspace-backed default output roots for `wesley compile-ttd`
- WARPspace-backed default output roots for `wesley bundle-echo`
- output-key alias resolution for multi-file emitters
  - `warp-ttd` with `ttd` fallback
  - `echo-ir` with `echo` fallback
- explicit `--out-dir` continuing to win over WARPspace defaults

## Playback

- Packet question: where should host-project generated contract trees land?
  Answer: `warpspace.mjs` now answers that for the Continuum multi-file emitters
  through `outputs['warp-ttd']` and `outputs['echo-ir']`.
- Packet question: is the WARPspace model only for single-file TS/Zod outputs?
  Answer: no. This slice carries the same host-project model into the
  multi-file Continuum roots that actual app integrations are more likely to
  care about.
- Packet question: do CLI flags remain authoritative?
  Answer: yes. `--out-dir` still overrides WARPspace, and the command defaults
  only consult WARPspace when the operator does not pin an output root
  explicitly.

## Retrospective

- The alias approach was the right cut. It lets the design packet keep
  human-readable names like `echo-ir` while preserving a compatibility path for
  shorter historical keys such as `echo` or `ttd`.
- Extending the same utility layer kept the semantics coherent. WARPspace now
  resolves both single-file and multi-file emitters through one discovery and
  override path instead of growing several near-duplicate config readers.
- This still does not finish the whole WARPspace packet. `drift-watch`,
  `witness`, and any eventual host-project bundle materialization flow still
  need to consume WARPspace directly.

## Evidence

- [packages/wesley-cli/src/utils/warpspace.mjs](/Users/james/git/wesley/packages/wesley-cli/src/utils/warpspace.mjs)
- [packages/wesley-cli/src/commands/compile-ttd.mjs](/Users/james/git/wesley/packages/wesley-cli/src/commands/compile-ttd.mjs)
- [packages/wesley-cli/src/commands/bundle-echo.mjs](/Users/james/git/wesley/packages/wesley-cli/src/commands/bundle-echo.mjs)
- [packages/wesley-cli/test/warpspace.test.mjs](/Users/james/git/wesley/packages/wesley-cli/test/warpspace.test.mjs)
- [packages/wesley-cli/test/compile-ttd.bats](/Users/james/git/wesley/packages/wesley-cli/test/compile-ttd.bats)
- [packages/wesley-cli/test/bundle-echo.bats](/Users/james/git/wesley/packages/wesley-cli/test/bundle-echo.bats)
