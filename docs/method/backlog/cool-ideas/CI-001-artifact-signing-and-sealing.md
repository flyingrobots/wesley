# CI-001 — Cryptographic Artifact Signing

Legend: [EVIDENCE — Evidence Truth]

## Idea

Wesley produces "Derived Artifacts" (SQL, Rust, TS) that are projections of authored truth. Currently, we trust that these files haven't been modified between the generation event and the commit.

Extend the `realization/manifest.json` to include per-file HMAC signatures. During the `witness` phase, Wesley should re-calculate these signatures and fail if any generated file has been tampered with. This "Seals" the realization, ensuring that the evidence (the witness) applies to the *exact* code that was emitted.

## Why

1. **Settlement**: Provides mathematical proof of artifact integrity.
2. **Auditability**: Essential for high-stakes systems (like Xyph) where generated coordination logic must be conformant.
3. **Security**: Prevents accidental or malicious modification of the generated "Hot Path."

## Effort

Medium — requires adding HMAC logic to the emission pipeline and signature verification to the witness suite.
