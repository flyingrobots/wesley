# Bats test helpers for Wesley CLI

# Custom assertions for file operations
assert_file_exists() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "Expected file does not exist: $file"
        return 1
    fi
}

assert_file_contains() {
    local file="$1" 
    local pattern="$2"
    
    if [[ ! -f "$file" ]]; then
        echo "File does not exist: $file"
        return 1
    fi
    
    if ! grep -q "$pattern" "$file"; then
        echo "File $file does not contain: $pattern"
        echo "File contents:"
        cat "$file"
        return 1
    fi
}

assert_success() {
    if [[ "$status" -ne 0 ]]; then
        echo "Command failed with exit code $status"
        echo "Output: $output"
        return 1
    fi
}

assert_failure() {
    local expected_code="${1:-1}"
    if [[ "$status" -eq 0 ]]; then
        echo "Command succeeded but was expected to fail"
        echo "Output: $output" 
        return 1
    fi
    if [[ "$expected_code" != "1" && "$status" -ne "$expected_code" ]]; then
        echo "Command failed with exit code $status, expected $expected_code"
        echo "Output: $output"
        return 1
    fi
}

assert_output() {
    local flag="$1"
    local expected="$2"
    
    case "$flag" in
        --partial)
            if [[ "$output" != *"$expected"* ]]; then
                echo "Output does not contain: $expected"
                echo "Actual output: $output"
                return 1
            fi
            ;;
        *)
            expected="$flag"
            if [[ "$output" != "$expected" ]]; then
                echo "Output mismatch"
                echo "Expected: $expected"
                echo "Actual: $output"
                return 1
            fi
            ;;
    esac
}