#!/usr/bin/env bash

# Wesley CLI - Bats Test Runner
# Runs all .bats test files with proper output formatting

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Wesley CLI - Bats Test Suite${NC}"
echo "============================="

# Find all .bats files (excluding plugin tests)
BATS_FILES=()
while IFS=  read -r -d $'\0'; do
    BATS_FILES+=("$REPLY")
done < <(find test -name "*.bats" -not -path "*/bats-plugins/*" -print0)

if [ ${#BATS_FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No .bats files found in test/ directory${NC}"
    exit 0
fi

echo "Found ${#BATS_FILES[@]} test file(s):"
for file in "${BATS_FILES[@]}"; do
    echo "  - $file"
done
echo ""

# Run tests with options
BATS_OPTS=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            BATS_OPTS="$BATS_OPTS --verbose-run"
            shift
            ;;
        --tap)
            BATS_OPTS="$BATS_OPTS --tap"
            shift
            ;;
        --parallel|-j)
            if [[ -n "${2:-}" && "$2" =~ ^[0-9]+$ ]]; then
                BATS_OPTS="$BATS_OPTS --jobs $2"
                shift 2
            else
                BATS_OPTS="$BATS_OPTS --jobs 4"  # Default to 4 parallel jobs
                shift
            fi
            ;;
        --timing|-t)
            BATS_OPTS="$BATS_OPTS --show-output-of-passing-tests"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Verbose output"
            echo "  --tap           TAP output format"
            echo "  -j, --parallel   Run tests in parallel (default: 4 jobs)"
            echo "  -t, --timing     Show timing information"
            echo "  -h, --help       Show this help"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Run the tests
echo -e "${BLUE}Running tests...${NC}"
echo ""

# If bats is not installed (e.g., in generic CI job), skip gracefully
if ! command -v bats >/dev/null 2>&1; then
    echo -e "${YELLOW}bats not found in PATH; skipping CLI bats tests${NC}"
    echo -e "${YELLOW}Hint:${NC} CLI bats tests run in the dedicated 'Wesley CLI Tests' workflow."
    exit 0
fi

if bats $BATS_OPTS "${BATS_FILES[@]}"; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
