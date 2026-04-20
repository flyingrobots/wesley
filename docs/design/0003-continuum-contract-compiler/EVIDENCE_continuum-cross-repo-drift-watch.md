---
title: Continuum Cross-Repo Drift Watch
legend: EVIDENCE
packet: 0003-continuum-contract-compiler
status: shipped
release: v0.1.0
---

# Continuum Cross-Repo Drift Watch

## Scope

Give the Continuum proving lane one local-first command that compares authored
schema identity, local generated legs, realization shells, publication
boundaries, and explicit nearby mirrors without forcing maintainers to diff
three repositories by hand.

## Playback

- Packet question: can I inspect one local compile path and one witness path
  without relying on neighboring repos, ambient network state, or oral
  tradition?
  Answer: yes. `wesley drift-watch` runs locally from authored schema plus one
  output root and any explicit `--mirror-root` surfaces.
- Packet question: are the ownership boundaries explicit enough that I do not
  have to infer them from repo habit?
  Answer: yes for this slice. The report groups failures as authored,
  generated-artifact, and mirror drift, and it reuses publication-boundary
  rules instead of treating all mismatches as generic noise.
- Packet question: can I read the proof result and understand what is proven
  versus target-state architecture?
  Answer: yes. The report includes `proves` / `doesNotProve`, identifies the
  exact seam that failed, and stays intentionally local-first.

## Retrospective

- The authored/generated/mirror split was the key improvement. Without it,
  drift-watch would have been another vague status command.
- This slice is complete enough to close out, but the packet is not. The next
  meaningful step is bundle-aware post-sync verification so consumer updates
  can be checked against a released bundle instead of only a local compile
  root.

## Evidence

- [packages/wesley-cli/src/commands/drift-watch.mjs](../../../packages/wesley-cli/src/commands/drift-watch.mjs)
- [packages/wesley-cli/test/drift-watch.bats](../../../packages/wesley-cli/test/drift-watch.bats)
- [GUIDE.md](../../GUIDE.md)
- [packages/wesley-cli/README.md](../../../packages/wesley-cli/README.md)
