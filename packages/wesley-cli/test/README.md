# Wesley CLI Test Suite

## Overview

Wesley CLI uses **Bats (Bash Automated Testing System)** for testing. See the [CLI tests guide](../../../docs/guides/cli-tests.md) for rationale and CI details.

## Running Tests

```bash
# Run all tests
pnpm test

# Verbose output
pnpm test:verbose

# TAP format output (for CI)
pnpm test:tap

# Direct bats execution
./test/run-bats.sh
```

## Test Structure

### Current Test Files

- **`cli-basic.bats`** - Core CLI functionality (12 tests)
  - Version and help flags
  - Schema file handling and error cases
  - stdin support (`--schema -` and `--stdin`)
  - JSON output formatting
  - Quiet mode behavior
  - Exit code validation

### Test Organization

```
test/
├── *.bats                     # Bats test files
├── run-bats.sh               # Test runner script
├── bats-plugins/             # Bats plugin dependencies
│   ├── bats-support/         # Core assertions and helpers
│   ├── bats-assert/          # Rich assertion library
│   └── bats-file/           # File system assertions
├── archived-bash-tests/      # Old custom bash tests (reference)
└── README.md                # This file
```

## Bats Features Used

- **`@test` blocks** - Individual test cases
- **`run` command** - Captures command output and exit codes
- **`assert_success/failure`** - Exit code assertions
- **`assert_output`** - Output content validation
- **`setup/teardown`** - Test isolation with temp directories

## Test Patterns

### Basic CLI Test
```bash
@test "command works" {
    run node "$CLI_PATH" --version
    assert_success
    assert_output --partial "0.1.0"
}
```

### Error Handling Test
```bash
@test "missing file exits 2" {
    run node "$CLI_PATH" generate --schema ./nonexistent.graphql
    assert_failure 2
    assert_output --partial "not found"
}
```

### stdin Test
```bash
@test "stdin input works" {
    run bash -c "echo 'schema' | node '$CLI_PATH' generate --schema -"
    assert_failure 3  # Expected due to stub parser
}
```

## Why Bats?

From our technical debate, Bats was chosen because it:

1. **Maintains authenticity** - Tests actual CLI subprocess execution
2. **Keeps tech stack tight** - Pure bash, no additional runtimes
3. **Industry standard** - Used by Docker, Kubernetes tooling, GitHub CLI
4. **Perfect for CLI testing** - Shell-native approach for shell tools
5. **Simple and transparent** - Zero abstraction between test and CLI

## Migration Notes

- **Converted from custom bash scripts** - Original tests archived in `archived-bash-tests/`
- **All functionality preserved** - 12/12 tests passing after migration
- **Added structure** - Standardized assertions, better error reporting
- **CI-ready** - TAP output format, proper exit codes

## Future Test Scenarios

When Wesley CLI adds complex features, we may need additional test coverage for:
- TTY-sensitive output (colors, progress bars)
- File watching with debouncing (`--watch` mode)
- Time-dependent logic (polling, backoff)
- Interactive flows

These would trigger a discussion about hybrid testing approaches, but pure Bats remains optimal for current scope.

## Debugging Tests

```bash
# Run specific test file
bats test/cli-basic.bats

# Verbose output shows command details
./test/run-bats.sh --verbose

# Debug failing tests by copying the exact command
# Example: node ./wesley.mjs generate --schema - --quiet
```

The test isolation ensures each test runs in a clean temporary directory, making debugging straightforward.
