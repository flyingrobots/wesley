use std::fs;
use std::path::{Path, PathBuf};

use yaml_rust2::{Yaml, YamlLoader};

use wesley_core::{
    build_contract_bundle_manifest_v1, compute_law_hash_set_v1, compute_law_hash_v1,
    compute_registry_hash, diff_law_ir_v1, list_schema_operations_sdl, load_weslaw_yaml,
    lower_schema_sdl, lower_wes_channel_directives_to_law_ir_v1, to_canonical_law_ir_json,
    to_semantic_law_ir_json, validate_law_ir_v1_bindings, FootprintCardinalityV1,
    LawDiffEventKindV1, LawEntryBodyV1, LawKindV1, LawStatusV1, PredicateV1,
    ScalarForbiddenInterpretationV1, ScalarRepresentationV1, WeslawDiagnosticCode,
    WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION, WESLEY_LAW_DIFF_API_VERSION,
    WESLEY_LAW_IR_API_VERSION, WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
};

fn repo_path(path: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

fn read_fixture(path: &str) -> String {
    fs::read_to_string(repo_path(path)).expect("fixture should be readable")
}

fn contract_bundle_shape() -> (
    wesley_core::WesleyIR,
    Vec<wesley_core::SchemaOperation>,
    String,
) {
    let sdl = read_fixture("test/fixtures/weslaw/contract-bundle-shape.graphql");
    let ir = lower_schema_sdl(&sdl).expect("fixture schema should lower");
    let operations = list_schema_operations_sdl(&sdl).expect("fixture operations should list");
    let schema_hash = format!(
        "sha256:{}",
        compute_registry_hash(&ir).expect("schema hash should compute")
    );

    (ir, operations, schema_hash)
}

fn bind_law_source(
    source: &str,
) -> Result<wesley_core::LawBindingReportV1, wesley_core::WeslawError> {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let law_ir = load_weslaw_yaml(source)?;

    validate_law_ir_v1_bindings(&law_ir, &ir, &operations, &schema_hash)
}

fn yaml_fixture_to_json(source: &str) -> serde_json::Value {
    let documents = YamlLoader::load_from_str(source).expect("fixture should parse as YAML");
    assert_eq!(
        documents.len(),
        1,
        "fixture should contain one YAML document"
    );
    yaml_to_json_value(&documents[0])
}

fn yaml_to_json_value(value: &Yaml) -> serde_json::Value {
    match value {
        Yaml::Real(text) => {
            serde_json::Number::from_f64(text.parse::<f64>().expect("fixture real should parse"))
                .map(serde_json::Value::Number)
                .expect("fixture real should be finite")
        }
        Yaml::Integer(integer) => serde_json::Value::Number((*integer).into()),
        Yaml::String(text) => serde_json::Value::String(text.clone()),
        Yaml::Boolean(value) => serde_json::Value::Bool(*value),
        Yaml::Array(items) => {
            serde_json::Value::Array(items.iter().map(yaml_to_json_value).collect())
        }
        Yaml::Hash(map) => {
            let object = map
                .iter()
                .map(|(key, value)| {
                    (
                        key.as_str()
                            .expect("fixture object keys should be strings")
                            .to_string(),
                        yaml_to_json_value(value),
                    )
                })
                .collect();
            serde_json::Value::Object(object)
        }
        Yaml::Null => serde_json::Value::Null,
        Yaml::Alias(_) | Yaml::BadValue => panic!("fixture contains unsupported YAML value"),
    }
}

#[test]
fn accepted_weslaw_fixtures_satisfy_authoring_json_schema() {
    let schema: serde_json::Value =
        serde_json::from_str(&read_fixture("schemas/weslaw-v1.schema.json"))
            .expect("schema should parse");
    let validator = jsonschema::validator_for(&schema).expect("schema should compile");

    let fixtures = [
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
        "test/fixtures/weslaw/accepted/variant-playback-mode.weslaw.yaml",
        "test/fixtures/weslaw/accepted/footprint-replace-range.weslaw.yaml",
        "test/fixtures/weslaw/accepted/channel-ttd-protocol.weslaw.yaml",
        "test/fixtures/weslaw/accepted/channel-ttd-protocol-from-directive.weslaw.yaml",
        "test/fixtures/weslaw/accepted/invariant-translated-evidence.weslaw.yaml",
        "test/fixtures/weslaw/accepted/rust-validator-payoff.weslaw.yaml",
    ];

    for fixture in fixtures {
        let json = yaml_fixture_to_json(&read_fixture(fixture));
        let errors = validator
            .iter_errors(&json)
            .map(|error| error.to_string())
            .collect::<Vec<_>>();
        assert!(errors.is_empty(), "{fixture}: {errors:#?}");
    }

    let draft_scaffolding = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: draft.future-law
    status: draft
    kind: futureLaw
    subject: law:future
    expr: "forall x in Future: x.ready == true"
    futureOnlyField: preserved-for-review
"#;
    let draft_json = yaml_fixture_to_json(draft_scaffolding);
    let draft_errors = validator
        .iter_errors(&draft_json)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(
        draft_errors.is_empty(),
        "draft scaffolding should satisfy the authoring schema: {draft_errors:#?}"
    );

    let invalid_cardinality = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: jedit.op.replaceRangeAsTick.bad-cardinality
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    closures:
      - name: touchedRope
        fromSlot: baseHead
        operator: ropeRangeClosure
        cardinality: several
"#;
    let invalid_cardinality_json = yaml_fixture_to_json(invalid_cardinality);
    let cardinality_errors = validator
        .iter_errors(&invalid_cardinality_json)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(
        !cardinality_errors.is_empty(),
        "authoring schema must reject unknown cardinality values"
    );
}

#[test]
fn accepted_weslaw_fixtures_lower_into_typed_law_ir() {
    let scalar = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
    ))
    .expect("scalar fixture should lower");

    assert_eq!(scalar.api_version, WESLEY_LAW_IR_API_VERSION);
    assert_eq!(scalar.family, "weslaw-fixture-contract-bundle");
    assert_eq!(
        scalar.schema_hash,
        "sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6"
    );
    assert_eq!(scalar.entries.len(), 1);

    let scalar_entry = &scalar.entries[0];
    assert_eq!(scalar_entry.id, "echo.scalar.positiveInt.u32-positive");
    assert_eq!(scalar_entry.kind, LawKindV1::ScalarSemantics);
    assert_eq!(scalar_entry.subject, "scalar:PositiveInt");
    assert_eq!(scalar_entry.tags, vec!["echo", "scalar"]);
    let LawEntryBodyV1::ScalarSemantics(body) = &scalar_entry.body else {
        panic!("expected scalar semantics body");
    };
    assert_eq!(body.representation, ScalarRepresentationV1::Integer);
    assert_eq!(body.min_inclusive, Some(1));
    assert_eq!(body.max_inclusive, Some(4_294_967_295));
    assert_eq!(
        body.forbids,
        vec![ScalarForbiddenInterpretationV1::SilentGraphqlIntNarrowing]
    );

    let variant = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/variant-playback-mode.weslaw.yaml",
    ))
    .expect("variant fixture should lower");
    let LawEntryBodyV1::VariantLaw(body) = &variant.entries[0].body else {
        panic!("expected variant body");
    };
    assert_eq!(body.discriminator.field, "kind");
    assert_eq!(body.discriminator.r#enum, "PlaybackModeKind");
    assert_eq!(body.cases.len(), 5);
    assert_eq!(body.cases[4].value, "SEEK");
    assert_eq!(body.cases[4].requires, vec!["target", "then"]);

    let footprint = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/footprint-replace-range.weslaw.yaml",
    ))
    .expect("footprint fixture should lower");
    let LawEntryBodyV1::FootprintLaw(body) = &footprint.entries[0].body else {
        panic!("expected footprint body");
    };
    assert_eq!(body.reads.len(), 6);
    assert_eq!(body.slots[0].name, "worldline");
    assert_eq!(body.closures[1].name, "affectedAnchors");
    assert_eq!(
        body.create_slots[0].cardinality,
        Some(FootprintCardinalityV1::Optional)
    );
    assert_eq!(body.updates[0].slot, "worldline");

    let channel = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/channel-ttd-protocol.weslaw.yaml",
    ))
    .expect("channel fixture should lower");
    let LawEntryBodyV1::ChannelLaw(body) = &channel.entries[0].body else {
        panic!("expected channel body");
    };
    assert!(body.ordered);
    assert_eq!(body.version, 4);
    assert_eq!(body.messages.len(), 8);

    let invariant = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/invariant-translated-evidence.weslaw.yaml",
    ))
    .expect("invariant fixture should lower");
    let LawEntryBodyV1::InvariantLaw(body) = &invariant.entries[0].body else {
        panic!("expected invariant body");
    };
    assert_eq!(
        body.predicate,
        PredicateV1::FieldEquals {
            field: "nativeContinuumWitness".to_string(),
            value: serde_json::Value::Bool(false),
        }
    );
}

#[test]
fn law_ir_v1_serializes_as_versioned_canonical_json() {
    let law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
    ))
    .expect("fixture should lower");

    let json = to_canonical_law_ir_json(&law_ir).expect("Law IR should serialize");
    let parsed: serde_json::Value = serde_json::from_str(&json).expect("JSON should parse");
    assert!(!json.contains('\n'));
    assert!(!json.contains("  "));
    assert_eq!(parsed["apiVersion"], WESLEY_LAW_IR_API_VERSION);
    assert!(
        json.contains("silentGraphQLIntNarrowing"),
        "closed enum spelling must preserve the GraphQL acronym"
    );
    assert_eq!(
        json,
        wesley_core::to_canonical_json(&parsed).expect("parsed value should re-canonicalize")
    );
}

#[test]
fn law_hash_uses_semantic_canonical_json_and_excludes_rationale() {
    let common_header = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
"#;
    let first = format!(
        r#"{common_header}  source: ../first.graphql
registries:
  resources:
    - id: Diagnostics
      owner: jedit
      kind: forbidden-runtime-domain
      notes: first note
laws:
  - id: z.echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    tags: [scalar, echo]
    rationale: First rationale.
    semantics:
      representation: integer
      forbids: [silentGraphQLIntNarrowing]
  - id: a.jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline, TextBlob]
"#
    );
    let second = format!(
        r#"{common_header}  source: ../second.graphql
registries:
  resources:
    - kind: forbidden-runtime-domain
      owner: jedit
      id: Diagnostics
      notes: second note
laws:
  - id: a.jedit.op.replaceRangeAsTick.footprint
    kind: footprintLaw
    status: active
    subject: operation:Mutation.replaceRangeAsTick
    reads: [TextBlob, BufferWorldline]
  - id: z.echo.scalar.positiveInt.u32-positive
    kind: scalarSemantics
    status: active
    subject: scalar:PositiveInt
    rationale: Different prose.
    tags: [echo, scalar]
    semantics:
      forbids: [silentGraphQLIntNarrowing]
      representation: integer
"#
    );

    let first_ir = load_weslaw_yaml(&first).expect("first law should lower");
    let second_ir = load_weslaw_yaml(&second).expect("second law should lower");

    assert_eq!(
        compute_law_hash_v1(&first_ir).expect("first law hash should compute"),
        compute_law_hash_v1(&second_ir).expect("second law hash should compute")
    );
    assert_ne!(
        compute_law_hash_set_v1(&first_ir)
            .expect("first law document hash should compute")
            .law_document_hash,
        compute_law_hash_set_v1(&second_ir)
            .expect("second law document hash should compute")
            .law_document_hash
    );

    let semantic_json = to_semantic_law_ir_json(&first_ir).expect("semantic JSON should compute");
    assert!(!semantic_json.contains("rationale"));
    assert!(!semantic_json.contains("schemaSource"));
    assert!(!semantic_json.contains("notes"));
    assert!(!semantic_json.contains("status"));
}

#[test]
fn law_hash_materializes_defaults_and_preserves_channel_message_order() {
    let omitted_defaults = load_weslaw_yaml(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    closures:
      - name: touchedRope
        fromSlot: baseHead
        operator: ropeRangeClosure
    createSlots:
      - name: nextHead
        kind: RopeHead
"#,
    )
    .expect("omitted defaults should lower");
    let explicit_defaults = load_weslaw_yaml(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    createSlots:
      - name: nextHead
        kind: RopeHead
        cardinality: one
    closures:
      - name: touchedRope
        fromSlot: baseHead
        operator: ropeRangeClosure
        cardinality: one
"#,
    )
    .expect("explicit defaults should lower");

    assert_eq!(
        compute_law_hash_v1(&omitted_defaults).expect("omitted hash should compute"),
        compute_law_hash_v1(&explicit_defaults).expect("explicit hash should compute")
    );

    let ordered_channel = load_weslaw_yaml(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: warp-ttd.channel.protocol
    status: active
    kind: channelLaw
    subject: channel:ttd.protocol@4
    ordered: true
    version: 4
    messages:
      - field: hostHello
        type: HostHello
      - field: laneCatalog
        type: LaneCatalog
"#,
    )
    .expect("ordered channel should lower");
    let reversed_channel = load_weslaw_yaml(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: warp-ttd.channel.protocol
    status: active
    kind: channelLaw
    subject: channel:ttd.protocol@4
    ordered: true
    version: 4
    messages:
      - field: laneCatalog
        type: LaneCatalog
      - field: hostHello
        type: HostHello
"#,
    )
    .expect("reversed channel should lower");

    assert_ne!(
        compute_law_hash_v1(&ordered_channel).expect("ordered hash should compute"),
        compute_law_hash_v1(&reversed_channel).expect("reversed hash should compute")
    );
}

#[test]
fn contract_bundle_manifest_records_schema_law_profile_and_bundle_hashes() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/footprint-replace-range.weslaw.yaml",
    ))
    .expect("fixture should lower");

    let manifest = build_contract_bundle_manifest_v1(&law_ir, &ir, &operations)
        .expect("bundle manifest should build");

    assert_eq!(
        manifest.api_version,
        WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION
    );
    assert_eq!(manifest.schema_hash, schema_hash);
    assert!(manifest.law_hash.starts_with("sha256:"));
    assert!(manifest.profile_hash.starts_with("sha256:"));
    assert!(manifest.bundle_hash.starts_with("sha256:"));
    assert_eq!(manifest.law_ir_codec, WESLEY_LAW_IR_CANONICAL_JSON_CODEC);
    assert_eq!(manifest.law_entry_count, 1);
    assert!(manifest.law_document_hash.is_some());

    let schema: serde_json::Value = serde_json::from_str(&read_fixture(
        "schemas/wesley-contract-bundle-manifest-v1.schema.json",
    ))
    .expect("contract bundle manifest schema should parse");
    let validator =
        jsonschema::validator_for(&schema).expect("contract bundle manifest schema should compile");
    let manifest_json =
        serde_json::to_value(&manifest).expect("contract bundle manifest should serialize");
    let errors = validator
        .iter_errors(&manifest_json)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(errors.is_empty(), "{errors:#?}");
}

#[test]
fn law_diff_v1_reports_added_and_removed_entries_and_satisfies_schema() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: b.echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
"#
    ))
    .expect("old law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: a.echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target, then]
"#
    ))
    .expect("new law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_eq!(report.api_version, WESLEY_LAW_DIFF_API_VERSION);
    assert_eq!(report.old_schema_hash, schema_hash);
    assert_eq!(report.new_schema_hash, schema_hash);
    assert!(report.old_law_hash.starts_with("sha256:"));
    assert!(report.new_law_hash.starts_with("sha256:"));
    assert_eq!(
        report
            .changes
            .iter()
            .map(|change| change.kind)
            .collect::<Vec<_>>(),
        vec![LawDiffEventKindV1::LawAdded, LawDiffEventKindV1::LawRemoved]
    );

    let schema: serde_json::Value =
        serde_json::from_str(&read_fixture("schemas/wesley-law-diff-v1.schema.json"))
            .expect("law diff schema should parse");
    let validator = jsonschema::validator_for(&schema).expect("law diff schema should compile");
    let report_json = serde_json::to_value(&report).expect("law diff report should serialize");
    let errors = validator
        .iter_errors(&report_json)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(errors.is_empty(), "{errors:#?}");
}

#[test]
fn law_diff_v1_reports_scalar_semantic_changes_without_rationale_noise() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    rationale: old prose
    semantics:
      representation: integer
      minInclusive: 1
      maxInclusive: 100
"#
    ))
    .expect("old scalar law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    rationale: new prose
    semantics:
      representation: integer
      minInclusive: 2
      maxInclusive: 90
      forbids: [silentGraphQLIntNarrowing]
"#
    ))
    .expect("new scalar law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_eq!(report.changes.len(), 1);
    let change = &report.changes[0];
    assert_eq!(change.kind, LawDiffEventKindV1::LawStrengthened);
    assert_eq!(change.law_kind, Some(LawKindV1::ScalarSemantics));
    assert_eq!(
        change
            .field_changes
            .iter()
            .map(|field| field.path.as_str())
            .collect::<Vec<_>>(),
        vec!["body.minInclusive", "body.maxInclusive", "body.forbids"]
    );
    assert!(
        !serde_json::to_string(change)
            .expect("change should serialize")
            .contains("rationale"),
        "semantic diff must not include rationale prose"
    );
}

#[test]
fn law_diff_v1_reports_weakening_scalar_changes() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 10
      maxInclusive: 90
      forbids: [silentGraphQLIntNarrowing]
"#
    ))
    .expect("old scalar law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 1
      maxInclusive: 100
"#
    ))
    .expect("new scalar law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_eq!(report.changes.len(), 1);
    assert_eq!(report.changes[0].kind, LawDiffEventKindV1::LawWeakened);
}

#[test]
fn law_diff_v1_reports_variant_case_changes() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target, then]
      - value: SEEK
        requires: [target]
"#
    ))
    .expect("old variant law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target]
      - value: SEEK
        requires: [target, then]
"#
    ))
    .expect("new variant law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_eq!(report.changes.len(), 1);
    let change = &report.changes[0];
    assert_eq!(change.kind, LawDiffEventKindV1::VariantLawChanged);
    assert_eq!(
        change
            .field_changes
            .iter()
            .map(|field| field.path.as_str())
            .collect::<Vec<_>>(),
        vec!["body.cases.PAUSED.forbids", "body.cases.SEEK.requires"]
    );
}

#[test]
fn law_diff_v1_reports_variant_strengthening_and_weakening() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let baseline = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target]
      - value: SEEK
        requires: [target]
"#
    ))
    .expect("baseline variant law should lower");
    let strengthened = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target, then]
      - value: SEEK
        requires: [target, then]
"#
    ))
    .expect("strengthened variant law should lower");
    let weakened = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
      - value: SEEK
"#
    ))
    .expect("weakened variant law should lower");

    let strengthened_report =
        diff_law_ir_v1(&baseline, &strengthened).expect("law diff should compute");
    assert_eq!(strengthened_report.changes.len(), 1);
    assert_eq!(
        strengthened_report.changes[0].kind,
        LawDiffEventKindV1::LawStrengthened
    );

    let weakened_report = diff_law_ir_v1(&baseline, &weakened).expect("law diff should compute");
    assert_eq!(weakened_report.changes.len(), 1);
    assert_eq!(
        weakened_report.changes[0].kind,
        LawDiffEventKindV1::LawWeakened
    );
}

#[test]
fn law_diff_v1_reports_footprint_expansion_contraction_and_mixed_changes() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let baseline = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline]
    writes: [BufferWorldline]
    creates: [Tick]
    forbids: [Diagnostics, UiState]
"#
    ))
    .expect("baseline footprint law should lower");
    let expanded = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline, TextBlob]
    writes: [BufferWorldline]
    creates: [Tick, TickReceipt]
    forbids: [UiState]
"#
    ))
    .expect("expanded footprint law should lower");
    let contracted = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline]
    writes: []
    creates: [Tick]
    forbids: [Diagnostics, GitWitness, UiState]
"#
    ))
    .expect("contracted footprint law should lower");
    let mixed_change = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline, TextBlob]
    writes: [BufferWorldline]
    creates: [Tick]
    forbids: [Diagnostics, GitWitness, UiState]
"#
    ))
    .expect("mixed footprint law should lower");

    let expansion = diff_law_ir_v1(&baseline, &expanded).expect("expansion diff should compute");
    assert_eq!(expansion.changes.len(), 1);
    assert_eq!(
        expansion.changes[0].kind,
        LawDiffEventKindV1::FootprintExpanded
    );
    assert_eq!(expansion.changes[0].added_reads, vec!["TextBlob"]);
    assert_eq!(expansion.changes[0].added_creates, vec!["TickReceipt"]);
    assert_eq!(expansion.changes[0].removed_forbids, vec!["Diagnostics"]);

    let contraction =
        diff_law_ir_v1(&baseline, &contracted).expect("contraction diff should compute");
    assert_eq!(contraction.changes.len(), 1);
    assert_eq!(
        contraction.changes[0].kind,
        LawDiffEventKindV1::FootprintContracted
    );
    assert_eq!(
        contraction.changes[0].removed_writes,
        vec!["BufferWorldline"]
    );
    assert_eq!(contraction.changes[0].added_forbids, vec!["GitWitness"]);

    let mixed = diff_law_ir_v1(&baseline, &mixed_change).expect("mixed diff should compute");
    assert_eq!(mixed.changes.len(), 1);
    assert_eq!(mixed.changes[0].kind, LawDiffEventKindV1::FootprintChanged);
}

#[test]
fn law_diff_v1_reports_channel_and_invariant_changes_as_modifications() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: warp-ttd.channel.protocol
    status: active
    kind: channelLaw
    subject: channel:ttd.protocol@4
    ordered: true
    version: 4
    messages:
      - field: hostHello
        type: HostHello
  - id: continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: false
"#
    ))
    .expect("old law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: warp-ttd.channel.protocol
    status: active
    kind: channelLaw
    subject: channel:ttd.protocol@4
    ordered: true
    version: 5
    messages:
      - field: hostHello
        type: HostHello
      - field: laneCatalog
        type: LaneCatalog
  - id: continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: true
"#
    ))
    .expect("new law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_eq!(
        report
            .changes
            .iter()
            .map(|change| change.kind)
            .collect::<Vec<_>>(),
        vec![
            LawDiffEventKindV1::PredicateChanged,
            LawDiffEventKindV1::ChannelVersionChanged,
        ]
    );
    assert!(
        report
            .changes
            .iter()
            .all(|change| change.kind != LawDiffEventKindV1::LawAdded),
        "existing law modifications must not be reported as additions"
    );
}

#[test]
fn law_diff_v1_reports_registry_and_tag_hash_deltas() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let old_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
registries:
  resources:
    - id: Diagnostics
      owner: jedit
      kind: forbidden-runtime-domain
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    tags: [echo]
    semantics:
      representation: integer
"#
    ))
    .expect("old law should lower");
    let new_ir = load_weslaw_yaml(&format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
registries:
  resources:
    - id: Diagnostics
      owner: echo
      kind: forbidden-runtime-domain
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    tags: [echo, scalar]
    semantics:
      representation: integer
"#
    ))
    .expect("new law should lower");

    let report = diff_law_ir_v1(&old_ir, &new_ir).expect("law diff should compute");
    assert_ne!(report.old_law_hash, report.new_law_hash);
    assert_eq!(
        report
            .changes
            .iter()
            .map(|change| change.kind)
            .collect::<Vec<_>>(),
        vec![
            LawDiffEventKindV1::RegistryChanged,
            LawDiffEventKindV1::LawTagsChanged,
        ]
    );
}

#[test]
fn law_diff_v1_fixture_outputs_satisfy_published_schema() {
    let schema: serde_json::Value =
        serde_json::from_str(&read_fixture("schemas/wesley-law-diff-v1.schema.json"))
            .expect("law diff schema should parse");
    let validator = jsonschema::validator_for(&schema).expect("law diff schema should compile");
    for fixture_path in [
        "test/fixtures/weslaw/diff/ci-semantic-diff.json",
        "test/fixtures/weslaw/diff/holmes-blade-binding-broken.json",
    ] {
        let report_json: serde_json::Value =
            serde_json::from_str(&read_fixture(fixture_path)).expect("fixture should parse");
        let errors = validator
            .iter_errors(&report_json)
            .map(|error| error.to_string())
            .collect::<Vec<_>>();
        assert!(errors.is_empty(), "{fixture_path}: {errors:#?}");
    }
}

#[test]
fn semantic_law_hash_ignores_programmatic_draft_entries() {
    let mut law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
    ))
    .expect("fixture should lower");
    let baseline_hash = compute_law_hash_v1(&law_ir).expect("baseline hash should compute");
    let mut draft = law_ir.entries[0].clone();
    draft.id = "draft.echo.scalar.positiveInt.other".to_string();
    draft.status = LawStatusV1::Draft;
    draft.rationale = Some("Draft prose must not affect semantic hashes.".to_string());
    if let LawEntryBodyV1::ScalarSemantics(body) = &mut draft.body {
        body.min_inclusive = Some(999);
    }
    law_ir.entries.push(draft);

    assert_eq!(
        baseline_hash,
        compute_law_hash_v1(&law_ir).expect("draft-bearing hash should compute")
    );
}

#[test]
fn law_ir_v1_excludes_drafts_and_sorts_active_entries_by_id() {
    let common_header = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
  source: ../contract-bundle-shape.graphql
laws:
"#;
    let scalar_law = r#"  - id: z.echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 1
      maxInclusive: 4294967295
      forbids: [silentGraphQLIntNarrowing]
"#;
    let invariant_law = r#"  - id: a.continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: false
"#;
    let draft_law = r#"  - id: m.draft.scalar.example
    status: draft
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 1
"#;

    let authored_order = format!("{common_header}{scalar_law}{draft_law}{invariant_law}");
    let reversed_order = format!("{common_header}{invariant_law}{draft_law}{scalar_law}");

    let law_ir = load_weslaw_yaml(&authored_order).expect("fixture should lower");
    let ids = law_ir
        .entries
        .iter()
        .map(|entry| entry.id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        vec![
            "a.continuum.invariant.translated-evidence",
            "z.echo.scalar.positiveInt.u32-positive"
        ]
    );

    let authored_json = to_canonical_law_ir_json(&law_ir).expect("Law IR should serialize");
    let reversed_json = to_canonical_law_ir_json(
        &load_weslaw_yaml(&reversed_order).expect("reversed fixture should lower"),
    )
    .expect("Law IR should serialize");
    assert_eq!(authored_json, reversed_json);
    assert!(!authored_json.contains("m.draft.scalar.example"));
}

#[test]
fn law_ir_v1_ignores_draft_entries_before_kind_body_validation() {
    let source = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
  source: ../contract-bundle-shape.graphql
laws:
  - id: a.continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: false
  - id: z.draft.future-law
    status: draft
    kind: futureLaw
    subject: law:future
    expr: "forall x in Future: x.ready == true"
    futureOnlyField: preserved-for-review
"#;

    let law_ir =
        load_weslaw_yaml(source).expect("draft scaffolding should not fail active lowering");
    assert_eq!(law_ir.entries.len(), 1);
    assert_eq!(
        law_ir.entries[0].id,
        "a.continuum.invariant.translated-evidence"
    );
}

#[test]
fn footprint_closure_cardinality_defaults_to_one_when_omitted() {
    let source = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    closures:
      - name: touchedRope
        fromSlot: baseHead
        operator: ropeRangeClosure
"#;

    let law_ir = load_weslaw_yaml(source).expect("schema-valid closure should lower");
    let LawEntryBodyV1::FootprintLaw(body) = &law_ir.entries[0].body else {
        panic!("expected footprint law body");
    };
    assert_eq!(body.closures[0].cardinality, FootprintCardinalityV1::One);
}

#[test]
fn law_ir_v1_json_schema_accepts_ir_and_rejects_kind_body_mismatch() {
    let schema: serde_json::Value =
        serde_json::from_str(&read_fixture("schemas/wesley-law-ir-v1.schema.json"))
            .expect("Law IR schema should parse");
    let validator = jsonschema::validator_for(&schema).expect("Law IR schema should compile");

    let law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
    ))
    .expect("fixture should lower");
    let json = to_canonical_law_ir_json(&law_ir).expect("Law IR should serialize");
    let valid_ir: serde_json::Value = serde_json::from_str(&json).expect("JSON should parse");
    let valid_errors = validator
        .iter_errors(&valid_ir)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(valid_errors.is_empty(), "{valid_errors:#?}");

    let mut mismatched_ir = valid_ir.clone();
    mismatched_ir["entries"][0]["kind"] = serde_json::Value::String("footprintLaw".to_string());
    let mismatch_errors = validator
        .iter_errors(&mismatched_ir)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(
        !mismatch_errors.is_empty(),
        "Law IR schema must reject kind/body mismatches"
    );

    let mut draft_ir = valid_ir;
    draft_ir["entries"][0]["status"] = serde_json::Value::String("draft".to_string());
    let draft_errors = validator
        .iter_errors(&draft_ir)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(
        !draft_errors.is_empty(),
        "Law IR schema must reject draft entries"
    );

    let mut invalid_ordering_ir = draft_ir;
    invalid_ordering_ir["entries"][0]["status"] = serde_json::Value::String("active".to_string());
    invalid_ordering_ir["entries"][0]["body"]["ordering"] =
        serde_json::Value::String("lamprot".to_string());
    let ordering_errors = validator
        .iter_errors(&invalid_ordering_ir)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(
        !ordering_errors.is_empty(),
        "Law IR schema must reject unknown scalar ordering values"
    );
}

#[test]
fn law_ir_v1_loader_rejects_malformed_schema_hash_anchors() {
    let source = r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
"#;

    let error = load_weslaw_yaml(source).expect_err("malformed schema hash should fail");
    assert_eq!(error.code, WeslawDiagnosticCode::InvalidDocument);
    assert_eq!(error.path.as_deref(), Some("$.schema.hash"));
}

#[test]
fn law_ir_v1_binding_rejects_schema_hash_mismatch() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/rejected/schema-hash-mismatch.weslaw.yaml",
    ))
    .expect("structure-valid law should lower");

    let error = validate_law_ir_v1_bindings(&law_ir, &ir, &operations, &schema_hash)
        .expect_err("schema hash mismatch must fail before subject binding");
    assert_eq!(error.code, WeslawDiagnosticCode::SchemaHashMismatch);
    assert_eq!(error.code.as_str(), "WESLAW_SCHEMA_HASH_MISMATCH");
    assert_eq!(error.path.as_deref(), Some("$.schema.hash"));
}

#[test]
fn law_ir_v1_binding_rejects_unresolved_subjects() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let law_ir = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/rejected/unresolved-subject.weslaw.yaml",
    ))
    .expect("structure-valid law should lower");

    let error = validate_law_ir_v1_bindings(&law_ir, &ir, &operations, &schema_hash)
        .expect_err("unresolved operation subject must fail");
    assert_eq!(error.code, WeslawDiagnosticCode::UnresolvedSubject);
    assert_eq!(error.code.as_str(), "WESLAW_UNRESOLVED_SUBJECT");
    assert_eq!(error.path.as_deref(), Some("$.laws[0].subject"));
    assert!(error.message.contains("operation:Mutation.replaceRange"));
    assert!(error
        .message
        .contains("operation:Mutation.replaceRangeAsTick"));
}

#[test]
fn formal_wes_channel_directives_lower_into_canonical_law_ir() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let lowered = lower_wes_channel_directives_to_law_ir_v1(
        &ir,
        "weslaw-fixture-contract-bundle",
        &schema_hash,
        Some("../contract-bundle-shape.graphql".to_string()),
    )
    .expect("@wes_channel directives should lower");
    let authored = load_weslaw_yaml(&read_fixture(
        "test/fixtures/weslaw/accepted/channel-ttd-protocol-from-directive.weslaw.yaml",
    ))
    .expect("authored equivalent should lower");

    assert_eq!(
        to_semantic_law_ir_json(&lowered).expect("lowered semantic JSON should compute"),
        to_semantic_law_ir_json(&authored).expect("authored semantic JSON should compute")
    );
    assert_eq!(
        compute_law_hash_v1(&lowered).expect("lowered hash should compute"),
        compute_law_hash_v1(&authored).expect("authored hash should compute")
    );

    let binding = validate_law_ir_v1_bindings(&lowered, &ir, &operations, &schema_hash)
        .expect("directive-lowered channel law should bind");
    assert_eq!(binding.bound_entry_count, 1);
}

#[test]
fn law_ir_v1_binding_accepts_schema_and_operation_subjects() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let law_source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
registries:
  verifiers:
    - id: continuum-law-checker
      owner: continuum
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 1
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target, then]
  - id: continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: false
  - id: continuum.invariant.playback-mode-kind
    status: active
    kind: invariantLaw
    subject: enum:PlaybackModeKind
    predicate:
      op: external
      verifier: continuum-law-checker
      ref: continuum.invariants.playbackModeKind
  - id: continuum.invariant.buffer-worldline-id
    status: active
    kind: invariantLaw
    subject: field:BufferWorldline.worldlineId
    predicate:
      op: external
      verifier: continuum-law-checker
      ref: continuum.invariants.bufferWorldlineId
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline]
"#
    );
    let law_ir = load_weslaw_yaml(&law_source).expect("law should lower");

    let report = validate_law_ir_v1_bindings(&law_ir, &ir, &operations, &schema_hash)
        .expect("accepted subject coordinates should bind");

    assert_eq!(report.schema_hash, schema_hash);
    assert_eq!(report.bound_entry_count, 6);
}

#[test]
fn accepted_weslaw_fixtures_bind_to_contract_bundle_shape() {
    let fixtures = [
        "test/fixtures/weslaw/accepted/scalar-semantics.weslaw.yaml",
        "test/fixtures/weslaw/accepted/variant-playback-mode.weslaw.yaml",
        "test/fixtures/weslaw/accepted/footprint-replace-range.weslaw.yaml",
        "test/fixtures/weslaw/accepted/channel-ttd-protocol.weslaw.yaml",
        "test/fixtures/weslaw/accepted/invariant-translated-evidence.weslaw.yaml",
        "test/fixtures/weslaw/accepted/rust-validator-payoff.weslaw.yaml",
    ];

    for fixture in fixtures {
        let report = bind_law_source(&read_fixture(fixture)).expect(fixture);
        let expected_count = if fixture.ends_with("rust-validator-payoff.weslaw.yaml") {
            2
        } else {
            1
        };
        assert_eq!(report.bound_entry_count, expected_count, "{fixture}");
    }
}

#[test]
fn law_ir_v1_binding_rejects_wrong_subject_kind_for_law_kind() {
    let (ir, operations, schema_hash) = contract_bundle_shape();
    let source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: type:BufferWorldline
    semantics:
      representation: integer
"#
    );
    let law_ir = load_weslaw_yaml(&source).expect("law should lower");

    let error = validate_law_ir_v1_bindings(&law_ir, &ir, &operations, &schema_hash)
        .expect_err("scalar semantics must target a scalar subject");

    assert_eq!(error.code, WeslawDiagnosticCode::WrongSubjectKind);
    assert_eq!(error.code.as_str(), "WESLAW_WRONG_SUBJECT_KIND");
    assert_eq!(error.path.as_deref(), Some("$.laws[0].subject"));
}

#[test]
fn law_ir_v1_binding_rejects_unbound_variant_references() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: missingKind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
"#
    );

    let error = bind_law_source(&source).expect_err("missing discriminator should fail");
    assert_eq!(error.code, WeslawDiagnosticCode::UnresolvedReference);
    assert_eq!(error.code.as_str(), "WESLAW_UNRESOLVED_REFERENCE");
    assert_eq!(error.path.as_deref(), Some("$.laws[0].discriminator.field"));
}

#[test]
fn law_ir_v1_binding_rejects_unbound_footprint_arg_paths() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline]
    slots:
      - name: worldline
        kind: BufferWorldline
        bindFromArg: input.missingWorldlineId
"#
    );

    let error = bind_law_source(&source).expect_err("missing argument path should fail");
    assert_eq!(error.code, WeslawDiagnosticCode::UnresolvedReference);
    assert_eq!(
        error.path.as_deref(),
        Some("$.laws[0].slots[0].bindFromArg")
    );
}

#[test]
fn law_ir_v1_binding_rejects_unbound_footprint_resources() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [MissingResource]
"#
    );

    let error = bind_law_source(&source).expect_err("missing resource should fail");
    assert_eq!(error.code, WeslawDiagnosticCode::UnresolvedReference);
}

#[test]
fn law_ir_v1_binding_rejects_contradictory_variant_and_footprint_law() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let variant = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.variant.playback-mode
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: SEEK
        requires: [target]
        forbids: [target]
"#
    );
    let variant_error = bind_law_source(&variant).expect_err("contradictory variant should fail");
    assert_eq!(variant_error.code, WeslawDiagnosticCode::Conflict);

    let footprint = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline]
    forbids: [BufferWorldline]
"#
    );
    let footprint_error =
        bind_law_source(&footprint).expect_err("contradictory footprint should fail");
    assert_eq!(footprint_error.code, WeslawDiagnosticCode::Conflict);

    let duplicate_subject = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
  - id: echo.scalar.positiveInt.other
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: string
"#
    );
    let duplicate_error =
        bind_law_source(&duplicate_subject).expect_err("duplicate scalar law subject should fail");
    assert_eq!(duplicate_error.code, WeslawDiagnosticCode::Conflict);
}

#[test]
fn law_ir_v1_binding_rejects_unbound_invariant_predicate_fields() {
    let (_, _, schema_hash) = contract_bundle_shape();
    let source = format!(
        r#"apiVersion: weslaw/v1
schema:
  family: weslaw-fixture-contract-bundle
  hash: {schema_hash}
laws:
  - id: continuum.invariant.translated-evidence
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: missingWitness
      value: false
"#
    );

    let error = bind_law_source(&source).expect_err("missing predicate field should fail");
    assert_eq!(error.code, WeslawDiagnosticCode::UnresolvedReference);
    assert_eq!(error.path.as_deref(), Some("$.laws[0].predicate.field"));
}

#[test]
fn rejected_weslaw_fixtures_emit_stable_diagnostic_codes() {
    let cases = [
        (
            "test/fixtures/weslaw/rejected/duplicate-id.weslaw.yaml",
            "test/fixtures/weslaw/rejected/duplicate-id.expected.txt",
            WeslawDiagnosticCode::DuplicateId,
        ),
        (
            "test/fixtures/weslaw/rejected/raw-expression-invariant.weslaw.yaml",
            "test/fixtures/weslaw/rejected/raw-expression-invariant.expected.txt",
            WeslawDiagnosticCode::RawExprRejected,
        ),
        (
            "test/fixtures/weslaw/rejected/unknown-kind.weslaw.yaml",
            "test/fixtures/weslaw/rejected/unknown-kind.expected.txt",
            WeslawDiagnosticCode::UnknownKind,
        ),
        (
            "test/fixtures/weslaw/rejected/unknown-field.weslaw.yaml",
            "test/fixtures/weslaw/rejected/unknown-field.expected.txt",
            WeslawDiagnosticCode::UnknownField,
        ),
        (
            "test/fixtures/weslaw/rejected/wrong-type-optional-sequence.weslaw.yaml",
            "test/fixtures/weslaw/rejected/wrong-type-optional-sequence.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
        (
            "test/fixtures/weslaw/rejected/field-equals-extra-predicate-field.weslaw.yaml",
            "test/fixtures/weslaw/rejected/field-equals-extra-predicate-field.expected.txt",
            WeslawDiagnosticCode::UnknownField,
        ),
        (
            "test/fixtures/weslaw/rejected/external-extra-predicate-field.weslaw.yaml",
            "test/fixtures/weslaw/rejected/external-extra-predicate-field.expected.txt",
            WeslawDiagnosticCode::UnknownField,
        ),
        (
            "test/fixtures/weslaw/rejected/scalar-range-on-non-integer.weslaw.yaml",
            "test/fixtures/weslaw/rejected/scalar-range-on-non-integer.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
        (
            "test/fixtures/weslaw/rejected/scalar-min-greater-than-max.weslaw.yaml",
            "test/fixtures/weslaw/rejected/scalar-min-greater-than-max.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
        (
            "test/fixtures/weslaw/rejected/scalar-forbid-non-integer.weslaw.yaml",
            "test/fixtures/weslaw/rejected/scalar-forbid-non-integer.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
        (
            "test/fixtures/weslaw/rejected/scalar-unknown-ordering.weslaw.yaml",
            "test/fixtures/weslaw/rejected/scalar-unknown-ordering.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
        (
            "test/fixtures/weslaw/rejected/footprint-unknown-cardinality.weslaw.yaml",
            "test/fixtures/weslaw/rejected/footprint-unknown-cardinality.expected.txt",
            WeslawDiagnosticCode::InvalidDocument,
        ),
    ];

    for (path, expected_path, code) in cases {
        let error = load_weslaw_yaml(&read_fixture(path)).expect_err(path);
        assert_eq!(error.code, code, "{path}");
        assert_eq!(
            error.code.as_str(),
            read_fixture(expected_path).trim(),
            "{path}"
        );
    }
}
