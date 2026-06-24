# AGENTS

This guide is for AI agents and human operators recovering context in the Wesley repository.

## Git Rules

- **NEVER** amend commits.
- **NEVER** rebase or force-push.
- **NEVER** push to `main` without explicit permission.
- Always use standard commits and regular pushes.

## Documentation & Planning Map

Do not audit the repository by recursively walking the filesystem. Follow the authoritative manifests:

### 1. The Entrance

- **`README.md`**: Public front door, core value prop, and quick start.
- **`docs/GUIDE.md`**: Orientation, fast path, and system orchestration.

### 2. The Bedrock

- **`docs/ARCHITECTURE.md`**: Authoritative structural reference (Base Platform, Modules, Pipeline).
- **`docs/VISION.md`**: Core tenets and the "Trustworthy Change" mission.
- **`docs/METHOD.md`**: Repo work doctrine (GitHub Issues, evidence ledger, Cycle loop).

### 3. The Direction

- **`docs/BEARING.md`**: Current execution gravity and active tensions.
- **`docs/design/README.md`**: Active design packets and structural doctrine.
- **GitHub Issues**: The active source of truth for pending work. Use
  `triage:*` labels for unscheduled intake and `lane:vX.Y.Z` labels for work
  scheduled into a named future release. See
  **`docs/topics/contributing/triage.md`**.
- **`docs/method/graveyard/github-issue-migration/`**: Historical evidence for the former filesystem backlog migration.

### 4. The Proof

- **`CHANGELOG.md`**: Historical truth of merged behavior.
- **`docs/audit/`**: Structural health and due diligence reports.

## Context Recovery Protocol

When starting a new session or recovering from context loss:

1. **Read `docs/BEARING.md`** to find the current execution gravity.
2. **Read `docs/METHOD.md`** to understand the work doctrine.
3. **Check scheduled release lanes and triage queues** using
   `docs/topics/contributing/triage.md`.
4. **Check `git log -n 5` and `git status`** to verify the current branch state.

## End of Turn Checklist

After altering files:

1. **Verify Truth**: Ensure documentation is updated if behavior or structure changed.
2. **Log Debt**: Add follow-on work as GitHub Issues with either a `triage:*`
   intake label or a concrete `lane:vX.Y.Z` release label.
3. **Commit**: Use focused, conventional commit messages. Propose a draft before executing.
4. **Validate**: Run `pnpm run preflight`.

---

**The goal is inevitably. Every feature is defined by its tests.**
