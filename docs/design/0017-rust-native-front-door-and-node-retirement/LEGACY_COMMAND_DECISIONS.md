# Legacy Command Decisions

This note records the command-boundary decisions made during the Node
retirement campaign. Assurance and runtime evidence boundaries are expanded in
[`ASSURANCE_AND_CAPABILITY_EXTRACTION.md`](./ASSURANCE_AND_CAPABILITY_EXTRACTION.md).

## Rule

Native Wesley only keeps behavior that belongs to the generic compiler kernel,
the native command body, or a generic emitter crate. Target-specific generation,
runtime scaffolding, product starter projects, and ecosystem validation helpers
belong in external modules or owning repos.

## Decisions

| Legacy command                                                   | Decision                                                   | Reason                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generate`                                                       | Port only generic parity through explicit native commands. | The old umbrella command mixed compiler lowering, target dispatch, artifact layout, evidence bundle writing, and product assumptions. Native Wesley now names the retained generic path as `wesley emit rust` and `wesley emit typescript`; external modules own additional targets. |
| `zod`                                                            | Extract from core Wesley.                                  | Zod is a JavaScript validation target, not compiler truth. It can be valuable as an external module or package, but it should not force a Rust Zod emitter crate into the core retirement path.                                                                                      |
| `models`                                                         | Retire from core Wesley.                                   | Model-class scaffolding is target/application ergonomics. The retained generic model facts now appear through Rust and TypeScript emitters; richer model classes need an owning target module.                                                                                       |
| `init`                                                           | Retire legacy scaffolding.                                 | The historical `init` shape can smuggle product conventions into generic Wesley. A future native `init` may create a tiny generic starter schema, but that is a new proposal, not a port of the Node command.                                                                        |
| `doctor`                                                         | Port a narrow Rust-native health check.                    | The retained native command checks only the Rust CLI, Rust lowerer, normalized SDL hash evidence, and Rust emitter crates. Node version, config, plugin, and package diagnostics remain legacy-only.                                                                                 |
| `cert-create`, `cert-sign`, `stake`, `cert-verify`, `cert-badge` | Extract from the compiler front door.                      | Certificate and SHIPME workflows belong to assurance tooling, not the Rust compiler kernel or native product CLI.                                                                                                                                                                    |
| Holmes, Watson, Moriarty commands                                | Re-home under an explicit assurance package boundary.      | The compiler may emit facts, but evidence judgment and forecasting should live beside assurance tooling.                                                                                                                                                                             |
| `runs`                                                           | Exit with assurance/runtime evidence tooling.              | Run-ledger inspection is useful operational evidence, not compiler truth.                                                                                                                                                                                                            |
| package evidence commands in `packages/wesley-cli`               | Deleted with the Node CLI package.                         | Package-level evidence did not remain a product front door; retained assurance evidence belongs beside Holmes or another explicit assurance owner.                                                                                                                                    |

## Current Native Replacement

```bash
wesley doctor
wesley emit rust --schema <path> --out <path> --metadata-out <path>
wesley emit typescript --schema <path> --out <path> --metadata-out <path>
```

The metadata sidecar is deterministic and records the schema hash, generator
identity, generator version, and execution mode. It does not record wall-clock
time, local usernames, hostnames, or other process-local facts.

## External Ownership

If a consumer needs JavaScript validation output, it should be reintroduced as
an external target package or module. If that package needs JavaScript-side
process discipline, it can use the JavaScript-side tooling already available to
the wider project ecosystem, but Wesley core should stay domain-empty.
