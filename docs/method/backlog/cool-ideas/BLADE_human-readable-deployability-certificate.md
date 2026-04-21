# Human-readable deployability certificate

- Lane: `cool-ideas`
- Legend: `BLADE`

## Why now

The clarified BLADE boundary is:

- test and verify
- judge and gate
- emit a certified deployable bundle or failure bundle
- stop short of deployment

That machine-facing output is the right boundary. There is still room for a
small human-facing artifact that says, plainly, why a given bundle is considered
deployable under the current rules.

This is not a deployment feature. It is a trust and onboarding feature.

## Hill

BLADE can emit a compact human-readable deployability certificate summary
alongside the machine-facing bundle and certificate artifacts.

## Done looks like

- one small summary artifact explains:
  - what bundle was evaluated
  - what tests and evidence passed
  - what gates or policies were satisfied
  - why the output is "deployable" rather than merely "generated"
- the summary remains bounded and honest about scope
- the artifact helps humans trust the boundary instead of bypassing it

## Repo Evidence

- `docs/design/wesley-pipeline.md`
- `docs/WESLEY_GLOSSARY.md`
- BLADE-related runtime and evidence surfaces already tracked in the repo

