# Coordinates And Registries

## Status

Design-lock substrate for `WLAW-002`, `WLAW-003`, and `WLAW-004`.

This note defines how active `weslaw` entries refer to schema and non-shape law
subjects. The binder must use this grammar before canonicalization or hashing.

## Coordinate Rule

Every active law entry has one `subject`.

The subject must be one of:

```text
scalar:<ScalarName>
type:<ObjectName>
input:<InputObjectName>
enum:<EnumName>
field:<TypeName>.<fieldName>
operation:Query.<fieldName>
operation:Mutation.<fieldName>
operation:Subscription.<fieldName>
channel:<channel.name>@<version>
family:<familyName>
```

Coordinates are case-sensitive. The binder must not normalize spelling beyond
the explicit grammar.

## Identifier Grammar

GraphQL-backed identifiers use GraphQL name syntax:

```text
Name = [_A-Za-z][_0-9A-Za-z]*
```

Channel names and family names use a stricter dotted token grammar:

```text
Token = [a-z][a-z0-9-]*
DottedName = Token("." Token)*
Version = [0-9]+
```

Examples:

```text
channel:ttd.protocol@4
family:continuum-runtime-boundary
```

Rejected:

```text
channel:TTD.Protocol@4
channel:ttd protocol@4
channel:ttd.protocol@v4
family:Continuum Runtime Boundary
```

## Schema Coordinates

These subjects bind only to GraphQL Shape IR:

| Coordinate | Binding target |
| --- | --- |
| `scalar:<Name>` | GraphQL scalar definition. |
| `type:<Name>` | GraphQL object definition. |
| `input:<Name>` | GraphQL input object definition. |
| `enum:<Name>` | GraphQL enum definition. |
| `field:<Type>.<field>` | Field on an object, interface, or input object. |
| `operation:Query.<field>` | Field on the effective query root. |
| `operation:Mutation.<field>` | Field on the effective mutation root. |
| `operation:Subscription.<field>` | Field on the effective subscription root. |

The binder must use effective root operation names from the schema, not hardcode
`Query`, `Mutation`, or `Subscription` if the schema declares custom roots later.
The coordinate spelling remains `operation:Query`, `operation:Mutation`, and
`operation:Subscription` as the logical root roles.

## Channel Coordinates

Channel coordinates bind through one of:

1. a known formal `@wes_channel` directive lowered from SDL;
2. an explicit channel declaration in the law registry.

Example:

```text
channel:ttd.protocol@4
```

The subject version and the semantic body version must match. A mismatch is
fatal.

```yaml
subject: channel:ttd.protocol@4
version: 5
```

Expected diagnostic:

```text
WESLAW_CHANNEL_VERSION_MISMATCH
```

## Family Coordinates

Family coordinates are non-shape subjects declared by the contract bundle or
the law file.

Example:

```text
family:continuum-runtime-boundary
```

Family subjects are allowed for invariants and future evidence posture law.
They must not create GraphQL shape.

## Law Registries

Law registries declare non-shape symbols that active law may reference without
pretending those symbols are GraphQL types.

Law registries are bound before active law entries.

```yaml
registries:
  resources:
    - id: AstState
      owner: jedit
      kind: forbidden-runtime-domain
  verifiers:
    - id: continuum-law-checker
      owner: continuum
      inputContracts:
        - continuum.bundle-invariant-input.v1
  channels:
    - name: ttd.protocol
      version: 4
      carrier: TtdProtocolChannel
```

## Resource Registry

Resource ids are used by footprint law.

Resource ids may bind to:

- GraphQL object type names;
- explicit registry entries.

The binder must reject a resource id if it binds to both a GraphQL type and a
registry entry with incompatible identity.

Allowed registry fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Resource kind identifier. |
| `owner` | yes | Owning module or repo. |
| `kind` | yes | Classification string. |
| `notes` | no | Human explanation, excluded from `lawHash`. |

## Verifier Registry

Verifier ids are used by external invariant predicates.

Allowed registry fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable verifier id. |
| `owner` | yes | Owning module or repo. |
| `inputContracts` | no | Accepted input contract ids. |

External verifier law does not mean Wesley executes the verifier in v1. It
means the law entry binds to a declared verifier surface.

## Channel Registry

Channel registry entries support channel law when the channel is not declared
through a known formal directive.

Allowed registry fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Dotted channel name. |
| `version` | yes | Channel version integer. |
| `carrier` | yes | GraphQL object type carrying message fields. |

The `carrier` type must bind to Shape IR.

## Schema Hash Anchor

Every active law document declares the schema hash it was authored against:

```yaml
schema:
  family: jedit-hot-text-runtime
  hash: sha256:...
  source: contracts/jedit/hot-text-runtime.graphql
```

Normal validation requires exact hash equality. Rebinding to a different schema
hash is a separate explicit workflow.

## Discovery

v1 discovery is explicit. The compiler does not scan the repository for law
files.

Accepted inputs:

```text
wesley law validate --schema <schema.graphql> --law <law.weslaw.yaml>
wesley law diff --old-law <old.weslaw.yaml> --new-law <new.weslaw.yaml>
wesley init-law --schema <schema.graphql> --out <law.weslaw.yaml>
```

Later config-driven discovery may be added after the explicit CLI surfaces are
stable.

## Binding Failure Summary

| Failure | Diagnostic |
| --- | --- |
| bad coordinate syntax | `WESLAW_INVALID_COORDINATE` |
| unknown subject | `WESLAW_UNRESOLVED_SUBJECT` |
| subject kind does not match law kind | `WESLAW_WRONG_SUBJECT_KIND` |
| unresolved resource id | `WESLAW_UNRESOLVED_REFERENCE` |
| unresolved verifier id | `WESLAW_UNRESOLVED_REFERENCE` |
| unresolved channel carrier | `WESLAW_UNRESOLVED_REFERENCE` |
| schema hash mismatch | `WESLAW_SCHEMA_HASH_MISMATCH` |
| channel subject/body version mismatch | `WESLAW_CHANNEL_VERSION_MISMATCH` |

The binder must not silently drop active law.
