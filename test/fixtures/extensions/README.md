# Fixture Extensions

Fixture extensions are descriptor-only packages for external-consumer realism.

They let Wesley test schemas, vectors, emitter surfaces, and capability
metadata that look like real downstream use without making those domains part
of the base product.

Rules:

- Keep authored schemas and vectors in `test/fixtures/consumer-models/`.
- Put extension descriptors under `test/fixtures/extensions/<name>/`.
- Treat product nouns in extension descriptors as fixture data only.
- Keep algorithm unit tests and public emitter docs domain-neutral.
- Move reusable domain behavior to the owning external repo or module before it
  becomes product behavior.
