# Backlog

The filesystem is the queue.

Lanes:

- `inbox/` for raw captured ideas
- `asap/` for work that should be pulled soon
- `up-next/` for the next likely pull
- `cool-ideas/` for non-commitment exploration
- `bad-code/` for tech debt that is worth naming

The old `v0.1.0/` release lane was retired to
`docs/method/graveyard/v0.1.0/` during the v0.0.5 clean-house release. Treat it
as historical/extraction context, not an active queue.

When an item is pulled into `docs/design/<cycle>/`, the backlog file is removed.
Work should not live in two places at once.

Rejected or retired work does not return to the queue by default. Put a note in
`docs/method/graveyard/` so the decision stays inspectable.

Prefer legend prefixes when they help:

- `SOURCE_<name>.md`
- `TRANSMUTE_<name>.md`
- `RUNTIME_<name>.md`
- `EVIDENCE_<name>.md`
