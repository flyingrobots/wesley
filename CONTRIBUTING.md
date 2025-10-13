# Contributing to Wesley

Thank you for your interest in contributing to Wesley! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- GraphQL schema that triggers the issue
- Generated SQL/tests (if applicable)
- Wesley version and Node.js version

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- Clear description of the enhancement
- Use case and motivation
- Example GraphQL schema demonstrating the feature
- Expected generated output

### Pull Requests

1. Fork the repo and create your branch from `main`
2. Follow the architecture guidelines below
3. Add tests for any new functionality
4. Ensure all tests pass: `pnpm test`
5. Update documentation as needed
6. Follow the commit message conventions

## Architecture Guidelines

Wesley follows hexagonal architecture with clear separation:

### wesley-core
- Pure domain logic, zero dependencies
- All business logic goes here
- No file I/O, no platform-specific code

### wesley-host-node
- THIN adapters only
- Wraps Node.js-specific libraries (fs, graphql, pg-parser)
- No business logic

### wesley-cli
- Command-line interface
- Orchestrates core with host adapters

### wesley-holmes
- Sidecar package for intelligence features
- Separate from main CLI

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/wesley.git
cd wesley

# Install dependencies (pnpm workspace)
pnpm install

# Run tests
pnpm test

# Run example
cd example
pnpm exec wesley generate --schema ecommerce.graphql
```

## Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
docker-compose up -d
pnpm test:integration
```

### Golden Tests
Add snapshot tests for generators in:
- `packages/wesley-core/test/snapshots/`

## Commit Message Format

We follow conventional commits:

```
feat: add RLS policy generation
fix: handle null foreign keys
docs: update architecture diagram
test: add golden tests for migrations
refactor: move generators to core
```

## Adding New Features

### New Directive

1. Add to `schemas/directives.graphql`
2. Update `DirectiveProcessor` in core
3. Add handling in relevant generator
4. Add tests
5. Update documentation

### New Generator

1. Create in `packages/wesley-core/src/domain/generators/`
2. Implement pure generation logic
3. Create thin adapter in `wesley-host-node` if needed
4. Add to `GenerationPipeline`
5. Add comprehensive tests

## Code Style

- Use ESM modules (`.mjs`)
- No TypeScript in core (pure JavaScript)
- JSDoc comments for public APIs
- Meaningful variable names
- Small, focused functions

## Documentation

Update relevant docs when making changes:
- API changes: Update JSDoc comments
- New features: Update README.md
- Architecture changes: Update docs/architecture/

## License

This project is licensed under **MIND‑UCAL v1.0** (Moral Intelligence · Non‑violent Development · Universal Charter‑Aligned License). See `LICENSE` for the full text. By contributing, you agree your contributions will be distributed under MIND‑UCAL v1.0.

## Release Process

We use changesets for versioning:

```bash
pnpm changeset
pnpm version
pnpm publish
```

## Questions?

Feel free to open an issue for any questions about contributing!

## Tooling & Hooks

### Package Manager
- We use pnpm (workspace). Please ensure pnpm 9+ is installed. The repo pins the package manager in `package.json`.

### Git Hooks
- On install, our `prepare` script sets `core.hooksPath` to `.githooks/`.
- A pre-push hook runs a fast preflight before pushing.

### Preflight (local and CI)
- Run manually: `pnpm run preflight`.
- What it checks:
  - Docs link integrity (relative links only)
  - Architecture boundaries via dependency-cruiser
  - ESLint purity for `packages/wesley-core` (no node:* / process / fs / path)
  - Workflow hygiene (no macOS runners, no Claude workflows)
  - .gitignore hygiene (.wesley/ and out/ ignored)
- Bypass (not recommended): set `SKIP_PREFLIGHT=1`.
- CI: A `Preflight` workflow runs on PRs and main pushes and should pass before merging.

### Node / Runtimes
- Recommended Node: 20 LTS (CI uses Node 20).
- macOS runners are removed from CI to control cost; Linux environments are primary.
