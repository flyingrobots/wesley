# Test Suite Overview

The `test/` directory hosts integration and end-to-end coverage for Wesley.

## Layout

- `cli-*.bats` – Bats suites that exercise the CLI behaviour (`wesley generate`, `plan`, `blade`, etc.). These are invoked via `pnpm --filter @wesley/cli test` or the CI workflows.
- `holmes-e2e.bats` – Ensures SHA-lock HOLMES commands emit expected artifacts.
- `e2e/` – Composite end-to-end flows that knit multiple commands together.
- `fixtures/` – Canonical inputs shared across suites:
  - `fixtures/examples/` – Example GraphQL schemas, JSON ops, and generated pgTAP snapshots used in docs and quick-starts.
  - `fixtures/blade/` – The Daywalker Deploys demo schemas, run script, and signing key instructions.
  - `fixtures/postgres/` – SQL used to bootstrap CI Postgres services (extensions, seeds).
- `packages/` – Package-specific helpers used during testing.

## Running Tests

```bash
pnpm --filter @wesley/cli test        # CLI Bats suites
pnpm --filter @wesley/holmes test     # HOLMES integration tests
pnpm --filter @wesley/core test       # Core domain tests (unit, property, snapshots)
```

The GitHub Actions workflows (`ci.yml`, `cli-tests.yml`, `wesley-holmes.yml`) run the relevant subsets automatically.

> [!tip]
> Many commands rely on the fixture directories above. Keep them immutable and regenerate outputs by running the documented scripts (`pnpm run generate:example`, `test/fixtures/blade/run.sh`).
