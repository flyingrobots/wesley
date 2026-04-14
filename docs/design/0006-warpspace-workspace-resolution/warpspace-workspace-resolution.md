---
title: "WARPspace Workspace Resolution"
---

## Sponsors

- Human: I can configure one host project to consume Continuum contract families
  through Wesley without depending on sibling checkouts of Echo, `git-warp`,
  `warp-ttd`, or Wesley itself.
- Agent: I can explain which parts of contract consumption belong to Continuum,
  which belong to Wesley, and which belong to the host application's committed
  WARPspace file.

## Hill

Wesley gains an explicit **WARPspace** concept centered on the host project: a
committed application-level artifact that tells Wesley which contract families
the project consumes, which projections it wants, and where generated schema or
code should land inside that project.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- whether WARPspace is a local-only dev convenience or a committed host-project
  artifact
- where a host project should declare the landing roots for generated
  TypeScript, Zod, Rust, or other projections
- how Wesley should behave when the ecosystem is distributed as npm packages and
  Rust crates rather than sibling git repos
- what role local checkout paths still play, if any

## Current Problem

The first cut of this packet overfit the current repository layout and treated
WARPspace as if it were mainly a local multi-repo alias file.

That is not the target state.

The actual target state is:

- Continuum remains the semantic owner of shared families.
- Wesley, `git-warp`, and `warp-ttd` are consumable npm packages.
- Echo is consumable as a Rust crate.
- host projects use Wesley to materialize generated artifacts into their own
  repository.

That means the primary operator problem is not:

> where are my sibling repos checked out?

It is:

> how does this host project declare what Continuum contract families it uses,
> which projections it wants, and where those outputs should land?

Local repo roots still matter for development and debugging, but they are no
longer the center of the design.

## Decision Summary

1. **WARPspace is primarily a Tier Two host-project artifact.**
2. **The canonical WARPspace file should be committed with the host project.**
3. **WARPspace tells Wesley where generated outputs land inside the host
   project.**
4. **Continuum Tier Zero still owns family semantics, consumer topology,
   compatibility, and release truth.**
5. **Local sibling repo paths are optional development overrides, not the
   primary meaning of WARPspace.**
6. **Wesley consumes WARPspace; WARPspace does not replace Continuum doctrine or
   bundle metadata.**

## Tier Placement

| Tier | Owner | What belongs there | What does not |
| --- | --- | --- | --- |
| Tier Zero | Continuum | shared families, authorship, release semver, compatibility policy, consumer topology, projection intent, Holmes/Watson/Moriarty framing | app-specific output directories |
| Tier One | Wesley and other cross-substrate tools | compile, release, witness, drift-watch, WARPspace loading, generator execution | semantic ownership of the shared contracts |
| Tier Two | Host project / application | `warpspace.mjs`, application schema, local generated roots, app-specific integration choices | ecosystem-wide contract authority |
| Tier Three | Substrate and runtime packages/crates | Echo runtime crates, `git-warp` packages, `warp-ttd` packages, runtime behavior | compiler policy and release semantics |

The key call is:

- **Continuum names what exists and what it means**
- **WARPspace names how one host project consumes it**

## Two-Layer Model

The model should separate **shared contract topology** from **host-project
consumption**.

### Layer A: Shared Topology

Shared topology stays in Tier Zero metadata and answers questions like:

- which contract families exist
- which projections are publishable
- which consumer categories are supported
- how family semver works
- what compatibility promises a release makes

Illustrative truths:

- `receipt-family` is a Continuum-owned family
- `warp-ttd` projection `manifest` exists
- Echo projection `echo-ir` exists
- one release bundle may publish several projections

Those are not host-project decisions.

### Layer B: Host-Project WARPspace

WARPspace answers different questions:

- does this app consume `receipt-family`, `settlement-family`, or both
- which released family version or compatibility range does it want
- which projections should Wesley materialize for this app
- where should generated outputs land inside this repository
- which runtime package or crate coordinates should generated code align with

Those are application integration decisions.

## Proposed File

The canonical file should be:

```text
warpspace.mjs
```

Reasoning:

- it is a committed application artifact, not a hidden machine-local secret
- it reads as part of the host project's integration surface
- it does not overload `wesley.config.mjs`
- it still leaves room for a local override file when needed

## Optional Local Override

If a maintainer wants to test against local sibling checkouts during development,
that should be a separate optional file:

```text
.warpspace.local.mjs
```

This override file may carry local development conveniences such as:

- `../echo`
- `../git-warp`
- `../warp-ttd`
- `../continuum`

That keeps local checkout paths available without making them the meaning of the
main WARPspace artifact.

## Proposed Shape

Illustrative shape:

```js
export default {
  kind: 'wesley.warpspace.v1',
  profile: 'continuum',
  contracts: {
    'receipt-family': {
      version: '^0.1.0',
      projections: ['typescript', 'zod', 'echo-ir']
    }
  },
  outputs: {
    typescript: 'src/generated/continuum',
    zod: 'src/generated/continuum/zod',
    'echo-ir': 'crates/my-app-contracts/src/generated'
  },
  runtimes: {
    wesley: {
      package: '@wesley/cli',
      version: '^0.1.0'
    },
    'git-warp': {
      package: '@git-warp/runtime',
      version: '^0.1.0'
    },
    'warp-ttd': {
      package: '@warp-ttd/protocol',
      version: '^0.1.0'
    },
    echo: {
      crate: 'echo-runtime',
      version: '^0.1.0'
    }
  }
};
```

The package and crate names above are illustrative. The important structural
point is:

- WARPspace binds consumed families and output locations to one host project
- it does not redefine the family semantics themselves

## Meaning Of The Fields

- `kind`: schema/version marker for the WARPspace file itself
- `profile`: which Wesley-side product profile interprets the contract family
  defaults
- `contracts`: the families this host project consumes and the projections it
  expects Wesley to materialize
- `outputs`: where generated artifacts should land inside the host project
- `runtimes`: the package/crate ecosystem this host project expects to align
  with

This file deliberately does **not** declare:

- Continuum family ownership
- contract-family semver policy meaning
- bundle compatibility guarantees
- what a projection means semantically
- ecosystem-wide consumer topology

Those remain Tier Zero truths.

## Discovery Rules

Resolution order should be:

1. explicit `--warpspace <path>`
2. explicit `WESLEY_WARPSPACE_FILE`
3. nearest `warpspace.mjs` found by walking upward from `cwd`
4. optional merge of `.warpspace.local.mjs` from the same directory
5. fail clearly if no WARPspace file exists when a command requires host-project
   integration state

CLI flags should always override WARPspace values.

## Command Behavior

### `generate`

Wesley's generation commands should be able to use WARPspace as the default
source of output roots and projection selection for the host project.

That means the app can say:

- generate my `receipt-family` TypeScript and Zod surfaces into `src/generated`

without repeatedly re-entering paths on every command.

### `contract release`

`contract release` remains a producer-side release operation. It should still be
able to run without a host-project WARPspace file, because release truth belongs
to the contract family, not to one consuming app.

WARPspace may still be useful here when the active project is both a consumer
and a local release operator, but it is not the authority for the release.

### `contract sync`

The current repo-to-repo `contract sync` command should be treated as a
bootstrap and producer-maintenance surface.

Target-state consumer behavior is broader:

- Wesley reads `warpspace.mjs`
- Wesley resolves the desired family projections
- Wesley materializes those outputs into the app's declared roots
- Wesley verifies those roots against the chosen released bundle

That may remain `contract sync`, or it may eventually deserve a more
consumer-facing command name. The design requirement is more important than the
final verb.

### `drift-watch`

`drift-watch` should be able to compare a host project's generated roots against
the released bundle and WARPspace expectations, not only against sibling repo
mirrors.

### `witness`

WARPspace may help locate app-owned generated surfaces for bounded witness lanes,
but witness scope should still be defined by the contract family and proof lane,
not by arbitrary app layout.

## Why Not Put This In `wesley.config.mjs`?

Because `wesley.config.mjs` is Wesley project configuration, while WARPspace is
host-project contract-consumption configuration.

Those are adjacent, but not identical:

- `wesley.config.mjs`: how Wesley itself is configured for this repo
- `warpspace.mjs`: how this app consumes shared contract families

Keeping them distinct makes the integration surface much clearer.

## Why Not Put This In Continuum?

Because WARPspace is about one host project's consumption choices.

If Continuum says:

- `receipt-family` publishes projection `echo-ir`

that is ecosystem truth.

If a host project says:

- materialize `echo-ir` into `crates/my-app-contracts/src/generated`

that is application truth.

Continuum should not own application-specific output directories.

## Relationship To Local Checkouts

Local checkouts are still useful, but they are no longer the main model.

They should be treated as optional development overrides for cases like:

- testing Wesley against a local Echo crate checkout
- validating a new `git-warp` package cut before publication
- running release tooling across neighboring repos during platform development

That is what `.warpspace.local.mjs` is for.

## Non-goals

- Make sibling git repos the required integration story.
- Turn WARPspace into the semantic authority for contract families.
- Replace released bundles with ad hoc app-local config.
- Force every Wesley command to require a WARPspace file.
- Solve package publication and registry logistics in this packet.

## Follow-On Work

- revise CLI/runtime config discovery to load `warpspace.mjs`
- add optional `.warpspace.local.mjs` merge behavior for development overrides
- teach generation commands to resolve output roots from WARPspace
- teach `drift-watch` to validate host-project generated roots against WARPspace
  and released bundles
- decide whether `contract sync` should remain the end-state command name for
  host-project materialization
- refine how runtime package/crate coordinates are represented once the package
  publishing contract is real

## Related Packets

- [Continuum Contract Bundle Release and Sync](../0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md)

## Playback Questions

### Human

- [ ] Can I explain why `warpspace.mjs` belongs in the host project?
- [ ] Can I tell the difference between Continuum's release truth and one app's
      output directories?
- [ ] Can I explain why local sibling repo paths are optional overrides rather
      than the main WARPspace story?

### Agent

- [ ] Can I describe WARPspace as host-project consumption config rather than
      multi-repo folklore?
- [ ] Can I explain why package/crate distribution changes the center of gravity
      from repo-root aliases to app output roots?
- [ ] Can I describe how Wesley should consume WARPspace without letting it
      overwrite Tier Zero contract truth?
