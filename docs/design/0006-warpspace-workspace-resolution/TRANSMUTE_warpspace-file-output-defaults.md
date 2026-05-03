---
title: WARPspace File Output Defaults
legend: TRANSMUTE
packet: 0006-warpspace-workspace-resolution
status: shipped
release: v0.1.0
current-status: retired-to-continuum
---

# WARPspace File Output Defaults

## Scope

Ship the first host-project WARPspace slice by teaching Wesley's single-file
generator commands to resolve default output files from `warpspace.toml`, with an
optional `.warpspace.local.toml` development override and explicit CLI flags
remaining authoritative.

## Extraction Status

This shipped slice was later removed from generic Wesley during the
domain-empty core extraction. WARPspace host-project output policy belongs in
Continuum-owned tooling or modules, not in Wesley's generic CLI. The historical
playback below records what the removed slice proved.

## Historical Shipped Surface

This slice shipped:

- `warpspace.toml` discovery by walking upward from the current working directory
- optional `.warpspace.local.toml` overlay from the same host-project root
- `--warpspace <path>` and `WESLEY_WARPSPACE_FILE` override support
- WARPspace-backed default outputs for `wesley typescript` and `wesley zod`
- explicit `--out-file` continuing to win over WARPspace defaults

## Playback

- Packet question: is WARPspace a committed host-project artifact or a local
  sibling-repo alias file?
  Answer: this slice implements it as a host-project artifact. The commands look
  for `warpspace.toml` in the active project tree and resolve output files from
  there.
- Packet question: where should generated host-project code land?
  Answer: `outputs.typescript` and `outputs.zod` in `warpspace.toml` now define
  the default landing roots for those generated files.
- Packet question: what role do local checkout paths still play?
  Answer: only the optional `.warpspace.local.toml` overlay. The main
  implementation no longer assumes sibling repos are the primary integration
  surface.

## Retrospective

- Starting with the single-file generators was the right cut. They provide one
  honest host-project integration seam without dragging the broader
  repo-to-repo sync model back into the center.
- The `.warpspace.local.toml` overlay kept the design honest. It preserves local
  development flexibility without letting machine-specific paths redefine the
  committed host-project artifact.
- This closes the first WARPspace implementation slice, not the whole packet.
  Multi-file generation, bundle materialization, and drift-watch still need to
  adopt the same host-project model.

## Evidence

- [packages/wesley-cli/src/framework/FileOutputGeneratorCommand.mjs](../../../packages/wesley-cli/src/framework/FileOutputGeneratorCommand.mjs)
- [packages/wesley-cli/src/commands/typescript.mjs](../../../packages/wesley-cli/src/commands/typescript.mjs)
- [packages/wesley-cli/src/commands/zod.mjs](../../../packages/wesley-cli/src/commands/zod.mjs)
- [Wesley extraction map](../wesley-extraction-map.md)
