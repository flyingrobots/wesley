# Host Compatibility Boundary

## Status

Supporting note for slices NR-045 through NR-051.

## Rule

Browser, Bun, and Deno host packages are no longer on the core product path and
were deleted from the Wesley release surface in GH-629. The Rust-native
compiler and CLI decide product readiness. The Node host package is retired.

## Host Package Decisions

| Slice  | Surface                             | Decision                                                                                                                         |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| NR-045 | Browser/Bun/Deno host experiments   | Classify as external ecosystem packages. They do not block Rust product readiness.                                               |
| NR-046 | `packages/wesley-host-bun`          | Deleted in GH-629; reintroduce only through an explicit downstream owner.                                                        |
| NR-047 | `packages/wesley-host-deno`         | Deleted in GH-629; reintroduce only through an explicit downstream owner.                                                        |
| NR-048 | `packages/wesley-host-browser`      | Deleted in GH-629; reintroduce only through an explicit downstream owner.                                                        |
| NR-049 | Node-host product smoke invocations | Replace generic product CI smoke with the native Rust CLI. No Node host product smoke remains.                                   |
| NR-050 | Node-host tests                     | Retire Node host contract tests with the host package.                                                                           |
| NR-051 | CI labels and job names             | Name Rust product checks and external host experiment checks explicitly so the merge view does not hide which surface is tested. |

## Product Versus Compatibility

Product checks answer whether the Rust compiler kernel and native command body
are healthy. Deleted host experiment checks are absence guards only.

| Lane                | Examples                                                          | Merge meaning                             |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| Rust product        | `cargo xtask preflight`, `wesley schema lower`, `wesley emit ...` | The Rust-native product spine is healthy. |
| Repository hygiene  | docs links, truth manifest, dependency boundaries                 | The repo is internally coherent.          |
| Host absence guards | deleted workflow/package checks                                   | Retired host surfaces have not returned.  |

## Current CI Naming Contract

- Rust-native workflow names use `Rust Product`.
- Browser, Bun, and Deno host workflows are absent.
- General CI uses a native Rust CLI schema-lowering smoke for product coverage.
- No Node host workflow or host-contract invocation remains.
