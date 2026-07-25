## Linked Issue

Closes #

## Branch / Issue-Title Check

- [ ] Branch name is the linked issue title slug, or the exception is explained here.

## Summary

- What problem does this PR solve?

## Why

- Rationale for this approach. Mention alternatives considered and trade-offs.

## Changes

- Bulleted list of focused changes.

## Method Evidence

- [ ] Design doc linked or not required.
- [ ] Tests or validation evidence included.
- [ ] Playback/witness included or not required.
- [ ] Retro or closeout evidence included or not required.

## Tracker Hygiene

- [ ] Linked issue had `work-in-progress` while active.
- [ ] Linked issue has exactly one milestone, named plain `vX.Y.Z`, and no `triage:*`, retired `lane:*`, or concrete-version scheduling label.
- [ ] Follow-up work is captured as GitHub Issues, not hidden in chat or local-only backlog files.

## Risk

- User-facing or CI risk and mitigations. Rollout/enablement notes if any.

## Backout

- How to revert safely; follow-up cleanup if rollback happens.

## Testing

- Rust core/CLI: `cargo xtask preflight`
- Core fixtures: `cargo test --manifest-path crates/wesley-core/Cargo.toml`
- Legacy package surfaces: `cargo xtask legacy-preflight` when touching `packages/`, docs checks, or JS tooling
- JS package focus: `pnpm -w -F <package> test` only for legacy package changes

## EvidenceMap / SourceMap (if applicable)

- Confirm UIDs use `tbl:Table` and `col:Table.field`.
- If mapping SQL to SDL, verify `.wesley-cache/bundle.json` exists and SourceMap finds SDL.

## Screenshots / Logs (optional)

## Merge Strategy

- Merge commit only; no rebase.
- Delete branch after merge.

## Checklist

- [ ] One-topic PR with tight diff
- [ ] Rust-native preflight passes (`cargo xtask preflight`)
- [ ] Legacy package preflight passes when relevant (`cargo xtask legacy-preflight`)
- [ ] No widened permissions/secrets in workflows
- [ ] Docs updated if behavior changed
