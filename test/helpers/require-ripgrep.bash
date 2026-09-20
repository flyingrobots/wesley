# Suites that assert absence with `run rg ...; assert_failure` must not run
# without ripgrep: a missing command exits 127, which also satisfies
# assert_failure, so the assertion would pass having searched nothing.
require_ripgrep() {
  if ! command -v rg >/dev/null 2>&1; then
    echo "ripgrep (rg) is required by this suite and is not on PATH." >&2
    return 1
  fi
}
