# Host Compatibility Boundary

## Status

Supporting note for slices NR-045 through NR-051.

## Rule

Browser, Bun, and Deno host packages are no longer on the core product path.
They can remain temporarily as external host experiments, but the Rust-native
compiler and CLI decide product readiness. The Node host package is retired.

## Host Package Decisions

| Slice  | Surface                             | Decision                                                                                                                         |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| NR-045 | Browser/Bun/Deno host experiments   | Classify as external ecosystem packages. They do not block Rust product readiness.                                               |
| NR-046 | `packages/wesley-host-bun`          | Keep only as external host experiment evidence until deleted or externalized.                                                    |
| NR-047 | `packages/wesley-host-deno`         | Keep only as external host experiment evidence until deleted or externalized.                                                    |
| NR-048 | `packages/wesley-host-browser`      | Keep only as external host experiment evidence until deleted or externalized.                                                    |
| NR-049 | Node-host product smoke invocations | Replace generic product CI smoke with the native Rust CLI. No Node host product smoke remains.                                   |
| NR-050 | Node-host tests                     | Retire Node host contract tests with the host package.                                                                           |
| NR-051 | CI labels and job names             | Name Rust product checks and external host experiment checks explicitly so the merge view does not hide which surface is tested. |

## Product Versus Compatibility

Product checks answer whether the Rust compiler kernel and native command body
are healthy. External host experiment checks answer whether retained JavaScript
host packages still behave while they are being externalized or deleted.

| Lane                     | Examples                                                          | Merge meaning                                                  |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Rust product             | `cargo xtask preflight`, `wesley schema lower`, `wesley emit ...` | The Rust-native product spine is healthy.                      |
| Repository hygiene       | docs links, truth manifest, dependency boundaries                 | The repo is internally coherent.                               |
| External host experiment | `@wesley/host-bun`, `@wesley/host-deno`, `@wesley/host-browser`   | Retained non-product host experiments still pass their smokes. |

External host experiment failures still matter while the packages remain in the
repo, but they should not be mistaken for core compiler truth. When a host
package is deleted or externalized, its workflow should leave with it.

## Current CI Naming Contract

- Rust-native workflow names use `Rust Product`.
- Browser, Bun, and Deno host workflows use `External Host Experiment`.
- General CI uses a native Rust CLI schema-lowering smoke for product coverage.
- No Node host workflow or host-contract invocation remains.

This gives reviewers a simple rule: if a check says `External Host Experiment`,
it is probing a non-product host surface; if it says `Rust Product`, it is
protecting the product spine.
