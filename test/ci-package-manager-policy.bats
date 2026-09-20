#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

setup() {
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  TMP_REPO="$(mktemp -d -t wesley-pm-policy-XXXXXX)"
  git -C "$TMP_REPO" init -q
}

teardown() {
  rm -rf "$TMP_REPO"
}

write_package_json() {
  local package_manager="$1"
  cat > "$TMP_REPO/package.json" <<JSON
{"name":"fixture","private":true,"packageManager":"$package_manager"}
JSON
}

stage_policy_repo() {
  git -C "$TMP_REPO" add .
}

current_pnpm() {
  pnpm --version
}

@test "package manager policy accepts packageManager pnpm and root lockfile" {
  write_package_json "pnpm@$(current_pnpm)"
  touch "$TMP_REPO/pnpm-lock.yaml"
  stage_policy_repo

  run node "$REPO_ROOT/scripts/check-package-manager-policy.mjs" "$TMP_REPO"

  assert_success
  assert_output --partial "package-manager policy: OK"
}

@test "package manager policy rejects non-pnpm packageManager" {
  write_package_json "npm@10.0.0"
  touch "$TMP_REPO/pnpm-lock.yaml"
  stage_policy_repo

  run node "$REPO_ROOT/scripts/check-package-manager-policy.mjs" "$TMP_REPO"

  assert_failure
  assert_output --partial "package.json packageManager must be pnpm@<version>"
}

@test "package manager policy rejects wrong pnpm version with corepack hint" {
  write_package_json "pnpm@0.0.0"
  touch "$TMP_REPO/pnpm-lock.yaml"
  stage_policy_repo

  run node "$REPO_ROOT/scripts/check-package-manager-policy.mjs" "$TMP_REPO"

  assert_failure
  assert_output --partial "pnpm version mismatch"
  assert_output --partial "corepack prepare pnpm@0.0.0 --activate"
}

@test "package manager policy rejects forbidden and nested lockfiles" {
  write_package_json "pnpm@$(current_pnpm)"
  mkdir -p "$TMP_REPO/packages/example"
  touch "$TMP_REPO/pnpm-lock.yaml"
  touch "$TMP_REPO/package-lock.json"
  touch "$TMP_REPO/packages/example/pnpm-lock.yaml"
  touch "$TMP_REPO/packages/example/yarn.lock"
  stage_policy_repo

  run node "$REPO_ROOT/scripts/check-package-manager-policy.mjs" "$TMP_REPO"

  assert_failure
  assert_output --partial "forbidden lockfile is tracked: package-lock.json"
  assert_output --partial "nested pnpm lockfile is not allowed: packages/example/pnpm-lock.yaml"
  assert_output --partial "forbidden lockfile is tracked: packages/example/yarn.lock"
}
