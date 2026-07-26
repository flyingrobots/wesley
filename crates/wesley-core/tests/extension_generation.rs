use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use wesley_core::{
    compute_generation_artifact_digest_v1, list_schema_operations_sdl, lower_schema_sdl,
    ExtensionGenerationInputV2, GenerationArtifactContentV1, GenerationArtifactReferenceV1,
    GenerationContractErrorKind, GenerationProvenanceManifestV2, GenerationReviewV2,
    GeneratorIdentityV1, Metadata, UnitMeta,
};

fn repo_path(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

fn read(path: &str) -> String {
    fs::read_to_string(repo_path(path)).unwrap_or_else(|error| panic!("read {path}: {error}"))
}

fn generation_schema_validator(schema: &Value) -> jsonschema::Validator {
    jsonschema::validator_for(schema).expect("generation schema should compile")
}

fn shape_fixture() -> (wesley_core::WesleyIR, Vec<wesley_core::SchemaOperation>) {
    let sdl = read("test/fixtures/extension-generation/schema.graphql");
    let shape_ir = lower_schema_sdl(&sdl).expect("fixture schema should lower");
    let operations = list_schema_operations_sdl(&sdl).expect("fixture operations should list");
    (shape_ir, operations)
}

fn artifact_ref(coordinate: &str, bytes: &[u8]) -> GenerationArtifactReferenceV1 {
    GenerationArtifactReferenceV1::for_bytes(coordinate, bytes)
        .expect("fixture artifact reference should be valid")
}

fn input_with(
    shape_ir: wesley_core::WesleyIR,
    operations: Vec<wesley_core::SchemaOperation>,
    owner_declarations: Vec<GenerationArtifactReferenceV1>,
    settings: &[u8],
    projection_roles: Vec<&str>,
) -> ExtensionGenerationInputV2 {
    ExtensionGenerationInputV2::new(
        shape_ir,
        operations,
        owner_declarations,
        compute_generation_artifact_digest_v1(settings),
        projection_roles.into_iter().map(str::to_owned).collect(),
    )
    .expect("fixture generation input should validate")
}

#[test]
fn canonical_generation_input_ignores_ambient_metadata_and_set_order() {
    let (mut first_shape, first_operations) = shape_fixture();
    first_shape.metadata = Some(Metadata {
        source_hash: Some("sha256:local-only".to_owned()),
        generated_at: Some("2026-07-13T00:00:00Z".to_owned()),
        units: vec![UnitMeta {
            id: "/tmp/first/schema.graphql".to_owned(),
            package: "fixture".to_owned(),
            hash: "sha256:first".to_owned(),
        }],
    });

    let mut second_shape = first_shape.clone();
    second_shape.metadata = Some(Metadata {
        source_hash: Some("sha256:different-local-only".to_owned()),
        generated_at: Some("2099-01-01T00:00:00Z".to_owned()),
        units: vec![UnitMeta {
            id: "C:\\different\\checkout\\schema.graphql".to_owned(),
            package: "another-environment".to_owned(),
            hash: "sha256:second".to_owned(),
        }],
    });
    let mut second_operations = first_operations.clone();
    second_operations.reverse();
    for operation in &mut second_operations {
        operation.arguments.reverse();
    }

    let owner_a = artifact_ref("fixture:owner-a@1", b"owner-a");
    let owner_b = artifact_ref("fixture:owner-b@1", b"owner-b");
    let first = input_with(
        first_shape,
        first_operations,
        vec![owner_a.clone(), owner_b.clone()],
        b"settings",
        vec!["profile", "target-artifact"],
    );
    let second = input_with(
        second_shape,
        second_operations,
        vec![owner_b, owner_a],
        b"settings",
        vec!["target-artifact", "profile"],
    );

    assert_eq!(
        first.canonical_bytes().expect("first input should encode"),
        second
            .canonical_bytes()
            .expect("second input should encode")
    );
    assert_eq!(
        first.digest().expect("first input should hash"),
        second.digest().expect("second input should hash")
    );
    assert!(first.shape_ir.metadata.is_none());
}

#[test]
fn every_generation_input_class_moves_the_generation_digest() {
    let (shape_ir, operations) = shape_fixture();
    let owner = artifact_ref("fixture:owner@1", b"owner-v1");
    let base = input_with(
        shape_ir.clone(),
        operations.clone(),
        vec![owner.clone()],
        b"settings-v1",
        vec!["target-artifact"],
    );
    let base_digest = base.digest().expect("base input should hash");

    let mut changed_shape = shape_ir.clone();
    changed_shape.types[0].description = Some("structural shape revision".to_owned());
    let shape_change = input_with(
        changed_shape,
        operations.clone(),
        vec![owner.clone()],
        b"settings-v1",
        vec!["target-artifact"],
    );
    assert_ne!(base_digest, shape_change.digest().unwrap());

    let mut changed_operations = operations.clone();
    changed_operations[0].result_type.nullable = !changed_operations[0].result_type.nullable;
    let operation_change = input_with(
        shape_ir.clone(),
        changed_operations,
        vec![owner.clone()],
        b"settings-v1",
        vec!["target-artifact"],
    );
    assert_ne!(base_digest, operation_change.digest().unwrap());

    let owner_change = input_with(
        shape_ir.clone(),
        operations.clone(),
        vec![artifact_ref("fixture:owner@1", b"owner-v2")],
        b"settings-v1",
        vec!["target-artifact"],
    );
    assert_ne!(base_digest, owner_change.digest().unwrap());

    let settings_change = input_with(
        shape_ir,
        operations,
        vec![owner],
        b"settings-v2",
        vec!["target-artifact"],
    );
    assert_ne!(base_digest, settings_change.digest().unwrap());
}

#[test]
fn generation_input_rejects_malformed_operation_coordinates() {
    let (shape_ir, operations) = shape_fixture();
    let assert_invalid = |operations, expected_subject: &str| {
        let error = ExtensionGenerationInputV2::new(
            shape_ir.clone(),
            operations,
            Vec::new(),
            compute_generation_artifact_digest_v1(b"settings"),
            Vec::new(),
        )
        .expect_err("malformed operation coordinate must fail");
        assert_eq!(error.kind, GenerationContractErrorKind::InvalidCoordinate);
        assert_eq!(error.subject, expected_subject);
    };

    let mut empty_root = operations.clone();
    empty_root[0].root_type_name.clear();
    assert_invalid(empty_root, "operations[0].rootTypeName");

    let mut empty_field = operations.clone();
    empty_field[0].field_name.clear();
    assert_invalid(empty_field, "operations[0].fieldName");

    let mut empty_argument = operations;
    empty_argument[0].arguments[0].name.clear();
    assert_invalid(empty_argument, "operations[0].arguments[0].name");
}

#[test]
fn generation_input_classifies_invalid_projection_roles_as_tokens() {
    let (shape_ir, operations) = shape_fixture();
    let error = ExtensionGenerationInputV2::new(
        shape_ir,
        operations,
        Vec::new(),
        compute_generation_artifact_digest_v1(b"settings"),
        vec![" padded-role ".to_owned()],
    )
    .expect_err("padded projection role must fail");

    assert_eq!(error.kind, GenerationContractErrorKind::InvalidToken);
    assert_eq!(error.kind.as_str(), "WESLEY_GENERATION_INVALID_TOKEN");
    assert_eq!(error.subject, "projectionRoles");
}

#[test]
fn conflicting_digests_for_one_coordinate_are_rejected_structurally() {
    let (shape_ir, operations) = shape_fixture();
    let error = ExtensionGenerationInputV2::new(
        shape_ir,
        operations,
        vec![
            artifact_ref("fixture:owner@1", b"first"),
            artifact_ref("fixture:owner@1", b"second"),
        ],
        compute_generation_artifact_digest_v1(b"settings"),
        vec!["target-artifact".to_owned()],
    )
    .expect_err("conflicting coordinate digests must fail");

    assert_eq!(
        error.kind,
        GenerationContractErrorKind::CoordinateDigestConflict
    );
    assert_eq!(
        error.kind.as_str(),
        "WESLEY_GENERATION_COORDINATE_DIGEST_CONFLICT"
    );
    assert_eq!(error.subject, "fixture:owner@1");

    let (shape_ir, operations) = shape_fixture();
    let input = input_with(
        shape_ir,
        operations,
        vec![artifact_ref("fixture:shared@1", b"source")],
        b"settings",
        vec!["target-artifact"],
    );
    let generator =
        GeneratorIdentityV1::for_bytes("fixture:generator@1", "1.0.0", b"generator").unwrap();
    let error = GenerationProvenanceManifestV2::new(
        &input,
        generator,
        vec![artifact_ref("fixture:shared@1", b"different output")],
    )
    .expect_err("source/output coordinate collisions must fail");
    assert_eq!(
        error.kind,
        GenerationContractErrorKind::CoordinateDigestConflict
    );
    assert_eq!(error.subject, "fixture:shared@1");
}

#[test]
fn provenance_recomputes_generator_source_and_output_digests() {
    let (shape_ir, operations) = shape_fixture();
    let sources = vec![
        GenerationArtifactContentV1::new("fixture:owner-a@1", b"owner-a".to_vec()),
        GenerationArtifactContentV1::new("fixture:owner-b@1", b"owner-b".to_vec()),
    ];
    let outputs = vec![
        GenerationArtifactContentV1::new("fixture:target-artifact@1", b"target".to_vec()),
        GenerationArtifactContentV1::new("fixture:profile@1", b"profile".to_vec()),
    ];
    let input = input_with(
        shape_ir,
        operations,
        sources
            .iter()
            .map(GenerationArtifactContentV1::reference)
            .collect(),
        b"settings",
        vec!["profile", "target-artifact"],
    );
    let generator_bytes = b"fixture generator component";
    let generator = GeneratorIdentityV1::for_bytes("fixture:generator@1", "1.0.0", generator_bytes)
        .expect("fixture generator identity should validate");
    let manifest = GenerationProvenanceManifestV2::new(
        &input,
        generator,
        outputs
            .iter()
            .map(GenerationArtifactContentV1::reference)
            .collect(),
    )
    .expect("provenance should build");

    let verified = manifest
        .verify(&input, generator_bytes, &sources, &outputs)
        .expect("all exact materials should verify");
    assert_eq!(verified.verified_source_count, 2);
    assert_eq!(verified.verified_output_count, 2);

    let mut tampered_source = sources.clone();
    tampered_source[0].bytes = b"tampered".to_vec();
    let error = manifest
        .verify(&input, generator_bytes, &tampered_source, &outputs)
        .expect_err("source tampering must fail");
    assert_eq!(
        error.kind,
        GenerationContractErrorKind::ArtifactDigestMismatch
    );
    assert_eq!(error.subject, "fixture:owner-a@1");

    let mut tampered_output = outputs.clone();
    tampered_output[1].bytes = b"tampered".to_vec();
    let error = manifest
        .verify(&input, generator_bytes, &sources, &tampered_output)
        .expect_err("output tampering must fail");
    assert_eq!(
        error.kind,
        GenerationContractErrorKind::ArtifactDigestMismatch
    );
    assert_eq!(error.subject, "fixture:profile@1");

    let error = manifest
        .verify(&input, b"wrong generator", &sources, &outputs)
        .expect_err("generator tampering must fail");
    assert_eq!(
        error.kind,
        GenerationContractErrorKind::ArtifactDigestMismatch
    );
    assert_eq!(error.subject, "fixture:generator@1");

    let error = manifest
        .verify(&input, generator_bytes, &sources[..1], &outputs)
        .expect_err("missing source material must fail");
    assert_eq!(error.kind, GenerationContractErrorKind::ArtifactMissing);
    assert_eq!(error.subject, "fixture:owner-b@1");
}

#[test]
fn review_json_is_deterministic_and_explicitly_non_authoritative() {
    let (shape_ir, operations) = shape_fixture();
    let source = GenerationArtifactContentV1::new("fixture:owner@1", b"owner".to_vec());
    let input = input_with(
        shape_ir,
        operations,
        vec![source.reference()],
        b"settings",
        vec!["profile", "target-artifact"],
    );
    let generator = GeneratorIdentityV1::for_bytes("fixture:generator@1", "1.0.0", b"generator")
        .expect("generator identity should validate");
    let output_a = artifact_ref("fixture:target-artifact@1", b"target");
    let output_b = artifact_ref("fixture:profile@1", b"profile");
    let first_manifest = GenerationProvenanceManifestV2::new(
        &input,
        generator.clone(),
        vec![output_a.clone(), output_b.clone()],
    )
    .unwrap();
    let second_manifest =
        GenerationProvenanceManifestV2::new(&input, generator, vec![output_b, output_a]).unwrap();

    let first = GenerationReviewV2::from_manifest(&input, &first_manifest).unwrap();
    let second = GenerationReviewV2::from_manifest(&input, &second_manifest).unwrap();
    assert!(!first.authoritative());
    assert_eq!(
        first.canonical_bytes().unwrap(),
        second.canonical_bytes().unwrap()
    );
}

#[test]
fn generation_review_deserialization_rejects_authority_claims() {
    let mut fixture: Value =
        serde_json::from_str(&read("test/fixtures/extension-generation/review.json")).unwrap();
    fixture["authoritative"] = Value::Bool(true);

    let error = serde_json::from_value::<GenerationReviewV2>(fixture)
        .expect_err("authoritative review projection must not deserialize");
    assert!(
        error
            .to_string()
            .contains("WESLEY_GENERATION_AUTHORITATIVE_REVIEW_REJECTED"),
        "unexpected deserialization failure: {error}"
    );
}

#[test]
fn checked_generation_fixtures_match_public_api_and_published_schemas() {
    let fixture_root = "test/fixtures/extension-generation";
    let schema_sdl = read(&format!("{fixture_root}/schema.graphql"));
    let shape_ir = lower_schema_sdl(&schema_sdl).expect("fixture schema should lower");
    let operations =
        list_schema_operations_sdl(&schema_sdl).expect("fixture operations should list");
    let source = GenerationArtifactContentV1::new(
        "fixture:semantic-source@1",
        read(&format!("{fixture_root}/semantic-source.json")).into_bytes(),
    );
    let output = GenerationArtifactContentV1::new(
        "fixture:generated-profile@1",
        read(&format!("{fixture_root}/generated-profile.json")).into_bytes(),
    );
    let input = input_with(
        shape_ir,
        operations,
        vec![source.reference()],
        b"fixture-settings-v1",
        vec!["generated-profile"],
    );
    let generator_bytes = b"fixture-generator-v1";
    let manifest = GenerationProvenanceManifestV2::new(
        &input,
        GeneratorIdentityV1::for_bytes("fixture:semantic-generator@1", "1.0.0", generator_bytes)
            .unwrap(),
        vec![output.reference()],
    )
    .unwrap();
    let review = GenerationReviewV2::from_manifest(&input, &manifest).unwrap();

    let artifacts = [
        (
            "schemas/wesley-extension-generation-input-v2.schema.json",
            "input.json",
            serde_json::to_value(&input).unwrap(),
            input.canonical_bytes().unwrap(),
        ),
        (
            "schemas/wesley-generation-provenance-manifest-v2.schema.json",
            "provenance.json",
            serde_json::to_value(&manifest).unwrap(),
            manifest.canonical_bytes().unwrap(),
        ),
        (
            "schemas/wesley-generation-review-v2.schema.json",
            "review.json",
            serde_json::to_value(&review).unwrap(),
            review.canonical_bytes().unwrap(),
        ),
    ];

    for (schema_path, fixture_name, value, canonical_bytes) in artifacts {
        let fixture_text = read(&format!("{fixture_root}/{fixture_name}"));
        assert_eq!(
            fixture_text.trim_end().as_bytes(),
            canonical_bytes,
            "{fixture_name} drifted"
        );

        let schema: Value = serde_json::from_str(&read(schema_path)).unwrap();
        let validator = generation_schema_validator(&schema);
        let errors = validator
            .iter_errors(&value)
            .map(|error| error.to_string())
            .collect::<Vec<_>>();
        assert!(errors.is_empty(), "{schema_path}: {errors:#?}");
    }

    let input_fixture = read(&format!("{fixture_root}/input.json"));
    let decoded_input: ExtensionGenerationInputV2 =
        serde_json::from_str(&input_fixture).expect("input fixture should deserialize");
    assert_eq!(
        decoded_input.canonical_bytes().unwrap(),
        input_fixture.trim_end().as_bytes()
    );

    let provenance_fixture = read(&format!("{fixture_root}/provenance.json"));
    let decoded_manifest: GenerationProvenanceManifestV2 =
        serde_json::from_str(&provenance_fixture).expect("provenance fixture should deserialize");
    assert_eq!(
        decoded_manifest.canonical_bytes().unwrap(),
        provenance_fixture.trim_end().as_bytes()
    );

    let review_fixture = read(&format!("{fixture_root}/review.json"));
    let decoded_review: GenerationReviewV2 =
        serde_json::from_str(&review_fixture).expect("review fixture should deserialize");
    assert_eq!(
        decoded_review.canonical_bytes().unwrap(),
        review_fixture.trim_end().as_bytes()
    );

    manifest
        .verify(&input, generator_bytes, &[source], &[output])
        .expect("checked fixture materials should verify");
}

#[test]
fn published_input_schema_rejects_malformed_nested_contracts() {
    let schema: Value = serde_json::from_str(&read(
        "schemas/wesley-extension-generation-input-v2.schema.json",
    ))
    .unwrap();
    let validator = generation_schema_validator(&schema);
    let fixture: Value =
        serde_json::from_str(&read("test/fixtures/extension-generation/input.json")).unwrap();

    let mut empty_operation = fixture.clone();
    empty_operation["operations"][0] = serde_json::json!({});

    let mut empty_shape_type = fixture.clone();
    empty_shape_type["shapeIr"]["types"][0] = serde_json::json!({});

    let mut unexpected_semantics = fixture;
    unexpected_semantics["law"] = serde_json::json!({"ignored": true});

    for (name, invalid) in [
        ("empty operation", empty_operation),
        ("empty Shape IR type", empty_shape_type),
        ("unexpected semantic law", unexpected_semantics),
    ] {
        assert!(
            !validator.is_valid(&invalid),
            "published input schema accepted {name}"
        );
    }
}

#[test]
fn generation_input_deserialization_rejects_semantic_law_fields() {
    let mut fixture: Value =
        serde_json::from_str(&read("test/fixtures/extension-generation/input.json")).unwrap();
    fixture["law"] = serde_json::json!({"ignored": true});

    let error = serde_json::from_value::<ExtensionGenerationInputV2>(fixture)
        .expect_err("v2 must not accept or silently ignore semantic law");
    assert!(error.to_string().contains("unknown field `law`"));
}

#[test]
fn published_generation_schemas_reject_malformed_tokens() {
    let cases = [
        (
            "schemas/wesley-extension-generation-input-v2.schema.json",
            "test/fixtures/extension-generation/input.json",
            "/ownerDeclarations/0/coordinate",
            serde_json::json!(" fixture:semantic-source@1 "),
        ),
        (
            "schemas/wesley-generation-provenance-manifest-v2.schema.json",
            "test/fixtures/extension-generation/provenance.json",
            "/generator/version",
            serde_json::json!("1.0.0\n"),
        ),
        (
            "schemas/wesley-generation-review-v2.schema.json",
            "test/fixtures/extension-generation/review.json",
            "/projectionRoles/0",
            serde_json::json!("\tgenerated-profile"),
        ),
    ];

    for (schema_path, fixture_path, token_path, malformed) in cases {
        let schema: Value = serde_json::from_str(&read(schema_path)).unwrap();
        let validator = generation_schema_validator(&schema);
        let mut fixture: Value = serde_json::from_str(&read(fixture_path)).unwrap();
        *fixture
            .pointer_mut(token_path)
            .unwrap_or_else(|| panic!("missing fixture token at {token_path}")) = malformed;

        assert!(
            !validator.is_valid(&fixture),
            "{schema_path} accepted malformed token at {token_path}"
        );
    }
}

#[test]
fn published_input_schema_accepts_documented_shape_arguments() {
    let schema_sdl = r#"
        type Query {
          projection(
            """Stable owner-defined projection coordinate."""
            coordinate: ID!
          ): String!
        }
    "#;
    let input = input_with(
        lower_schema_sdl(schema_sdl).expect("documented schema should lower"),
        list_schema_operations_sdl(schema_sdl).expect("documented operations should list"),
        Vec::new(),
        b"settings",
        vec!["projection"],
    );
    let schema: Value = serde_json::from_str(&read(
        "schemas/wesley-extension-generation-input-v2.schema.json",
    ))
    .unwrap();
    let validator = generation_schema_validator(&schema);
    let value = serde_json::to_value(&input).expect("generation input should serialize");

    let errors = validator
        .iter_errors(&value)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    assert!(errors.is_empty(), "documented Shape argument: {errors:#?}");
}
