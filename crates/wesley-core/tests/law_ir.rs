use std::fs;
use std::path::{Path, PathBuf};

use yaml_rust2::{Yaml, YamlLoader};

use wesley_core::{
    load_weslaw_yaml, to_canonical_law_ir_json, LawEntryBodyV1, LawKindV1, PredicateV1,
    ScalarForbiddenInterpretationV1, ScalarRepresentationV1, WeslawDiagnosticCode,
    WESLEY_LAW_IR_API_VERSION,
};

fn repo_path(path: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

fn read_fixture(path: &str) -> String {
    fs::read_to_string(repo_path(path)).expect("fixture should be readable")
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
        "test/fixtures/weslaw/accepted/invariant-translated-evidence.weslaw.yaml",
    ];

    for fixture in fixtures {
        let json = yaml_fixture_to_json(&read_fixture(fixture));
        let errors = validator
            .iter_errors(&json)
            .map(|error| error.to_string())
            .collect::<Vec<_>>();
        assert!(errors.is_empty(), "{fixture}: {errors:#?}");
    }
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
        body.create_slots[0].cardinality.as_deref(),
        Some("optional")
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
