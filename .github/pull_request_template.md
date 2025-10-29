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
- Unit: `pnpm -w -F @wesley/core test:unit`
- Snapshots: `UPDATE_SNAPSHOTS=1 pnpm -w -F @wesley/core test:snapshots` (only when intentionally updating)
- CLI Bats: `pnpm -w -F @wesley/cli test`
- Preflight: `pnpm run preflight`

## EvidenceMap / SourceMap (if applicable)
- Confirm UIDs use `tbl:Table` and `col:Table.field`.
- If mapping SQL→SDL, verify `.wesley/bundle.json` exists and SourceMap finds SDL.

## Screenshots / Logs (optional)

## Merge Strategy
- Merge commit only; no rebase.
- Delete branch after merge.

## Checklist
- [ ] One‑topic PR with tight diff
- [ ] Tests green locally (unit, snapshots, CLI Bats as relevant)
- [ ] Preflight passes (`pnpm run preflight`)
- [ ] No widened permissions/secrets in workflows
- [ ] Docs updated if behavior changed
