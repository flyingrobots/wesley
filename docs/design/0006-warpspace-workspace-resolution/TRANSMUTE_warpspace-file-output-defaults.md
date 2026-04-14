---
title: WARPspace File Output Defaults
legend: TRANSMUTE
packet: 0006-warpspace-workspace-resolution
status: shipped
release: v0.1.0
---

# WARPspace File Output Defaults

## Scope

Ship the first host-project WARPspace slice by teaching Wesley's single-file
generator commands to resolve default output files from `warpspace.mjs`, with an
optional `.warpspace.local.mjs` development override and explicit CLI flags
remaining authoritative.

## Shipped Surface

The repo now ships:

- `warpspace.mjs` discovery by walking upward from the current working directory
- optional `.warpspace.local.mjs` overlay from the same host-project root
- `--warpspace <path>` and `WESLEY_WARPSPACE_FILE` override support
- WARPspace-backed default outputs for `wesley typescript` and `wesley zod`
- explicit `--out-file` continuing to win over WARPspace defaults

## Playback

- Packet question: is WARPspace a committed host-project artifact or a local
  sibling-repo alias file?
  Answer: this slice implements it as a host-project artifact. The commands look
  for `warpspace.mjs` in the active project tree and resolve output files from
  there.
- Packet question: where should generated host-project code land?
  Answer: `outputs.typescript` and `outputs.zod` in `warpspace.mjs` now define
  the default landing roots for those generated files.
- Packet question: what role do local checkout paths still play?
  Answer: only the optional `.warpspace.local.mjs` overlay. The main
  implementation no longer assumes sibling repos are the primary integration
  surface.

## Retrospective

- Starting with the single-file generators was the right cut. They provide one
  honest host-project integration seam without dragging the broader
  repo-to-repo sync model back into the center.
- The `.warpspace.local.mjs` overlay kept the design honest. It preserves local
  development flexibility without letting machine-specific paths redefine the
  committed host-project artifact.
- This closes the first WARPspace implementation slice, not the whole packet.
  Multi-file generation, bundle materialization, and drift-watch still need to
  adopt the same host-project model.

## Evidence

- [packages/wesley-cli/src/utils/warpspace.mjs](/Users/james/git/wesley/packages/wesley-cli/src/utils/warpspace.mjs)
- [packages/wesley-cli/src/framework/FileOutputGeneratorCommand.mjs](/Users/james/git/wesley/packages/wesley-cli/src/framework/FileOutputGeneratorCommand.mjs)
- [packages/wesley-cli/src/commands/typescript.mjs](/Users/james/git/wesley/packages/wesley-cli/src/commands/typescript.mjs)
- [packages/wesley-cli/src/commands/zod.mjs](/Users/james/git/wesley/packages/wesley-cli/src/commands/zod.mjs)
- [packages/wesley-cli/test/warpspace.test.mjs](/Users/james/git/wesley/packages/wesley-cli/test/warpspace.test.mjs)
- [packages/wesley-cli/test/warpspace.bats](/Users/james/git/wesley/packages/wesley-cli/test/warpspace.bats)
