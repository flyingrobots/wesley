# Wesley CLI - Continuous Integration

## GitHub Actions Workflows

Wesley CLI uses two GitHub Actions workflows for comprehensive testing:

### 🚀 Quick Feedback: `cli-quick.yml`

**Triggers**: Every push/PR to `packages/wesley-cli/`
**Runtime**: ~2-3 minutes
**Environment**: Ubuntu Latest + Node.js 20 LTS

**Purpose**: Fast feedback loop for CLI development
- Installs Bats testing framework
- Runs all 12 end-to-end CLI tests
- Performs smoke tests of core functionality
- Perfect for rapid iteration during development

```bash
# What it tests:
✅ Version and help flags
✅ Schema file handling and error cases  
✅ stdin support (--schema - and --stdin)
✅ JSON output formatting
✅ Quiet mode behavior
✅ Exit code validation
✅ Stream separation (logs→stderr, results→stdout)
```

### 🏗️ Full Matrix: `cli-tests.yml`

**Triggers**: Push/PR to CLI + related packages
**Runtime**: ~8-12 minutes  
**Environment**: Cross-platform matrix

**Matrix Coverage**:
- **OS**: Ubuntu Latest, macOS Latest
- **Node.js**: 18.x, 20.x, 22.x
- **Total**: 6 combinations

**Features**:
- TAP output format for CI integration
- Test artifacts uploaded for debugging
- Verbose output on failures
- Manual CLI verification steps
- Comprehensive environment coverage

## Test Framework: Bats

Wesley CLI uses **Bats (Bash Automated Testing System)** for end-to-end testing. See the [CLI tests guide](../../docs/guides/cli-tests.md).

**Why Bats?**
- ✅ **Authentic testing** - Real subprocess execution, actual exit codes
- ✅ **Industry standard** - Used by Docker, Kubernetes, GitHub CLI  
- ✅ **Shell-native** - Perfect match for CLI tools
- ✅ **Minimal dependencies** - Pure bash framework
- ✅ **CI-friendly** - TAP output, proper exit codes

## Local Development

```bash
# Run the same tests locally
cd packages/wesley-cli

# Quick test run
pnpm test

# Verbose output  
pnpm test:verbose

# TAP format (same as CI)
pnpm test:tap
```

## CI Requirements

### Environment Setup
1. **Bats installation** - Automated via GitHub releases
2. **Git repository** - Tests expect repo for SHA calculation  
3. **pnpm workspace** - Dependency management
4. **Submodules** - Bats plugins loaded as git submodules

### Test Coverage
- **12 test cases** covering core CLI functionality
- **Real subprocess execution** - No mocks or stubs
- **Cross-platform validation** - Ubuntu + macOS
- **Multi-Node version** - 18.x through 22.x support
- **Error scenarios** - Exit codes, malformed input, missing files

## Debugging Failed CI Runs

### 1. Check Quick Workflow First
The `cli-quick.yml` workflow runs faster and will catch most issues:
- Look for specific test failures in the Bats output
- Check the smoke test section for basic CLI functionality

### 2. Examine Full Matrix Results  
If quick tests pass but matrix fails:
- Check specific OS/Node combinations that failed
- Download TAP artifacts for detailed analysis
- Review verbose output sections

### 3. Reproduce Locally
```bash
# Match the failing environment
nvm use 18  # or whichever Node version failed

# Run tests with same options as CI
cd packages/wesley-cli
./test/run-bats.sh --verbose
```

### 4. Common Issues
- **Git repository missing** - Tests need git init for SHA calculation
- **Node version incompatibility** - Check package.json engines field
- **Bats plugin loading** - Ensure submodules are properly initialized
- **PATH issues** - Bats must be available in CI environment

## Status Badges

Add these to README files:

```markdown
![CLI Tests](https://github.com/your-org/wesley/actions/workflows/cli-tests.yml/badge.svg)
![CLI Quick Check](https://github.com/your-org/wesley/actions/workflows/cli-quick.yml/badge.svg)
```

## Future Enhancements

When Wesley CLI adds complex features, consider:
- **Windows testing** - Add `windows-latest` to matrix if Windows support needed
- **Performance benchmarks** - Time critical operations
- **Integration tests** - Test against real databases
- **Snapshot testing** - For stable output formats

For now, pure Bats end-to-end testing provides optimal coverage for Wesley CLI's current scope.
