# Legacy Command Decisions

This note records the command-boundary decisions made during slices NR-023
through NR-030 of the Node retirement campaign.

## Rule

Native Wesley only keeps behavior that belongs to the generic compiler kernel,
the native command body, or a generic emitter crate. Target-specific generation,
runtime scaffolding, product starter projects, and ecosystem validation helpers
belong in external modules or owning repos.

## Decisions

| Legacy command | Decision | Reason |
| --- | --- | --- |
| `generate` | Port only generic parity through explicit native commands. | The old umbrella command mixed compiler lowering, target dispatch, artifact layout, evidence bundle writing, and product assumptions. Native Wesley now names the retained generic path as `wesley emit rust` and `wesley emit typescript`; external modules own additional targets. |
| `zod` | Extract from core Wesley. | Zod is a JavaScript validation target, not compiler truth. It can be valuable as an external module or package, but it should not force a Rust Zod emitter crate into the core retirement path. |
| `models` | Retire from core Wesley. | Model-class scaffolding is target/application ergonomics. The retained generic model facts now appear through Rust and TypeScript emitters; richer model classes need an owning target module. |
| `init` | Retire legacy scaffolding. | The historical `init` shape can smuggle product conventions into generic Wesley. A future native `init` may create a tiny generic starter schema, but that is a new proposal, not a port of the Node command. |

## Current Native Replacement

```bash
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
