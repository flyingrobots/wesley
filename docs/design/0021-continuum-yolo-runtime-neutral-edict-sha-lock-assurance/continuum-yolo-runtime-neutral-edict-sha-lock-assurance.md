---
title: 'PLATFORM - Continuum YOLO, Runtime-Neutral Edict, and SHA-lock Assurance'
legend: 'PLATFORM'
lane: 'design'
packet: '0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance'
issue: 'https://github.com/flyingrobots/wesley/issues/611'
pr: 'https://github.com/flyingrobots/wesley/pull/610'
status: 'extracted'
owners:
  - '@flyingrobots'
created: '2026-06-17'
updated: '2026-06-18'
---

<!-- markdownlint-disable MD025 -->

# PLATFORM - Continuum YOLO, Runtime-Neutral Edict, and SHA-lock Assurance

<!-- markdownlint-enable MD025 -->

## Extracted To Edict

The Edict language and Continuum assurance specifications that originated in
this Wesley packet now live in the dedicated public repository:

```text
https://github.com/flyingrobots/edict
```

Canonical documents:

- [SPEC - Edict Language v1](https://github.com/flyingrobots/edict/blob/main/docs/SPEC_edict-language-v1.md)
- [SPEC - Edict Target Profile ABI v1](https://github.com/flyingrobots/edict/blob/main/docs/SPEC_edict-target-profile-abi-v1.md)
- [SPEC - Continuum Contract Bundle v1](https://github.com/flyingrobots/edict/blob/main/docs/SPEC_continuum-contract-bundle-v1.md)
- [SPEC - Continuum Admission v1](https://github.com/flyingrobots/edict/blob/main/docs/SPEC_continuum-admission-v1.md)
- [GUIDE - Edict Assurance and Transparency](https://github.com/flyingrobots/edict/blob/main/docs/GUIDE_edict-assurance-transparency.md)
- [Design Baseline](https://github.com/flyingrobots/edict/blob/main/docs/DESIGN_runtime-neutral-edict-sha-lock-assurance.md)

Wesley keeps this packet as a historical locator for
[PR #610](https://github.com/flyingrobots/wesley/pull/610) and
[Issue #611](https://github.com/flyingrobots/wesley/issues/611), and as a
reminder of the repository boundary:

- Edict owns the language, Core IR, canonicalization, conformance fixtures, and
  target-profile ABI surface.
- Wesley owns GraphQL and `weslaw` source-profile adapters and compiler
  evidence integration.
- Continuum owns participant protocol and admission.
- Echo owns `echo.dpo@1` target semantics.

The historical packet slug contains `yolo` as a design locator. It is not a
canonical runtime coordinate, target profile identifier, bundle profile
identifier, or hash input. Formal artifacts use
`continuum.lane.lawful-autonomous/v1`.
