# Hello Wesley Target

This fixture is a minimal external-process target conformance template.

It demonstrates:

- a generic GraphQL schema
- a target descriptor that can be validated without execution
- a request envelope containing L1 IR and schema operation metadata
- a response envelope containing diagnostics and an artifact manifest
- a deterministic emitted artifact with a checked SHA-256 digest

The fixture does not execute target code. It exists so target authors can copy
one complete, domain-empty envelope set before `wesley target run` exists.
