# Backlog

This directory is no longer Wesley's live work queue.

GitHub Issues are the live Method tracker. Use lane labels:

- `lane:inbox` for raw captured ideas
- `lane:asap` for imminent work
- `lane:cool-ideas` for non-commitment exploration
- `lane:bad-code` for technical debt worth naming
- `lane:release` for release-scoped work

Repository files are the evidence ledger. The former filesystem backlog cards
were migrated on 2026-06-04 and archived under
`docs/method/graveyard/github-issue-migration/`.

Use:

```bash
gh issue list --label lane:asap
gh issue list --label lane:bad-code
gh issue list --label lane:cool-ideas
gh issue list --label lane:inbox
```

Do not add new live backlog cards here. Create or update GitHub Issues instead.
