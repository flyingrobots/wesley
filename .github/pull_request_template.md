## Summary
- What problem does this PR solve? Link issues/PRs.

## Why
- Rationale for this approach. Mention alternatives considered and trade‑offs.

## Changes
- Bulleted list of focused changes (keep it surgical).

## Risk
- User‑facing or CI risk and mitigations. Rollout/enablement notes if any.

## Backout
- How to revert safely; follow‑up cleanup if rollback happens.

## Testing
- Rust core/CLI: `cargo xtask preflight`
- Core fixtures: `cargo test --manifest-path crates/wesley-core/Cargo.toml`
- Legacy package surfaces: `cargo xtask legacy-preflight` (when touching `packages/`, docs checks, or JS tooling)
- JS package focus: `pnpm -w -F <package> test` (only for legacy package changes)

## EvidenceMap / SourceMap (if applicable)
- Confirm UIDs use `tbl:Table` and `col:Table.field`.
- If mapping SQL→SDL, verify `.wesley-cache/bundle.json` exists and SourceMap finds SDL.

## Screenshots / Logs (optional)

## Merge Strategy
- Merge commit only; no rebase.
- Delete branch after merge.

## Checklist
- [ ] One‑topic PR with tight diff
- [ ] Rust-native preflight passes (`cargo xtask preflight`)
- [ ] Legacy package preflight passes when relevant (`cargo xtask legacy-preflight`)
- [ ] No widened permissions/secrets in workflows
- [ ] Docs updated if behavior changed
