# Continuum Protocol Surface Cutover

- Lane: `asap`
- Legend: `SOURCE`
- Coordination: `WESLEY_protocol_surface_cutover`

## Why now

Wesley cannot claim `schema-source-of-truth` for Continuum while it carries
`schemas/ttd-protocol.graphql` as an implicit source and `warp-ttd` separately
claims `schemas/warp-ttd-protocol.graphql` as the host-neutral debugger
protocol source. One of those stories has to become canonical.

## Hill

A maintainer can name one authored home for the host-neutral TTD protocol, see
whether Wesley's local schema is authoritative or derived, and trace one
cutover plan that removes parallel protocol authority without guessing.

## Done looks like

- the canonical authored protocol location is named explicitly
- Wesley's local `schemas/ttd-protocol.graphql` is marked as authoritative,
  generated, compat-only, or retired
- `docs/plans/ttd-protocol-compiler.md` and
  `docs/features/ttd-protocol-compiler.md` tell the same ownership story
- compile entry points, manifests, and generated outputs point at the chosen
  source clearly
- cross-repo consumers have an explicit handoff surface instead of vendored or
  handwritten shadow copies

## Repo Evidence

- `schemas/ttd-protocol.graphql`
- `docs/plans/ttd-protocol-compiler.md`
- `docs/features/ttd-protocol-compiler.md`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
- `docs/invariants/schema-source-of-truth.md`
- `docs/invariants/governance-boundaries.md`

## Cross-Repo Coordination

- Echo: `PLATFORM_WESLEY_protocol-consumer-cutover`
- `warp-ttd`: `PROTO_WESLEY_protocol-publication-boundary`
- `git-warp`: `PROTO_WESLEY_receipt-envelope-boundary`

## Related Carry-Over

- `#365`
- `#366`
- `#456`
