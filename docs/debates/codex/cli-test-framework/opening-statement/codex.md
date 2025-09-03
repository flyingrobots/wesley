# Opening Statement: Lightweight Framework Adoption with Strategic Constraints

## My Position: Adopt Bats-core, Retire Bespoke Scripts

My genuine take: adopt a lightweight framework, specifically Bats-core, for your black‑box CLI tests and retire the bespoke bash scripts. It best fits your constraints while improving maintainability and signal.

### Why Bats-core Fits

- **Minimal deps**: Bash-only, no Python or heavy runtime; aligns with "tight stack"
- **Same testing style**: Still copies fixtures, runs the real CLI, and asserts on outputs/exit codes
- **Cleaner tests**: Setup/teardown, helpers (bats-assert, bats-file), and readable failures via TAP
- **CI-friendly**: Good reporting, selective/parallel runs (`-j`), and granular test organization
- **Low migration risk**: You can wrap your existing flow with cleaner assertions instead of rewriting logic

### What You Give Up vs Node Test Runners

- **Coverage/snapshots**: Node's Vitest/Jest make coverage and snapshot diffing trivial. You can still do `c8` + `diff -u` from Bats, but it's less ergonomic
- **Windows-native**: Bats relies on Bash; if Windows without WSL is critical, a Node runner wins
- **Deep unit tests**: If you later want unit/component tests of internal modules, add Vitest (lighter than Jest) just for those, keeping Bats for end-to-end

### Recommended Approach

1. **Start with Bats-core** for integration/e2e (your primary value today)
2. **Vendor `bats-core`** or install via package manager; add `bats-assert` and `bats-file`
3. **Create a small test harness**: temp dir helper, fixture copier, CLI runner with normalized env, golden diff utility
4. **Port a few high-value tests first**; stabilize; then finish the migration
5. **If/when you need coverage/snapshots** for internals, add Vitest for unit tests only

### Quick Example (Bats)

```bash
# test/my-cli.bats
setup() {
    # create temp dir; copy fixture project
}

@test "generates correct output" {
    run node ./bin/wesley generate --schema fixture.graphql
    assert_success
    assert_file_exist "out/schema.sql"
    diff -u fixtures/expected/schema.sql "$TMP/out/schema.sql"
}
```

## Bottom Line

For a Node CLI whose tests are primarily black‑box invocations, Bats-core gives you structure and reliability with near‑zero overhead. Keep integration tests in Bats; add a minimal Node runner later only if you need internal coverage/snapshots or Windows-native support.

---

*Prepared for debate rounds on implementation details and edge cases...*