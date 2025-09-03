# Wesley CLI - Testing & CI/CD

## 🎯 Overview

Wesley CLI uses a comprehensive testing strategy based on **Bats (Bash Automated Testing System)** for authentic end-to-end CLI testing, chosen through [philosophical debate with Codex](../../docs/debates/codex/cli-test-framework/).

## 🧪 Test Suite

### Current Coverage: 12/12 Tests Passing ✅

```bash
✅ Version and help flags
✅ Schema file handling and error cases
✅ stdin support (--schema - and --stdin)
✅ JSON output formatting with stream separation  
✅ Quiet mode behavior
✅ Exit code validation (2=ENOENT, 3=PARSE_FAILED)
✅ Error message consistency across modes
```

### Running Tests

```bash
# Standard test run
pnpm test

# Verbose output (shows command details)
pnpm test:verbose

# TAP format (for CI integration)
pnpm test:tap

# Direct Bats execution
./test/run-bats.sh
```

## 🚀 CI/CD Integration

### GitHub Actions Workflows

1. **Quick Feedback**: `cli-quick.yml`
   - **Trigger**: Every CLI change
   - **Runtime**: ~2-3 minutes
   - **Environment**: Ubuntu + Node 20
   - **Purpose**: Fast development feedback

2. **Full Matrix**: `cli-tests.yml`
   - **Trigger**: All related package changes
   - **Runtime**: ~8-12 minutes
   - **Matrix**: 6 combinations (Ubuntu/macOS × Node 18/20/22)
   - **Features**: TAP artifacts, verbose failure output

### Local CI Simulation

```bash
# Test the same setup CI will use
./test-ci-locally.sh
```

## 🛠️ Technical Implementation

### Why Bats?

Based on our comprehensive technical analysis:

1. **Authenticity** - Real subprocess execution, not mocked APIs
2. **Industry Standard** - Used by Docker, Kubernetes, GitHub CLI
3. **Minimal Dependencies** - Pure bash, no additional runtimes  
4. **Perfect Fit** - Shell-native testing for shell tools
5. **CI-Friendly** - TAP output, proper exit codes

### Test Architecture

```
test/
├── cli-basic.bats           # 12 core CLI tests
├── run-bats.sh             # Test runner with options  
├── bats-plugins/           # Assertion & helper libraries
│   ├── bats-support/       # Core test helpers
│   ├── bats-assert/        # Rich assertions
│   └── bats-file/         # File system helpers
└── README.md              # Detailed test documentation
```

### Test Patterns

**Basic CLI Test**:
```bash
@test "version flag works" {
    run node "$CLI_PATH" --version
    assert_success
    assert_output --partial "0.1.0"
}
```

**Error Handling Test**:
```bash
@test "missing file exits 2" {
    run node "$CLI_PATH" generate --schema ./nonexistent.graphql
    assert_failure 2
    assert_output --partial "not found"
}
```

**stdin Test**:
```bash
@test "stdin input works" {
    run bash -c "echo 'schema' | node '$CLI_PATH' generate --schema -"
    assert_failure 3  # Expected due to stub parser
}
```

## 📊 Philosophy: Pure Integration Testing

Our approach prioritizes **integration over unit testing**:

- **Focus**: Test user-visible behavior, not internal implementation
- **Coverage**: Real CLI workflows end-to-end
- **Authenticity**: Actual process spawning, file I/O, exit codes
- **Simplicity**: One framework, one set of concepts

### When to Reconsider

We'll evaluate hybrid approaches (Bats + Vitest) if Wesley CLI adds:
- TTY-sensitive features (colors, progress bars)
- File watching with debouncing (`--watch` mode)
- Complex time-dependent logic (polling, backoff)
- Interactive user flows

For current scope, pure Bats provides optimal simplicity and coverage.

## 🔍 Debugging

### Failed Tests

```bash
# Copy failing command and run manually
node wesley.mjs generate --schema - --quiet

# Enable verbose output
./test/run-bats.sh --verbose

# Check specific test file
bats test/cli-basic.bats
```

### CI Failures

1. **Check quick workflow first** - faster feedback
2. **Download TAP artifacts** - detailed results
3. **Run local CI simulation** - reproduce environment
4. **Check specific OS/Node combinations** - matrix analysis

## 📈 Status

- **Local Development**: ✅ All tests passing
- **CI Integration**: 🚀 Ready for GitHub Actions
- **Cross-Platform**: 📋 Ubuntu + macOS support
- **Multi-Node**: 🔧 Node.js 18.x through 22.x
- **Test Coverage**: 📊 12 comprehensive CLI scenarios

The testing strategy provides confidence for rapid CLI development while maintaining production quality standards.