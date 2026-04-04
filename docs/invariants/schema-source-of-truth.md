# schema-source-of-truth

## Invariant statement

GraphQL SDL plus explicit Wesley inputs such as transmutation config, declared
ops, and policy/config files define intended behavior. Generated SQL, tests,
plans, bundles, certs, snapshots, and cache state are derived artifacts, not
authoritative source.

## Preserved when

- primary authoring and review flows start from schema and explicit config
  inputs
- generated artifacts can be deleted and regenerated from those inputs
- import, introspection, or replay paths make it explicit when they are
  translating derived state back into an authorable source surface

## Violated when

- normal product evolution requires hand-editing generated artifacts as the
  canonical change surface
- snapshots, plans, bundles, or cert outputs silently become hidden source for
  future behavior
- docs present generated artifacts as peer authorities to the schema/config
  inputs in normal workflows

## How to check

- inspect the README and primary CLI docs for schema-first entry points such as
  `--schema` and explicit config-driven transmutations
- verify generated output locations such as `out/` and `.wesley-cache/` are
  treated as materializations or cache, not authoring surfaces
- challenge any new workflow that asks operators to edit generated files as the
  source of truth
