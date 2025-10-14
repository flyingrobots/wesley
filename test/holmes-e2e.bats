#!/usr/bin/env bats

load 'helpers'

setup() {
    export REPO_ROOT="$BATS_TEST_DIRNAME/.."
    export CLI_PATH="$REPO_ROOT/packages/wesley-host-node/bin/wesley.mjs"
    export HOLMES_CLI="$REPO_ROOT/packages/wesley-holmes/src/cli.mjs"
    export TEMP_DIR="$(mktemp -d)"
    cp "$REPO_ROOT/example/schema.graphql" "$TEMP_DIR/schema.graphql"
}

teardown() {
    rm -rf "$TEMP_DIR"
}

@test "holmes investigation/verification/prediction produce artifacts" {
    pushd "$TEMP_DIR" >/dev/null

    run node "$CLI_PATH" generate --schema schema.graphql --emit-bundle --quiet
    assert_success

    run bash -c "node '$HOLMES_CLI' investigate --json holmes.json > holmes.md"
    assert_success
    run bash -c "node '$HOLMES_CLI' verify --json watson.json > watson.md"
    assert_success
    run bash -c "node '$HOLMES_CLI' predict --json moriarty.json > moriarty.md"
    assert_success

    assert_file_exists holmes.json
    assert_file_exists holmes.md
    assert_file_exists watson.json
    assert_file_exists watson.md
    assert_file_exists moriarty.json
    assert_file_exists moriarty.md

    run node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('holmes.json','utf8')); if(!data.metadata || !data.metadata.verificationStatus) throw new Error('missing metadata'); if(typeof data.metadata.verificationCount !== 'number') throw new Error('verificationCount missing'); if(!data.metadata.bundleVersion) throw new Error('missing bundleVersion'); if(!data.scores) throw new Error('missing scores'); ['scs','tci','mri'].forEach(k=>{ if(typeof data.scores[k] !== 'number') throw new Error('missing scores.'+k); }); if(!data.breakdown || !data.breakdown.scs) throw new Error('missing breakdown'); if(!Array.isArray(data.evidence)) throw new Error('evidence array missing'); if(!data.verdict || !data.verdict.code) throw new Error('missing verdict');"
    assert_success

    run node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('watson.json','utf8')); if(!data.citations || typeof data.citations.total !== 'number') throw new Error('missing citations'); if(!data.math || typeof data.math.claimedScs !== 'number') throw new Error('missing math'); if(!data.opinion || !data.opinion.verdict) throw new Error('missing opinion');"
    assert_success

    run node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('moriarty.json','utf8')); if(!data.status) throw new Error('missing status'); if(!Array.isArray(data.history)) throw new Error('history must be array');"
    assert_success

    run test -s holmes.md
    assert_success
    run test -s watson.md
    assert_success
    run test -s moriarty.md
    assert_success

    popd >/dev/null
}
