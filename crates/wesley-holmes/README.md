# wesley-holmes

`wesley-holmes` is the Rust foundation for Holmes law assurance work inside
Wesley. It consumes Wesley-published law evidence, policy, witness, MCP, and
GitHub payload artifacts; validates their envelope shape, provenance, artifact
availability, and version posture; and prepares deterministic diagnostics and
reporting surfaces for later CLI, API, and MCP interfaces.

This crate is intentionally not published yet. It is a workspace implementation
crate for the Holmes redesign described in the Wesley design packet:

- [Holmes `weslaw` Assurance PRD/Test Plan](https://github.com/flyingrobots/wesley/blob/main/docs/design/0020-holmes-weslaw-assurance-prd-test-plan/holmes-weslaw-assurance-prd-test-plan.md)
- [Holmes Assurance Hexagon](https://github.com/flyingrobots/wesley/blob/main/docs/design/0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md)

## Boundary

The crate follows the planned hexagonal boundary:

- `domain`: pure law-assurance data, diagnostics, evidence models, and version
  rules. Domain code must not import filesystem, network, process, GitHub, MCP,
  or wall-clock dependencies.
- `application`: deterministic orchestration utilities that bind domain facts
  to ports without owning external side effects.
- `ports`: abstract clock, artifact, policy, reporting, GitHub, MCP, and command
  I/O traits plus deterministic fakes for tests.
- `adapters`: future concrete integrations for filesystem, GitHub, MCP, and CLI
  surfaces.
- `reporting`: future renderer-facing DTOs and report assembly helpers.

The current implementation includes the first local law evidence validation
gate and a `wesley.law-diff/v1` JSON ingest port that preserves Wesley's
semantic diff events as typed Holmes report data. No public Holmes CLI command
is exposed from Wesley yet.
