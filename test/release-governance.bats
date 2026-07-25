#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

@test "changelog records release governance hardening" {
  run grep -F "**Release governance hardening**" CHANGELOG.md
  assert_success
}

@test "v0.1.0 TypeScript decode migration examples use bytes boundary" {
  run grep -F "decodeMakeWidget(reader)" docs/releases/v0.1.0.md
  assert_failure

  run grep -F "decodeMakeWidget(bytes)" docs/releases/v0.1.0.md
  assert_success
}

@test "method release runbook syncs protected main before tag guard" {
  run grep -F "git push origin main vX.Y.Z" docs/method/release-runbook.md
  assert_failure

  run grep -F 'Sync local `main` to `origin/main` after the release commit has landed' docs/method/release-runbook.md
  assert_success
}

@test "crates.io release procedure tags only synced origin main" {
  run grep -F 'Push `main`.' docs/CRATES_IO_RELEASE.md
  assert_failure

  run grep -F "Verify the release commit is already reachable from origin/main before" docs/CRATES_IO_RELEASE.md
  assert_success
}

@test "crates.io pre-tag gauntlet includes Rust dependency audit" {
  run grep -F "cargo audit" docs/CRATES_IO_RELEASE.md
  assert_success
}

@test "release checklist includes docs topics accuracy and coverage gate" {
  run grep -F 'docs/topics/' docs/governance/RELEASE_CHECKLIST.md
  assert_success

  run grep -F "90% accuracy" docs/governance/RELEASE_CHECKLIST.md
  assert_success

  run grep -F "90% coverage" docs/governance/RELEASE_CHECKLIST.md
  assert_success
}

@test "release profile names every published Wesley crate" {
  run test -f .continuum/release.yml
  assert_success

  for crate in wesley-core wesley-emit-codec wesley-emit-rust wesley-emit-typescript wesley-cli; do
    run grep -Eq "^[[:space:]]*-[[:space:]]*$crate$" .continuum/release.yml
    assert_success

    run grep -F "name: $crate" .continuum/release.yml
    assert_success
  done
}

@test "release profile names unpublished Holmes as a required version source" {
  run grep -F "path: crates/wesley-holmes/Cargo.toml" .continuum/release.yml
  assert_success

  run grep -F "name: wesley-holmes" .continuum/release.yml
  assert_success

  run bash -lc "awk '
    /path: crates\\/wesley-holmes\\/Cargo.toml/ { in_block=1 }
    in_block && /^[[:space:]]*required:[[:space:]]*true$/ { required=1 }
    in_block && /^[[:space:]]*published:[[:space:]]*false$/ { published=1 }
    in_block && /^[[:space:]]*-[[:space:]]*path:/ && \$0 !~ /wesley-holmes/ { in_block=0 }
    END { exit !(required && published) }
  ' .continuum/release.yml"
  assert_success
}

@test "release policy names unpublished Holmes as a version source" {
  run grep -F "crates/wesley-holmes/Cargo.toml" docs/governance/RELEASE_POLICY.md
  assert_success
}

@test "release profile assertions are YAML spacing tolerant" {
  run bash -lc "awk '/@test \"release profile names every published Wesley crate\"/{in_test=1} in_test && /^@test / && !/release profile names every published Wesley crate/{exit} in_test {print}' test/release-governance.bats | grep -F 'grep -Eq'"
  assert_success

  run bash -lc "awk '/@test \"release profile names unpublished Holmes as a required version source\"/{in_test=1} in_test && /^@test / && !/release profile names unpublished Holmes as a required version source/{exit} in_test {print}' test/release-governance.bats | grep -F 'required=1'"
  assert_success
}

@test "release profile declares Rust advisory audit validation" {
  run grep -F "rust_advisory_audit: cargo audit" .continuum/release.yml
  assert_success
}

@test "release profile includes public site and guide signposts" {
  run grep -Eq "^[[:space:]]*-[[:space:]]*docs/site/$" .continuum/release.yml
  assert_success

  run grep -Eq "^[[:space:]]*-[[:space:]]*docs/GUIDE.md$" .continuum/release.yml
  assert_success
}

@test "release profile includes root release process signpost" {
  run grep -Eq "^[[:space:]]*-[[:space:]]*RELEASE.md$" .continuum/release.yml
  assert_success

  run grep -F "[Release process](./RELEASE.md)" README.md
  assert_success
}

@test "root release process documents Wesley-specific lifecycle deviations" {
  run grep -F "Autotag is not enabled" RELEASE.md
  assert_success

  run grep -F "Plain \`vX.Y.Z\` milestones are the only release scheduling axis" RELEASE.md
  assert_success

  run grep -F "crates.io is the public package registry" RELEASE.md
  assert_success
}

@test "release governance YAML is structurally valid" {
  run cargo test --quiet --locked -p xtask tests::release_governance_yaml_is_structurally_valid -- --exact
  assert_success
  assert_output --partial "running 1 test"
  assert_output --partial "1 passed; 0 failed"
}

@test "release profile uses plain version milestones as the sole schedule" {
  run grep -F "release_milestone_format: 'v{version}'" .continuum/release.yml
  assert_success

  run grep -F "post_merge_pre_tag_tracker_clear: cargo xtask release-prep-guard --version {version}" .continuum/release.yml
  assert_success

  run grep -Eq "^[[:space:]]*prep:" .continuum/release.yml
  assert_failure

  run rg -n "release_lane_label_format|goalpost_milestone_format" .continuum/release.yml
  assert_failure

  run rg -n "Goalpost:|Release:" .continuum/release.yml
  assert_failure

  run grep -F "scheduled_state: 'exactly one milestone named v{version}; no extra milestone or triage:*, retired lane:*, or concrete version label'" .continuum/release.yml
  assert_success

  run grep -F "unscheduled_state: 'exactly one triage:* label; no milestone, retired lane:*, or concrete version label'" .continuum/release.yml
  assert_success
}

@test "scheduling predicates reject every retired scheduling state" {
  run grep -F "scheduled_state: 'exactly one milestone named v{version}; no extra milestone or triage:*, retired lane:*, or concrete version label'" .continuum/release.yml
  assert_success

  run grep -F "unscheduled_state: 'exactly one triage:* label; no milestone, retired lane:*, or concrete version label'" .continuum/release.yml
  assert_success

  run grep -F 'Linked issue has exactly one milestone, named plain `vX.Y.Z`, and no `triage:*`, retired `lane:*`, or concrete-version scheduling label.' .github/pull_request_template.md
  assert_success

  for path in AGENTS.md docs/topics/contributing/first-pr.md; do
    run bash -lc "grep -F 'retired \`lane:*\`' '$path' | wc -l"
    assert_success
    [ "$output" -ge 2 ]
  done
}

@test "issue and pull request templates preserve the scheduling invariant" {
  run grep -F 'Linked issue has exactly one milestone, named plain `vX.Y.Z`, and no `triage:*`, retired `lane:*`, or concrete-version scheduling label.' .github/pull_request_template.md
  assert_success

  run grep -F 'Linked issue is either unscheduled' .github/pull_request_template.md
  assert_failure
}

@test "scheduling doctrine scopes invariants to current open work" {
  local doctrine_paths=(
    docs/METHOD.md
    CONTRIBUTING.md
    docs/BEARING.md
    docs/governance/RELEASE_POLICY.md
    docs/method/release-runbook.md
    docs/governance/RELEASE_CHECKLIST.md
    docs/method/release.md
    docs/topics/releases.md
  )

  for path in "${doctrine_paths[@]}"; do
    run rg -U "These scheduling invariants govern current open work only\\. Closed issues,[[:space:]]+closed[[:space:]]+milestones, and historical labels remain preserved evidence\\." "$path"
    assert_success
  done
}

@test "triage doctrine defines mutually exclusive scheduled states" {
  run grep -F 'Unscheduled: exactly one `triage:*` label and no milestone.' docs/topics/contributing/triage.md
  assert_success

  run grep -F 'Scheduled: exactly one plain `vX.Y.Z` milestone and no `triage:*` label.' docs/topics/contributing/triage.md
  assert_success
}

@test "triage doctrine requires an atomic live tracker cutover" {
  run rg -U "Merge the approved governance pull request\\s+before any live tracker mutation\\." docs/topics/contributing/triage.md
  assert_success

  run grep -F "immediately before it is" docs/topics/contributing/triage.md
  assert_failure

  run grep -F "Freeze issue scheduling, milestone edits, release-gate closure, and tag" docs/topics/contributing/triage.md
  assert_success

  run grep -F "gh api --hostname github.com --paginate 'repos/flyingrobots/wesley/issues?state=open&per_page=100'" docs/topics/contributing/triage.md
  assert_success

  run grep -F "milestones?state=all&per_page=100" docs/topics/contributing/triage.md
  assert_success

  run grep -F -- "--jq '.[] | {number, title, state, open_issues, closed_issues}'" docs/topics/contributing/triage.md
  assert_success

  run grep -F "For an active \`Release: vX.Y.Z\` milestone with zero closed issue" docs/topics/contributing/triage.md
  assert_success

  run grep -F "If it has any closed association or the exact milestone already" docs/topics/contributing/triage.md
  assert_success

  run grep -F "preserve the legacy milestone title, create or reuse the exact" docs/topics/contributing/triage.md
  assert_success

  run grep -F "Move every open scheduled issue—including each release gate—from active" docs/topics/contributing/triage.md
  assert_success

  run grep -F "Remove \`triage:*\` and concrete-version labels from scheduled issues" docs/topics/contributing/triage.md
  assert_success

  run grep -F "Do not rename, delete, reopen, or rewrite closed" docs/topics/contributing/triage.md
  assert_success

  run rg -U 'Never\s+move the closed issues that remain historical evidence' docs/topics/contributing/triage.md
  assert_success

  run grep -F "leave the merged enforcement intact" docs/topics/contributing/triage.md
  assert_success
}

@test "release doctrine lists profile user-doc signposts" {
  run grep -F '`docs/site/`' docs/method/release.md
  assert_success

  run grep -F '`docs/reference/`' docs/method/release.md
  assert_success
}

@test "release doctrine requires thesis scope and retrospective evidence" {
  run grep -F "No planned release without a thesis." docs/method/release.md
  assert_success

  run grep -F "must-ship, may-slip, and explicitly-not-included" docs/method/release.md
  assert_success

  run grep -F "retrospective and fallout issues" docs/method/release.md
  assert_success
}

@test "release runbook requires patch-forward failure handling" {
  run grep -F "The public tag is immutable. Do not move it." docs/method/release-runbook.md
  assert_success

  run grep -F "Cut a new patch release from \`main\`" docs/method/release-runbook.md
  assert_success
}

@test "release runbook does not rerun immutable tag for workflow source fixes" {
  run grep -F "workflow source checked into the tag is wrong" docs/method/release-runbook.md
  assert_success

  run grep -F "Same-tag reruns are allowed only when the tagged source is correct" docs/method/release-runbook.md
  assert_success

  run grep -F "Release/API delivery" docs/method/release-runbook.md
  assert_success
}

@test "release gate issue template uses the version milestone directly" {
  run grep -F "# Release gate: vX.Y.Z" docs/method/release.md
  assert_success

  run grep -F "Keep the open gate issue title/body free of the target tag/version literal" docs/method/release.md
  assert_failure

  run grep -F "Close the gate issue before creating the signed local tag" docs/method/release.md
  assert_success
}

@test "release prep PR tracks the gate without auto-closing it" {
  run grep -F 'Tracks #<release-gate>' docs/method/release.md
  assert_success

  run grep -F 'The release-prep PR must not use' docs/method/release.md
  assert_success

  run grep -F 'The final `release-prep-guard` runs only after this PR lands' docs/method/release.md
  assert_success
}

@test "release runbook orders pre-tag and tag-specific guards" {
  run awk '
    /Run a fresh `cargo xtask preflight`/{preflight=NR}
    /Complete the human checklist and close the release-gate issue/{gate=NR}
    /Run `cargo xtask release-prep-guard/{prep=NR}
    /Fetch `origin` again/{refresh=NR}
    /`HEAD` still equals both the recorded/{unchanged=NR}
    /Create the release tag locally/{tag=NR}
    /Run `cargo xtask release-guard/{tagged=NR}
    /Push the exact release tag only/{push=NR}
    /Monitor the tag-triggered workflow/{workflow=NR}
    END { exit !(preflight < gate && gate < prep && prep < refresh && refresh < unchanged && unchanged < tag && tag < tagged && tagged < push && push < workflow) }
  ' docs/method/release-runbook.md
  assert_success

  run bash -lc "grep -F 'cargo xtask release-prep-guard --version X.Y.Z' docs/method/release-runbook.md | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run grep -F "run while the release gate remains open" docs/method/release-runbook.md
  assert_success

  run grep -F "git ls-remote --exit-code --tags origin refs/tags/vX.Y.Z" docs/method/release-runbook.md
  assert_success

  run grep -F "If the tag is present remotely, do not delete the local tag and do not reopen" docs/method/release-runbook.md
  assert_success

  run grep -F "If remote state is indeterminate, change neither the tag nor the gate" docs/method/release-runbook.md
  assert_success

  run grep -F "Only when the tag is proven absent may local recovery continue" docs/method/release-runbook.md
  assert_success

  run grep -F "delete only that unpublished tag" docs/method/release-runbook.md
  assert_success

  run grep -F "Reopen the release gate" docs/method/release-runbook.md
  assert_success

  run grep -F "must never be deleted, moved, or recreated" docs/method/release-runbook.md
  assert_success

  run grep -F "Do not create or finalize a competing release manually" docs/method/release-runbook.md
  assert_success

  run grep -F "Manual recovery must never create," docs/method/release-runbook.md
  assert_success

  run grep -F "rerun the same tag" docs/method/release-runbook.md
  assert_success

  run rg -n "Create or verify the GitHub Release|Create the GitHub Release|Recreate or update the GitHub Release" docs/method/release-runbook.md docs/CRATES_IO_RELEASE.md
  assert_failure

  run grep -F "Verify that the tag workflow creates its draft GitHub Release" docs/CRATES_IO_RELEASE.md
  assert_success
}

@test "root release path tags only the validated synced main commit" {
  run awk '
    /git merge --ff-only origin\/main/{sync=NR}
    /validated_head=.*git rev-parse HEAD/{record=NR}
    /cargo xtask preflight/{preflight=NR}
    /# Only now: complete human sign-off and close the release gate/{gate=NR}
    /cargo xtask release-prep-guard/{clear=NR}
    /git fetch origin --tags --prune/{refresh=NR}
    /test .*git rev-parse HEAD.*validated_head/{unchanged=NR}
    /test .*git rev-parse HEAD.*git rev-parse origin\/main/{synced=NR}
    /git tag -s vX.Y.Z/{tag=NR}
    END { exit !(sync < record && record < preflight && preflight < gate && gate < clear && clear < refresh && refresh < unchanged && unchanged < synced && synced < tag) }
  ' RELEASE.md
  assert_success

  run grep -F "# Only now: complete human sign-off and close the release gate." RELEASE.md
  assert_success
}

@test "release lifecycle uses retrospected state name" {
  run rg -n "retrospectived" docs/method/release.md docs/topics/releases.md
  assert_failure

  run rg -n "retrospected" docs/method/release.md docs/topics/releases.md
  assert_success
}

@test "entrypoints command map lists Rust LE binary emitter" {
  run grep -F "wesley emit le-binary-rust --schema <path> --out <path>" docs/ENTRYPOINTS.md
  assert_success
}

@test "topics index uses exact docs authority paths" {
  run grep -nE '`docs/[^`]*\*[^`]*`' docs/topics/README.md
  assert_failure
}

@test "directives topic frames core directives as compatibility structure" {
  run grep -F 'Use canonical `@wes_*` directive names for new generic Wesley examples.' docs/topics/directives.md
  assert_failure

  run grep -F "Existing core directive names are compatibility structure, not domain ownership." docs/topics/directives.md
  assert_success
}
