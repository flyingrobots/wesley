# SOURCE

## Scope

`SOURCE` covers schema-authoring semantics: GraphQL SDL, directives, parser and
IR meaning, ops contracts, and the rule that explicit Wesley inputs outrank
generated artifacts.

## Guards

- `schema-source-of-truth`
- `docs-runtime-honesty`

## Standing playback questions

- Can an author change intended behavior by editing schema and explicit config
  inputs instead of derived outputs?
- Do parser, directive, IR, and ops surfaces preserve source meaning without
  smuggling artifact-shaped truth back upstream?
