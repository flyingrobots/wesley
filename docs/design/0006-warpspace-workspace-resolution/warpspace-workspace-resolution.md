---
title: "WARPspace Workspace Resolution"
---

## Sponsors

- Human: I can keep one local Continuum/Wesley/Echo/`git-warp`/`warp-ttd`
  workspace coherent without hardcoding machine-local repo paths into
  Continuum-owned contract doctrine.
- Agent: I can resolve where local neighboring repos live, which roots a sync or
  drift check should touch, and which facts remain Tier Zero authority versus
  Tier One execution config.

## Hill

Wesley gains an explicit **WARPspace** concept: a local workspace descriptor
that binds named neighboring repos to real filesystem paths, while Continuum
continues to own the shared topology, consumer declarations, and semantic
release truth.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- whether local repo directories belong in Continuum doctrine or in a
  Wesley-consumed workspace file
- where a `git-warp` checkout path should be configured
- how `contract release`, `contract sync`, and `drift-watch` should resolve
  sibling repos without baking machine-specific paths into shared metadata
- whether the workspace file is authority or merely execution convenience

## Current Problem

The repo now has a useful contract-bundle model, but local orchestration still
requires too much operator memory:

- Continuum-level consumer kinds and bundle projections are declared in
  `@wesley/continuum`.
- `contract sync` still needs an explicit `--repo <path>` for every consumer
  invocation.
- local neighbor roots such as `../echo` or `../warp-ttd` are real workflow
  facts, but they are not semantic contract truth.
- `wesley.config.mjs` is project-local Wesley config, not a first-class
  multi-repo workspace model.

That creates two failure modes:

1. machine-local filesystem layout gets mistaken for Tier Zero system truth
2. operators must keep repeating sibling-repo paths on every command

## Decision Summary

1. **Continuum topology stays Tier Zero.**
2. **WARPspace is Tier One execution config.**
3. **Machine-local repo roots do not belong in Continuum-owned release truth.**
4. **WARPspace should be a separate local file, not the primary meaning of
   `wesley.config.mjs`.**
5. **CLI flags always override WARPspace.**
6. **Commands may use WARPspace for defaults, but never confuse it with schema
   authority, release authority, or compatibility authority.**

## Tier Placement

| Tier | Owner | What belongs there | What does not |
| --- | --- | --- | --- |
| Tier Zero | Continuum | shared families, consumer kinds, ownership map, release semver policy, projection intent, Holmes/Watson/Moriarty policy framing | machine-local paths like `../echo` |
| Tier One | Wesley and related cross-substrate tools | compile, release, sync, witness, drift-watch, WARPspace discovery and resolution | semantic ownership of the shared contracts |
| Tier Two | App repo / product workspace | app schema, app code, embedded Continuum usage, optional local WARPspace file | canonical shared-family authority for the ecosystem |
| Tier Three | Echo / `git-warp` / other substrate repos | runtime behavior, checked-in consumer projections, substrate facts | compiler-policy ownership |

The important call is:

- **WARPspace lives conceptually in Wesley's tier**
- **but it may physically live at the local workspace root or active app repo
  root**

That makes it a local operator artifact consumed by Wesley, not a shared
authority file owned by Continuum.

## Two-Layer Model

The model should separate **topology** from **workspace resolution**.

### Layer A: Shared Topology

Shared topology remains Continuum-owned metadata. It answers questions like:

- which consumers exist for a family
- which projection kinds each consumer receives
- which authored home is authoritative
- what release semver means for that family

Illustrative facts:

- `receipt-family` has consumers `echo`, `git-warp`, and `warp-ttd`
- `warp-ttd` consumes `manifest` plus `typescript`
- Echo consumes a generated package projection
- `git-warp` consumes some future generated projection once declared

These are durable system truths and belong in Tier Zero metadata.

### Layer B: Local WARPspace

WARPspace answers different questions:

- where is the local `continuum` checkout on this machine
- where is the local `echo` checkout
- where is the local `git-warp` checkout
- where should Wesley place local bundle cache or inspect roots

These are local execution facts. They are not part of the released contract.

## Proposed File

The canonical local workspace file should be:

```text
.warpspace.mjs
```

Reasoning:

- it is clearly workspace-scoped rather than contract-scoped
- it does not overload `wesley.config.mjs`
- it can be `.gitignore`d by default when it is machine-local
- it leaves room for a committed example such as `warpspace.example.mjs`

This packet does **not** require every repo to commit `.warpspace.mjs`. The
default expectation is:

- operators keep a local `.warpspace.mjs`
- repos may optionally ship a non-authoritative example file

## Proposed Shape

Illustrative shape:

```js
export default {
  kind: 'wesley.warpspace.v1',
  repos: {
    wesley: '.',
    continuum: '../continuum',
    echo: '../echo',
    'warp-ttd': '../warp-ttd',
    'git-warp': '../git-warp',
    app: '../my-app'
  },
  profiles: {
    continuum: {
      authorityRepoAlias: 'continuum',
      consumerRepoAliases: {
        echo: 'echo',
        'warp-ttd': 'warp-ttd',
        'git-warp': 'git-warp'
      }
    }
  },
  paths: {
    contractCacheRoot: '.wesley-cache/contracts'
  }
};
```

### Meaning Of The Fields

- `kind`: schema/version marker for the workspace file itself
- `repos`: local alias-to-path map for neighboring repos
- `profiles.<name>.authorityRepoAlias`: local repo alias Wesley should use when a
  profile's authored home lives in a neighboring authority repo
- `profiles.<name>.consumerRepoAliases`: local repo aliases for consumer kinds
- `paths`: optional local cache/output preferences

This file deliberately does **not** declare:

- contract-family semver policy
- the list of real consumers for a family
- bundle projection rules
- compatibility claims
- authored schema semantics

Those remain Tier Zero truths.

## Discovery Rules

Resolution order should be:

1. explicit CLI argument
2. explicit environment variable
3. nearest `.warpspace.mjs` found by walking upward from `cwd`
4. no workspace file, requiring today's explicit command arguments

Recommended flags and env:

- `--warpspace <path>`
- `WESLEY_WARPSPACE_FILE`

The command should fail clearly when a profile asks for a repo alias that the
local WARPspace does not define.

## Command Behavior

### `contract release`

`contract release` should be able to use WARPspace to resolve the **local path**
to a foreign-authored schema home when the profile already knows the semantic
authority and relative schema path.

What WARPspace may provide:

- the local root for alias `continuum`

What WARPspace may not provide:

- the claim that Continuum is the semantic authority
- the release semver
- the family definition

### `contract sync`

`contract sync` should accept either:

- `--repo ../echo`
- or `--consumer echo` plus a WARPspace mapping for `echo`

That makes the common local command boring while preserving a full explicit
escape hatch.

### `drift-watch`

`drift-watch` should be able to resolve mirror roots by consumer kind through
WARPspace, rather than forcing operators to restate every local mirror path.

### `witness`

WARPspace may help resolve neighboring generated roots for cross-repo witness
lanes, but witness should continue to name its proof scope explicitly. The
workspace file is path convenience, not proof scope.

## Why Not Put This In `wesley.config.mjs`?

Because `wesley.config.mjs` is a Wesley project config, while WARPspace is a
multi-repo workspace descriptor.

Overloading them would blur two different ideas:

- **how this repo wants Wesley to behave**
- **where the neighboring repos live on this machine**

Those concerns are related, but they are not the same.

## Why Not Put Repo Paths In Continuum?

Because Continuum owns topology and semantics, not operator filesystem layout.

If Tier Zero metadata says:

- `git-warp` consumes projection `X`

that is system truth.

If the local machine says:

- `git-warp` is checked out at `../git-warp`

that is local execution truth.

Confusing those makes shared doctrine noisy and machine-specific.

## Non-goals

- Turn WARPspace into the semantic authority for shared contract families.
- Replace explicit CLI arguments in every case.
- Make WARPspace the universal config surface for all Wesley features.
- Commit machine-specific repo paths into shared release metadata.
- Solve the `git-warp` consumer projection itself in this packet.

## Follow-On Work

- add WARPspace discovery and validation helpers to shared CLI/runtime code
- teach `contract sync` to resolve `--repo` from WARPspace when omitted
- teach `contract release` to resolve foreign-authored local roots from
  WARPspace aliases
- teach `drift-watch` to resolve mirror roots from WARPspace aliases
- decide whether to ship a committed `warpspace.example.mjs`
- once `git-warp` declares a real projection, bind its consumer kind to a local
  repo alias through WARPspace

## Related Packet

- [Continuum Contract Bundle Release and Sync](../0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md)

## Playback Questions

### Human

- [ ] Can I explain why `../echo` belongs in WARPspace rather than Continuum
      doctrine?
- [ ] Can I tell the difference between a declared consumer kind and the local
      repo path for that consumer?
- [ ] Can I say where a `git-warp` checkout path should live without claiming it
      is Tier Zero authority?

### Agent

- [ ] Can I resolve local repo roots without mistaking them for semantic
      ownership metadata?
- [ ] Can I explain why WARPspace is Tier One execution config even if the file
      physically lives in an app repo?
- [ ] Can I describe how `contract sync` and `drift-watch` should use WARPspace
      while keeping CLI overrides authoritative?
