---
title: 'Realization Admission and Witness'
---

## Sponsors

- Human: I can point to one finite doctrine for what Wesley admits, what it
  emits, what the realization manifest packages, and what a witness pass
  actually proves.
- Agent: I can inspect Wesley docs and code without collapsing authored source,
  IR, emitted artifacts, manifests, and witness residue into one blurred
  surface.

## Hill

Wesley's realization model becomes a boring, repo-grounded doctrine instead of
an implied mix of compiler truth, shell metadata, and witness claims scattered
across architecture notes and Continuum packets.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- which surface is the only authored contract authority
- which surface generators are allowed to consume
- what `realization/manifest.json` is for
- what a witness command proves today
- which adjacent claims remain out of scope

## Surface Model

| Surface                 | What it is                                           | Authority                                      | What downstream consumers may rely on                                             |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Authored source         | Sovereign GraphQL SDL                                | authored contract authority                    | schema meaning and declared contract shape                                        |
| Lowered IR              | Wesley's admitted internal reading of authored SDL   | compiler-internal semantic truth               | generator input only; not a publication artifact                                  |
| Emitted artifact family | Generated files for one compile leg or transmutation | derived consequence of authored source plus IR | target-specific artifacts, subject to manifest and witness checks                 |
| Realization shell       | `realization/manifest.json` plus artifact signatures | packaging shell for one emitted leg            | source identity, artifact inventory, signature integrity, recorded witness status |
| Witness output          | bounded proof result for one check or scope          | explicit certified property set                | only the properties named by the witness scope                                    |
| Runtime observation     | logs, receipts, debugger surfaces, live envelopes    | neighboring runtime or observer systems        | operational truth only when separately witnessed                                  |

## Doctrine

- Authored source is the only contract authority. Handwritten mirrors or shadow
  contracts do not become peer authorities just because they look similar.
- Lowered IR is Wesley's admitted reading of authored source. Generators should
  only depend on IR and explicit emission context, not the physical source tree
  or unpublished schema-side assumptions.
- The realization shell is not the witness proof. It packages leg identity,
  artifact signatures, and witness status so later verification can remain
  boring and machine-checkable.
- Witness output is not runtime observation. A witness pass means only that the
  named properties were checked and passed for the named scope.
- Runtime, storage, debugger, privacy, and observer-rights semantics remain
  neighboring surfaces unless a witness explicitly proves them.

## Bounded Properties Wesley Certifies Today

These are the kinds of claims Wesley should make today without overstating the
system:

- source traceability from emitted artifacts back to authored SDL
- artifact integrity for generated files recorded in the realization shell
- cross-leg coherence where a witness scope compares multiple emitted families
- fixture and roundtrip conformance for selected Continuum proving lanes
- anti-shadow publication-boundary checks where the repo defines them

## Reliance Boundary

Downstream consumers may rely on:

- the authored schema named as source of truth
- the realization shell's identity and signature data
- an explicit witness pass for the exact properties named in that witness scope

Downstream consumers may not infer, without additional proof:

- runtime correctness
- storage semantics
- debugger semantics
- full observer-rights policy
- privacy or revelation guarantees beyond the cited witness scope

## Supporting Slice Closeouts

- [RE-030 — Realization Integrity Guard](./RE-030-realization-integrity-guard.md)
- [CI-001 — Cryptographic Artifact Signing](./CI-001-artifact-signing-and-sealing.md)

## Playback Questions

### Human

- [x] Can I explain the difference between authored source, IR, emitted
      artifacts, realization shell, and witness output without improvising?
- [x] Can I tell which parts of a Continuum proof are compile-time shell checks
      and which parts are bounded semantic witnesses?
- [x] Can I read a witness result without mistaking it for total runtime truth?

### Agent

- [x] Can I map generator inputs and witness outputs back to these surfaces
      without inventing extra layers?
- [x] Can I avoid treating `realization/manifest.json` as a second source of
      contract semantics?
- [x] Can I state the exact certified property instead of saying a leg is
      simply "verified"?

## Playback

- Human: yes. The packet now reads cleanly against the shipped command surfaces:
  authored SDL remains the only authority, lowering is generator-only,
  `realization/manifest.json` is a packaging shell, and witness output names a
  bounded property set instead of implying runtime truth.
- Human: yes. Compile-time shell checks were concrete in the original
  `verify-realization` guard while that Continuum verifier lived in this repo;
  generic Wesley now keeps semantic witness claims in explicit witness reports
  and expects product-owned realization checks to return through modules.
- Human: yes. The docs, witness `proves` / `doesNotProve` fields, and
  realization inspection checks make it harder to confuse shell integrity with
  end-to-end runtime certification.
- Agent: yes. Generator input is the lowered IR, shell inspection is explicit,
  and witness output carries named checks such as source traceability,
  artifact-signature integrity, and selected cross-leg conformance.
- Agent: yes. The manifest is now forced to prove traceability back to the
  authored schema instead of acting like a second semantic authority.
- Agent: yes. The current release can state finite claims such as "sourceHash
  matches authored SDL" or "artifact signatures drifted" without collapsing
  those into generic "verified" language.

## Retrospective

- Doctrine only became durable once it was tied to boring enforcement. The
  packet would have stayed soft if `sourceHash`, signatures, hooks, and witness
  checks had remained implied instead of executable.
- Keeping realization-shell checks separate from witness semantics was the
  right cut. It made the command surface easier to explain and prevented shell
  integrity from being mistaken for total proof.
- The main follow-on remains consumer-side verification after bundle sync.
  That belongs with contract-bundle work, not by widening this packet into
  runtime or mirror policy.

## Non-goals

- Define a full WARP optic theory for Wesley.
- Replace the Continuum packet's proving-lane specifics.
- Freeze observer-rights or property-certificate policy for every neighboring
  repository.
- Claim that the current release already proves runtime, storage, or debugger
  truth end to end.
