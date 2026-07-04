# Module Authoring Guide

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley extensions start from a strict boundary:

```text
GraphQL SDL -> deterministic Wesley IR -> external target assigns meaning
```

Wesley core owns GraphQL parsing, normalization, deterministic IR, schema
hashes, generic operation facts, and evidence plumbing. A module or sibling repo
owns target semantics, runtime behavior, generated product artifacts, policy,
and release conventions.

## Current Loading Boundary

The retired Node `wesley.config.mjs` module loader is not the active Wesley core
loading path. The Rust-native CLI does not execute arbitrary JavaScript modules.

Current extension work should use one of these boundaries:

| Need                                  | Current Boundary                                                       |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Generic compiler fact                 | Add a Rust API in `wesley-core`.                                       |
| Generic Rust or TypeScript projection | Extend `wesley-emit-rust` or `wesley-emit-typescript`.                 |
| Domain-specific target                | Put the module in an owning external crate, package, or sibling repo.  |
| Local target selection metadata       | Declare a target in `wesley.config.json` or YAML.                      |
| Hermetic examples                     | Add descriptor-only fixture modules under `test/fixtures/extensions/`. |

Future executable target loading should go through an explicit Rust-native
registry, WASM capability boundary, or external-process protocol. Do not rebuild
the old dynamic JavaScript command-dispatch path in Wesley core.

The conservative MVP direction is the
[External Target Protocol](../reference/external-target-protocol.md): Wesley
validates a descriptor first, then a future runner can pass compiler facts to an
external process and validate the returned artifact manifest.

## Descriptor Shape

A descriptor-only fixture module should be plain data:

```json
{
  "apiVersion": "wesley.fixture-extension/v1",
  "name": "example-compiler-target",
  "description": "Hermetic fixture target for compiler-boundary tests.",
  "schemas": ["../../consumer-models/example.graphql"],
  "capabilities": {
    "wesley": {
      "targets": [
        {
          "name": "example-target",
          "executionMode": "external-process",
          "runtimeModel": "stateless"
        }
      ]
    }
  },
  "boundary": {
    "domainOwnership": "external-fixture",
    "wesleyOwns": ["schema lowering", "target descriptor validation"],
    "wesleyDoesNotOwn": ["runtime execution", "product behavior"]
  }
}
```

Keep descriptors deterministic and inspectable:

- no executable code in fixture descriptors
- no network access
- no ambient clock or filesystem mutation
- no product-specific semantics in Wesley core
- no hidden target defaults outside the manifest or descriptor

## Project Manifest Target

Local projects select target metadata in the project manifest:

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"],
  "targets": [
    {
      "name": "example-target",
      "module": "example.external.module",
      "default": true,
      "outputDir": "generated/example"
    }
  ]
}
```

Validate the manifest before relying on it:

```bash
wesley config validate --json
wesley config inspect --json
```

If the target is mutually exclusive with another selected target, use
`exclusiveGroup` or `conflictsWith`. See
[Project Manifest](../reference/project-manifest.md#target-compatibility).

## Capability Registry Model

The Rust capability registry models target descriptors and pre-execution policy.
It does not execute modules.

Descriptor fields currently modeled in Rust include:

| Field                      | Meaning                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `module`                   | Module identity that contributed the target.                |
| `target`                   | Stable target name.                                         |
| `isDefault`                | Whether the target is selected when no target is requested. |
| `executionMode`            | `rust-native`, `wasm`, or `external-process`.               |
| `portabilityFloor`         | Minimum host promise for the target.                        |
| `requiredContract`         | Capability ABI version range.                               |
| `runtimeModel`             | `stateless` or `resource-handles`.                          |
| `requestedHostImports`     | Explicit imports requested before execution.                |
| `requestedResourceHandles` | Explicit host-created resource handles.                     |

The host policy layer can reject unavailable imports, incompatible ABI ranges,
and resource-handle requests before execution. That is a safety boundary, not a
runtime.

## Fixture Module Zoo

Use the fixture zoo for local examples:

- `test/fixtures/extensions/fixture-zoo/compiler-heavy`
- `test/fixtures/extensions/fixture-zoo/evidence-heavy`
- `test/fixtures/extensions/fixture-zoo/blade-heavy`

The zoo is intentionally fake. It demonstrates capability mixes without
claiming that Wesley owns those domains.

## Troubleshooting

| Symptom                                                               | Likely Cause                                            | Fix                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `no Wesley manifest found`                                            | No discovered project manifest.                         | Pass `--config` or add a manifest.                       |
| `manifest parse error`                                                | Invalid JSON/YAML or unsupported YAML construct.        | Use JSON or simple YAML with string keys and no aliases. |
| `unsupported manifest apiVersion`                                     | The manifest targets another API version.               | Use `wesley.project-manifest/v1`.                        |
| `duplicate target`                                                    | Two selected descriptors use the same target name.      | Rename or remove one target.                             |
| `multiple default targets selected`                                   | More than one target has `"default": true`.             | Pick one default.                                        |
| `exclusive group ... selects multiple targets`                        | Two selected targets declare the same `exclusiveGroup`. | Split into separate configs or select one target.        |
| `target ... conflicts with selected target`                           | `conflictsWith` names another selected target.          | Remove one side of the conflict.                         |
| Missing schema when running `schema hash`                             | Multi-schema manifest cannot infer one schema.          | Pass `--schema` explicitly.                              |
| Target needs Postgres, Echo, Continuum, renderer, or runtime behavior | The work is outside Wesley core.                        | Move it to the owning repo or target module.             |

Environment variables from the retired JavaScript loader, including
`WESLEY_CONFIG`, `WESLEY_MODULES`, `WESLEY_DISABLE_MODULES`, and
`WESLEY_MODULE_ALLOWLIST`, are historical migration context for Wesley core.
They are not the Rust-native module loading surface.

## Author Checklist

- Keep the target descriptor domain-free in Wesley.
- Put target behavior in the owning external module or sibling repo.
- Add a manifest example only when it validates with `wesley config validate`.
- Add fixture descriptors under `test/fixtures/extensions/` when Wesley needs
  hermetic regression coverage.
- Update [Project Manifest](../reference/project-manifest.md) if the manifest
  schema changes.
- Run `cargo xtask preflight` before opening a PR.
