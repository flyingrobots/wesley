# Host Compatibility Boundary

## Status

Supporting note for slices NR-045 through NR-051.

## Rule

Browser, Bun, Deno, and Node host packages are no longer on the core product
retirement path. They can remain temporarily as compatibility evidence, but the
Rust-native compiler and CLI decide product readiness.

## Host Package Decisions

| Slice  | Surface                             | Decision                                                                                                                           |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| NR-045 | Browser/Bun/Deno host experiments   | Classify as external ecosystem or compatibility-only packages. They do not block Rust product readiness.                           |
| NR-046 | `packages/wesley-host-bun`          | Keep only as legacy compatibility evidence until deleted or externalized.                                                          |
| NR-047 | `packages/wesley-host-deno`         | Keep only as legacy compatibility evidence until deleted or externalized.                                                          |
| NR-048 | `packages/wesley-host-browser`      | Keep only as legacy compatibility evidence until deleted or externalized.                                                          |
| NR-049 | Node-host product smoke invocations | Replace generic product CI smoke with the native Rust CLI; leave Node invocations only in explicit legacy lanes.                   |
| NR-050 | Node-host tests                     | Treat remaining Node host tests as compatibility-only evidence.                                                                    |
| NR-051 | CI labels and job names             | Name Rust product checks and legacy compatibility checks explicitly so the merge view does not hide which surface is being tested. |

## Product Versus Compatibility

Product checks answer whether the Rust compiler kernel and native command body
are healthy. Compatibility checks answer whether historical JavaScript package
surfaces still behave while they are being retired.

| Lane                 | Examples                                                                             | Merge meaning                                                             |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Rust product         | `cargo xtask preflight`, `wesley schema lower`, `wesley emit ...`                    | The Rust-native product spine is healthy.                                 |
| Repository hygiene   | docs links, truth manifest, dependency boundaries                                    | The repo is internally coherent.                                          |
| Legacy compatibility | `@wesley/host-node`, `@wesley/host-bun`, `@wesley/host-deno`, `@wesley/host-browser` | Temporary historical host surfaces still pass their compatibility smokes. |

Compatibility failures still matter while the packages remain in the repo, but
they should not be mistaken for core compiler truth. When a host package is
deleted or externalized, its compatibility workflow should leave with it.

## Current CI Naming Contract

- Rust-native workflow names use `Rust Product`.
- Browser, Bun, Deno, and Node host workflows use `Legacy Compatibility`.
- General CI uses a native Rust CLI schema-lowering smoke for product coverage.
- Remaining Node host invocations are expected only in package, assurance, or
  compatibility lanes.

This gives reviewers a simple rule: if a check says `Legacy Compatibility`, it
is keeping an old surface honest; if it says `Rust Product`, it is protecting
the future product spine.
