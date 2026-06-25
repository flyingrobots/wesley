# Backlog

This directory is no longer Wesley's live work queue.

GitHub Issues are the live Method tracker. Use lane labels:

- `triage:requests` for raw captured ideas
- `triage:cool-ideas` for exploratory idea intake
- `triage:bad-code` for debt intake
- `vX.Y.Z` for work scheduled into a named future release

Repository files are the evidence ledger. The former filesystem backlog cards
were migrated on 2026-06-04 and archived under
`docs/method/graveyard/github-issue-migration/`.

Use:

```bash
gh issue list --label triage:requests
gh issue list --label triage:bad-code
gh issue list --label triage:cool-ideas
gh issue list --label v0.2.0
```

Do not add new live backlog cards here. Create or update GitHub Issues instead.
See `docs/topics/contributing/triage.md` for the scheduling flow.
