# ASAP

Use this lane for near-term Wesley work that now matters to the active stack
but is not yet pulled into the current release packet or a committed design
cycle.

Keep items narrow, evidence-backed, and explicit about which shared seam or
compiler boundary they are trying to freeze next.

The active ASAP hill is v0.0.6 compiler truth: finish Rust IR parity evidence,
enforce the domain-empty core boundary, and stop treating historical product or
database lanes as Wesley features.

Current near-term pulls:

1. The `ninelives`/Alfred decision has been pulled into
   `docs/design/0015-resilience-policy-boundary/`.
2. Next pulls should add evidence only where the resilience boundary touches the
   v0.0.6 compiler-truth and module-boundary work.
