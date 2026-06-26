# Issue Triage

<!-- docs-truth: status=current owner=@flyingrobots -->

Triage turns unscheduled intake into a named future release, a split issue, a
repo move, or a closure. Topic grouping can help the discussion, but the
decision that matters is when the work should ship.

## Label Model

Use two label namespaces for work state:

| Namespace  | Meaning                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| `triage:*` | Unscheduled intake that still needs a scheduling, closure, or move call. |
| `v*`       | Scheduled work for a named future release.                               |

Current triage labels:

| Label               | Meaning                         |
| ------------------- | ------------------------------- |
| `triage:requests`   | Raw requests and incoming asks. |
| `triage:bad-code`   | Debt intake.                    |
| `triage:cool-ideas` | Exploratory idea intake.        |

Release lane labels are created only for named releases. Current named release
labels are:

```text
v0.1.1
v0.2.0
v0.3.0
v0.4.0
v0.5.0
```

Do not create generic `lane:*` labels. In particular, do not use
`lane:asap`, `lane:inbox`, `lane:bad-code`, `lane:cool-ideas`,
`lane:release`, or `lane:planned` for active work.

## Invariants

Every open issue must have exactly one work-state label:

- either one `triage:*` label,
- or one `vX.Y.Z` label.

An open issue must never have both `triage:*` and `v*`. It must never have
neither.

Implementation issues stay in `Goalpost: ...` milestones. Release milestones
hold release-gate issues only. A release-gate issue in `Release: vX.Y.Z` links
to the goalposts and issue queries that define the release.

## Triage Flow

For each issue in `triage:requests`, `triage:bad-code`, or
`triage:cool-ideas`:

1. Decide whether it is valid Wesley work.
2. If it is invalid, close it or move it to the owning repo.
3. If it is valid but too broad, split it before scheduling.
4. If it fits an existing named release, replace `triage:*` with `vX.Y.Z`.
5. If it needs a future release that does not exist yet, propose the release
   and create the release lane only after the release has a clear purpose.
6. Leave it under `triage:*` only when the scheduling decision is genuinely not
   ready.

## Creating A Future Release Lane

Create a new `vX.Y.Z` label only when the proposed release has:

- a clear release purpose,
- a coherent batch of issues or goalposts,
- an ordering argument relative to existing releases,
- a release milestone named `Release: vX.Y.Z`,
- a release-gate issue in that milestone.

The release-gate issue should link the scheduled work by GitHub query, usually
`label:vX.Y.Z`, and name any selected goalpost milestones.

## Topic Labels

Topic labels are useful, but they are not scheduling labels.

Use `legend:*`, `group:*`, `pkg:*`, `work:*`, `priority:*`, and ordinary
work-type labels (`bug`, `feature`, `chore`, `docs`, `tests`, `ci`) to explain
what kind of work an issue represents. Use `triage:*` or `v*` to explain
where it sits in the scheduling flow.

## Migration Notes

The old generic lane labels are retired by this doctrine. During migration,
replace them as follows:

| Old label         | Replacement                                    |
| ----------------- | ---------------------------------------------- |
| `lane:inbox`      | `triage:requests`                              |
| `lane:bad-code`   | `triage:bad-code` until scheduled or closed.   |
| `lane:cool-ideas` | `triage:cool-ideas` until scheduled or closed. |
| `lane:release`    | `vX.Y.Z` for the selected release.             |
| `lane:asap`       | A concrete `vX.Y.Z`, or close/split.           |
| `lane:planned`    | A concrete `vX.Y.Z`, or triage intake.         |

Release checks query concrete `vX.Y.Z` labels. Retired generic lane labels
are migration residue only; they are not release gates.

## Related Authority

- [`docs/governance/labels.md`](../../governance/labels.md) defines the
  repository label taxonomy.
- [`docs/governance/RELEASE_POLICY.md`](../../governance/RELEASE_POLICY.md)
  defines release gates and version-lane behavior.
- [`docs/governance/RELEASE_CHECKLIST.md`](../../governance/RELEASE_CHECKLIST.md)
  defines the human release sign-off items.
