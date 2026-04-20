# RUNTIME v2 scheduler and deterministic caching

Legacy `ROADMAP.md` still described a later runtime phase for scheduler ports,
resource-aware execution, and content-addressed caching.

Done when:
- scheduling and locking semantics are explicit behind ports
- safe parallelism preserves artifact and evidence determinism
- caching improves reruns without changing truth or replay semantics
