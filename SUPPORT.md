# Support

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley is pre-1.0 software. Support is best-effort and release-scoped unless a
specific downstream consumer has a separate support agreement.

## Questions And Design Discussion

Use GitHub Discussions for questions, design discussion, usage help, and
extension-boundary conversations:

https://github.com/flyingrobots/wesley/discussions

## Bugs And Documentation Fixes

Use GitHub Issues for reproducible bugs, broken documentation, release blockers,
and repository integrity problems:

https://github.com/flyingrobots/wesley/issues

When filing an issue, include:

- the Wesley version or commit
- the command you ran
- the smallest schema, operation, law file, or fixture that reproduces it
- the expected output
- the actual output

## Security

Do not file public issues for vulnerabilities. Follow
[SECURITY.md](./SECURITY.md) for supported versions and private reporting.

## Scope Boundary

Wesley owns GraphQL-to-IR transformation and generic compiler/tooling evidence.
Runtime behavior, storage semantics, application policy, graph rewrites,
framework adapters, and database-specific interpretation belong to their owning
extension, sibling repo, or consuming application.
