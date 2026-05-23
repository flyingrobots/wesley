# RUNTIME domain event lifecycle factory for repeated started-completed-failed patterns

Legacy `TASKS.md` still called out repeated Started/Completed/Failed domain
event boilerplate.

Done when:

- repeated lifecycle shape boilerplate is factored behind one honest helper or factory
- callers remain explicit about distinct payload semantics
- regression tests protect the shared lifecycle shape
