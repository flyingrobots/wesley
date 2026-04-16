#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-blade-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_min_schema() {
  cat > schema.graphql << 'EOF'
type User @wes_table {
  id: ID! @wes_pk
}
EOF
}

write_holmes_policy() {
  local gate_mode="${1:-audit}"
  cat > wesley.holmes-policy.json << JSON
{
  "version": 2,
  "counterfactual": {
    "enabled": true,
    "provider": "git-warp",
    "baseRef": "main",
    "headRef": "HEAD",
    "braidRefs": [],
    "scope": null,
    "gateMode": "$gate_mode",
    "penalties": {
      "divergence": 10,
      "destructiveTransfer": 30,
      "providerUnavailable": 50
    }
  }
}

git_without_hook_env() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_PREFIX -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_COMMON_DIR git "$@"
}
JSON
}

@test "blade help works" {
  run node "$CLI_PATH" blade --help
  assert_success
  assert_output --partial "One-shot: transform"
  assert_output --partial "--transmutation"
  assert_output --partial "--run-id"
  assert_output --partial "--resume"
}

@test "blade dry-run completes and writes cert in .wesley-cache" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run
  assert_success
  assert_file_exist .wesley-cache/SHIPME.md
}

@test "blade dry-run carries run metadata into SHIPME" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-123
  assert_success
  assert_file_exist .wesley-cache/SHIPME.md
  local json
  json=$(sed -n '/```json/,/```/p' .wesley-cache/SHIPME.md | sed '1d;$d')
  [[ -n "$json" ]] || fail "No embedded SHIPME JSON block found"
  echo "$json" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$json" | jq -e '.runId == "run-blade-123"' >/dev/null
  echo "$json" | jq -e '.realm == null' >/dev/null
}

@test "blade counterfactual audit mode writes summary and keeps going" {
  create_min_schema
  write_holmes_policy audit

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --counterfactual main --json --quiet
  assert_success
  assert_file_exist .wesley-cache/SHIPME.md
  assert_file_exist .wesley-cache/counterfactual/current.json
  echo "$output" | jq -e '.result.stages.counterfactual.gate == "audit"' >/dev/null
  echo "$output" | jq -e '.result.stages.counterfactual.wouldFail == true' >/dev/null
  local json
  json=$(sed -n '/```json/,/```/p' .wesley-cache/SHIPME.md | sed '1d;$d')
  echo "$json" | jq -e '.counterfactual.gate == "audit"' >/dev/null
  echo "$json" | jq -e '.counterfactual.wouldFail == true' >/dev/null
}

@test "blade ignores inherited git hook env when checking temp worktree cleanliness" {
  create_min_schema

  local dirty_repo="$TEST_TEMP_DIR/outer-repo"
  mkdir -p "$dirty_repo"
  git_without_hook_env -C "$dirty_repo" init -q
  git_without_hook_env -C "$dirty_repo" config user.email "test@example.com"
  git_without_hook_env -C "$dirty_repo" config user.name "Test User"
  echo "tracked" > "$dirty_repo/tracked.txt"
  git_without_hook_env -C "$dirty_repo" add tracked.txt
  git_without_hook_env -C "$dirty_repo" commit -qm "init"
  echo "dirty" >> "$dirty_repo/tracked.txt"

  local git_dir
  git_dir="$(git_without_hook_env -C "$dirty_repo" rev-parse --absolute-git-dir)"

  run env \
    GIT_DIR="$git_dir" \
    GIT_WORK_TREE="$dirty_repo" \
    GIT_PREFIX="" \
    node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --json --quiet
  assert_success
}

@test "blade counterfactual ignores inherited git hook env" {
  create_min_schema
  write_holmes_policy audit

  local dirty_repo="$TEST_TEMP_DIR/outer-counterfactual-repo"
  mkdir -p "$dirty_repo"
  git_without_hook_env -C "$dirty_repo" init -q
  git_without_hook_env -C "$dirty_repo" config user.email "test@example.com"
  git_without_hook_env -C "$dirty_repo" config user.name "Test User"
  echo "tracked" > "$dirty_repo/tracked.txt"
  git_without_hook_env -C "$dirty_repo" add tracked.txt
  git_without_hook_env -C "$dirty_repo" commit -qm "init"
  echo "dirty" >> "$dirty_repo/tracked.txt"

  local git_dir
  git_dir="$(git_without_hook_env -C "$dirty_repo" rev-parse --absolute-git-dir)"

  run env \
    GIT_DIR="$git_dir" \
    GIT_WORK_TREE="$dirty_repo" \
    GIT_PREFIX="" \
    node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --counterfactual main --json --quiet
  assert_success
  echo "$output" | jq -e '.result.stages.counterfactual.gate == "audit"' >/dev/null
  echo "$output" | jq -e '.result.stages.counterfactual.wouldFail == true' >/dev/null
}

@test "blade counterfactual hard gate fails through judgment gate only" {
  create_min_schema
  write_holmes_policy hard

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --counterfactual main --json --quiet
  assert_failure 5
  echo "$output" | jq -e '.code == "COUNTERFACTUAL_GATE_FAILED"' >/dev/null
}

@test "blade --resume requires --run-id" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --resume --json --quiet
  assert_failure 2
  echo "$output" | jq -e '.code == "EUSAGE"' >/dev/null
}

@test "blade --resume completes a partial pipeline and reports stage state" {
  create_min_schema

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-resume-123 --json --quiet
  assert_failure 6

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-resume-123 --resume --json --quiet
  assert_success
  echo "$output" | jq -e '.result.runId == "run-blade-resume-123"' >/dev/null
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.shortCircuited == false' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.plan.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.rehearse.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.certCreate.status == "completed"' >/dev/null
}

@test "blade --resume short-circuits completed stage runs" {
  create_min_schema

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-shortcircuit-123 --json --quiet
  assert_success

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-shortcircuit-123 --resume --json --quiet
  assert_success
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.plan.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.rehearse.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.certCreate.shortCircuited == true' >/dev/null
}
