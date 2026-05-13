use wesley_core::{
    compile_runtime_optic, compile_runtime_optic_registration, AdmissionTicket, ApertureConstraint,
    BasisConstraint, BudgetConstraint, CapabilityGrant, CapabilityPresentation, CodecField,
    DirectiveRecord, EvidenceKind, InMemoryOpticArtifactRegistry, LawVerdict, LawWitness,
    ObserverClass, OperationKind, OpticArtifactHandle, OpticArtifactResolver, PermissionAction,
    PermissionRequirement, PrincipalRef, ReplayHint, ResolveError,
};

#[test]
fn compiles_runtime_operation_into_domain_empty_optic_artifact() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = include_str!("../../../test/fixtures/runtime-optics/rename_symbol.graphql");

    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should compile");
    let repeated = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should compile repeatedly");
    let registration = compile_runtime_optic_registration(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic registration should compile");

    assert_eq!(artifact.schema_id.len(), 64);
    assert_eq!(artifact.artifact_id.len(), 64);
    assert_eq!(artifact.artifact_hash.len(), 64);
    assert_eq!(artifact.requirements_digest.len(), 64);
    assert_eq!(artifact.operation.operation_id.len(), 64);
    assert_eq!(
        artifact.operation.operation_id,
        repeated.operation.operation_id
    );
    assert_eq!(artifact.artifact_id, repeated.artifact_id);
    assert_eq!(artifact.artifact_hash, repeated.artifact_hash);
    assert_eq!(artifact.requirements_digest, repeated.requirements_digest);
    assert_eq!(artifact.registration, registration);
    assert_eq!(artifact.registration.artifact_id, artifact.artifact_id);
    assert_eq!(artifact.registration.artifact_hash, artifact.artifact_hash);
    assert_eq!(artifact.registration.schema_id, artifact.schema_id);
    assert_eq!(
        artifact.registration.operation_id,
        artifact.operation.operation_id
    );
    assert_eq!(
        artifact.registration.requirements_digest,
        artifact.requirements_digest
    );

    assert_eq!(artifact.operation.name.as_deref(), Some("RenameSymbol"));
    assert_eq!(artifact.operation.kind, OperationKind::Mutation);
    assert_eq!(artifact.operation.root_field, "renameSymbol");

    assert_contains_directive(
        &artifact.operation.directives,
        "Mutation.renameSymbol",
        "wes_law",
        serde_json::json!({ "id": "bounded.rewrite.v1" }),
    );
    assert_contains_directive(
        &artifact.operation.directives,
        "Mutation.renameSymbol",
        "wes_footprint",
        serde_json::json!({
            "reads": ["workspace.files", "symbol.index"],
            "writes": ["workspace.files"],
            "forbids": ["secrets", "git.refs"],
        }),
    );

    let footprint = artifact
        .operation
        .declared_footprint
        .as_ref()
        .expect("footprint should be extracted");
    assert_eq!(footprint.reads, vec!["workspace.files", "symbol.index"]);
    assert_eq!(footprint.writes, vec!["workspace.files"]);
    assert_eq!(footprint.forbids, vec!["secrets", "git.refs"]);

    let requirements = &artifact.requirements;
    assert!(requirements.identity.required);
    assert!(requirements.identity.accepted_principal_kinds.is_empty());
    assert_contains_permission(
        &requirements.required_permissions,
        PermissionAction::Read,
        "workspace.files",
    );
    assert_contains_permission(
        &requirements.required_permissions,
        PermissionAction::Read,
        "symbol.index",
    );
    assert_contains_permission(
        &requirements.required_permissions,
        PermissionAction::Write,
        "workspace.files",
    );
    assert_eq!(
        requirements.forbidden_resources,
        vec!["secrets", "git.refs"]
    );

    let input = find_codec_field(&artifact.operation.variable_shape.fields, "input");
    assert_eq!(
        artifact.operation.variable_shape.type_name,
        "RenameSymbolVariables"
    );
    assert_eq!(input.type_ref.base, "RenameSymbolInput");
    assert!(input.required);
    assert!(!input.list);

    assert_eq!(
        artifact.operation.payload_shape.type_name,
        "RenameSymbolResult"
    );
    let witness_digest = find_codec_field(
        &artifact.operation.payload_shape.fields,
        "receipt.witnessDigest",
    );
    assert_eq!(witness_digest.type_ref.base, "String");
    assert!(witness_digest.required);

    assert_contains_law_claim(&artifact, "shape.valid.v1");
    assert_contains_law_claim(&artifact, "codec.canonical.v1");
    assert_contains_law_claim(&artifact, "bounded.rewrite.v1");
    assert_contains_law_claim(&artifact, "footprint.closed.v1");
}

#[test]
fn resolves_artifact_by_registration_descriptor_and_rejects_tampering() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = include_str!("../../../test/fixtures/runtime-optics/rename_symbol.graphql");
    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should compile");
    let registration = artifact.registration.clone();

    let mut registry = InMemoryOpticArtifactRegistry::new();
    assert!(registry.is_empty());
    let stored_registration = registry.insert(artifact.clone());
    assert_eq!(registry.len(), 1);
    assert_eq!(stored_registration, registration);

    let resolved = registry
        .resolve_optic_artifact(&registration)
        .expect("registration descriptor should resolve");
    assert_eq!(resolved, artifact);

    let mut tampered_schema = registration.clone();
    tampered_schema.schema_id = "tampered-schema".to_string();
    assert!(matches!(
        registry.resolve_optic_artifact(&tampered_schema),
        Err(ResolveError::SchemaIdMismatch { .. })
    ));

    let mut tampered_artifact_hash = registration.clone();
    tampered_artifact_hash.artifact_hash = "tampered-artifact-hash".to_string();
    assert!(matches!(
        registry.resolve_optic_artifact(&tampered_artifact_hash),
        Err(ResolveError::ArtifactHashMismatch { .. })
    ));

    let mut tampered_operation = registration.clone();
    tampered_operation.operation_id = "tampered-operation-id".to_string();
    assert!(matches!(
        registry.resolve_optic_artifact(&tampered_operation),
        Err(ResolveError::OperationIdMismatch { .. })
    ));

    let mut tampered_requirements = registration.clone();
    tampered_requirements.requirements_digest = "tampered-requirements".to_string();
    assert!(matches!(
        registry.resolve_optic_artifact(&tampered_requirements),
        Err(ResolveError::RequirementsDigestMismatch { .. })
    ));

    let mut missing = registration;
    missing.artifact_id = "missing-artifact".to_string();
    assert!(matches!(
        registry.resolve_optic_artifact(&missing),
        Err(ResolveError::ArtifactNotFound { .. })
    ));
}

#[test]
fn registry_insert_normalizes_embedded_registration_descriptor() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = include_str!("../../../test/fixtures/runtime-optics/rename_symbol.graphql");
    let mut artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should compile");
    artifact.registration.schema_id = "tampered-embedded-schema".to_string();
    artifact.registration.requirements_digest = "tampered-embedded-requirements".to_string();

    let mut registry = InMemoryOpticArtifactRegistry::new();
    let stored_registration = registry.insert(artifact.clone());
    let resolved = registry
        .resolve_optic_artifact(&stored_registration)
        .expect("normalized registration should resolve");

    assert_eq!(stored_registration.schema_id, artifact.schema_id);
    assert_eq!(
        stored_registration.requirements_digest,
        artifact.requirements_digest
    );
    assert_eq!(resolved.registration, stored_registration);
}

#[test]
fn artifact_hashes_are_stable_and_sensitive_to_shape_and_requirements() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = include_str!("../../../test/fixtures/runtime-optics/rename_symbol.graphql");

    let baseline = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("baseline runtime optic should compile");
    let repeated = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("repeated runtime optic should compile");

    assert_eq!(baseline.artifact_hash, repeated.artifact_hash);
    assert_eq!(baseline.requirements_digest, repeated.requirements_digest);

    let reformatted = operation
        .replace("mutation RenameSymbol", "\nmutation   RenameSymbol")
        .replace("receipt {", "receipt   {");
    let reformatted_artifact = compile_runtime_optic(schema, &reformatted, Some("RenameSymbol"))
        .expect("reformatted runtime optic should compile");
    assert_eq!(baseline.artifact_hash, reformatted_artifact.artifact_hash);
    assert_eq!(
        baseline.requirements_digest,
        reformatted_artifact.requirements_digest
    );

    let footprint_changed = operation.replace("\"symbol.index\"", "\"diagnostics\"");
    let footprint_artifact =
        compile_runtime_optic(schema, &footprint_changed, Some("RenameSymbol"))
            .expect("footprint-changed runtime optic should compile");
    assert_ne!(
        baseline.requirements_digest, footprint_artifact.requirements_digest,
        "changing declared footprint must change requirements digest"
    );

    let law_changed = operation.replace("bounded.rewrite.v1", "bounded.rewrite.audit.v1");
    let law_artifact = compile_runtime_optic(schema, &law_changed, Some("RenameSymbol"))
        .expect("law-changed runtime optic should compile");
    assert_ne!(
        baseline.requirements_digest, law_artifact.requirements_digest,
        "changing law claim directives must change requirements digest"
    );

    let payload_changed = operation.replace("      resultRef\n", "");
    let payload_artifact = compile_runtime_optic(schema, &payload_changed, Some("RenameSymbol"))
        .expect("payload-changed runtime optic should compile");
    assert_ne!(
        baseline.artifact_hash, payload_artifact.artifact_hash,
        "changing selected payload shape must change artifact hash"
    );
}

#[test]
fn runtime_optic_rejects_invalid_root_argument_bindings() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let missing_required = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let unknown_argument = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input, unexpected: "nope") {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let wrong_variable_type = r#"
        mutation RenameSymbol($input: String!) {
          renameSymbol(input: $input) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        missing_required,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        unknown_argument,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        wrong_variable_type,
        Some("RenameSymbol"),
    ));
}

#[test]
fn runtime_optic_rejects_invalid_input_object_literals() {
    let schema = r#"
        type Mutation {
          configure(input: ConfigureInput!): ConfigureResult!
        }

        input ConfigureInput {
          path: String!
          mode: Mode!
          nested: NestedInput!
        }

        input NestedInput {
          label: String!
        }

        enum Mode {
          READ
          WRITE
        }

        type ConfigureResult {
          ok: Boolean!
        }
    "#;
    let valid = r#"
        mutation Configure {
          configure(input: {
            path: "src/lib.rs"
            mode: READ
            nested: { label: "core" }
          }) {
            ok
          }
        }
    "#;
    let missing_required = r#"
        mutation Configure {
          configure(input: {
            path: "src/lib.rs"
            mode: READ
          }) {
            ok
          }
        }
    "#;
    let unknown_field = r#"
        mutation Configure {
          configure(input: {
            path: "src/lib.rs"
            mode: READ
            nested: { label: "core" }
            surprise: "nope"
          }) {
            ok
          }
        }
    "#;
    let wrong_scalar = r#"
        mutation Configure {
          configure(input: {
            path: 1
            mode: READ
            nested: { label: "core" }
          }) {
            ok
          }
        }
    "#;
    let invalid_enum_value = r#"
        mutation Configure {
          configure(input: {
            path: "src/lib.rs"
            mode: EXECUTE
            nested: { label: "core" }
          }) {
            ok
          }
        }
    "#;
    let enum_for_input_object = r#"
        mutation Configure {
          configure(input: READ) {
            ok
          }
        }
    "#;

    compile_runtime_optic(schema, valid, Some("Configure"))
        .expect("valid input object literal should compile");
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        missing_required,
        Some("Configure"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        unknown_field,
        Some("Configure"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        wrong_scalar,
        Some("Configure"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        invalid_enum_value,
        Some("Configure"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        enum_for_input_object,
        Some("Configure"),
    ));
}

#[test]
fn runtime_optic_rejects_invalid_subselection_shapes() {
    let schema = r#"
        type Query {
          profile: Profile!
          version: String!
        }

        type Profile {
          id: ID!
          name: String!
        }
    "#;
    let valid_composite = r#"
        query Profile {
          profile {
            id
          }
        }
    "#;
    let valid_leaf = r#"
        query Version {
          version
        }
    "#;
    let composite_without_selection = r#"
        query Profile {
          profile
        }
    "#;
    let leaf_with_selection = r#"
        query Version {
          version {
            length
          }
        }
    "#;
    let nested_leaf_with_selection = r#"
        query Profile {
          profile {
            id {
              value
            }
          }
        }
    "#;

    compile_runtime_optic(schema, valid_composite, Some("Profile"))
        .expect("composite field with subselection should compile");
    compile_runtime_optic(schema, valid_leaf, Some("Version"))
        .expect("leaf field without subselection should compile");
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        composite_without_selection,
        Some("Profile"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        leaf_with_selection,
        Some("Version"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        nested_leaf_with_selection,
        Some("Profile"),
    ));
}

#[test]
fn runtime_optic_rejects_impossible_fragment_type_conditions() {
    let schema = r#"
        type Query {
          search: SearchResult!
        }

        union SearchResult = File | Issue

        type File {
          path: String!
        }

        type Issue {
          title: String!
        }

        type User {
          name: String!
        }
    "#;
    let valid = r#"
        query Search {
          search {
            ... on File {
              path
            }
          }
        }
    "#;
    let impossible_inline_fragment = r#"
        query Search {
          search {
            ... on User {
              name
            }
          }
        }
    "#;
    let impossible_fragment_spread = r#"
        query Search {
          search {
            ...UserFields
          }
        }

        fragment UserFields on User {
          name
        }
    "#;

    compile_runtime_optic(schema, valid, Some("Search"))
        .expect("compatible fragment type condition should compile");
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        impossible_inline_fragment,
        Some("Search"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        impossible_fragment_spread,
        Some("Search"),
    ));
}

#[test]
fn runtime_optic_rejects_flat_literals_for_nested_list_arguments() {
    let schema = r#"
        type Mutation {
          configure(input: MatrixInput!): ConfigureResult!
        }

        input MatrixInput {
          matrix: [[Int!]!]!
        }

        type ConfigureResult {
          ok: Boolean!
        }
    "#;
    let valid = r#"
        mutation Configure {
          configure(input: {
            matrix: [[1, 2], [3]]
          }) {
            ok
          }
        }
    "#;
    let flat_matrix = r#"
        mutation Configure {
          configure(input: {
            matrix: [1, 2, 3]
          }) {
            ok
          }
        }
    "#;

    compile_runtime_optic(schema, valid, Some("Configure"))
        .expect("nested list literal should compile");
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        flat_matrix,
        Some("Configure"),
    ));
}

#[test]
fn runtime_optic_requires_reads_and_writes_when_footprint_is_present() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let missing_reads = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(writes: ["workspace.files"]) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let missing_writes = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(reads: ["workspace.files"]) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let without_forbids = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(
              reads: ["workspace.files"]
              writes: ["workspace.files"]
            ) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        missing_reads,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        missing_writes,
        Some("RenameSymbol"),
    ));

    let artifact = compile_runtime_optic(schema, without_forbids, Some("RenameSymbol"))
        .expect("footprint without forbids should compile");
    let footprint = artifact
        .operation
        .declared_footprint
        .expect("footprint should be extracted");
    assert_eq!(footprint.reads, vec!["workspace.files"]);
    assert_eq!(footprint.writes, vec!["workspace.files"]);
    assert!(footprint.forbids.is_empty());
}

#[test]
fn runtime_optic_rejects_duplicate_footprint_labels() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let duplicate_reads = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(
              reads: ["workspace.files", "workspace.files"]
              writes: ["workspace.files"]
            ) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let duplicate_writes = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(
              reads: ["workspace.files"]
              writes: ["workspace.files", "workspace.files"]
            ) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let duplicate_forbids = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(
              reads: ["workspace.files"]
              writes: ["workspace.files"]
              forbids: ["secrets", "secrets"]
            ) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        duplicate_reads,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        duplicate_writes,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        duplicate_forbids,
        Some("RenameSymbol"),
    ));
}

#[test]
fn runtime_optic_rejects_non_root_footprint_directives() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let nested_only = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input) {
            receipt
              @wes_footprint(
                reads: ["receipt.local"]
                writes: []
              ) {
              witnessDigest
            }
          }
        }
    "#;
    let root_and_nested = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input)
            @wes_footprint(
              reads: ["workspace.files"]
              writes: ["workspace.files"]
            ) {
            receipt
              @wes_footprint(
                reads: ["receipt.local"]
                writes: []
              ) {
              witnessDigest
            }
          }
        }
    "#;

    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        nested_only,
        Some("RenameSymbol"),
    ));
    assert_operation_lowering_error(compile_runtime_optic(
        schema,
        root_and_nested,
        Some("RenameSymbol"),
    ));
}

#[test]
fn root_argument_bindings_are_preserved_and_affect_operation_identity() {
    let schema = r#"
        type Mutation {
          combine(left: String!, right: String!): CombineResult!
        }

        type CombineResult {
          receipt: RewriteReceipt!
        }

        type RewriteReceipt {
          witnessDigest: String!
        }
    "#;
    let left_right = r#"
        mutation Combine($left: String!, $right: String!) {
          combine(left: $left, right: $right) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;
    let right_left = r#"
        mutation Combine($left: String!, $right: String!) {
          combine(left: $right, right: $left) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    let left_right_artifact = compile_runtime_optic(schema, left_right, Some("Combine"))
        .expect("left-right runtime optic should compile");
    let right_left_artifact = compile_runtime_optic(schema, right_left, Some("Combine"))
        .expect("right-left runtime optic should compile");

    assert_eq!(left_right_artifact.operation.root_arguments.len(), 2);
    assert_eq!(left_right_artifact.operation.root_arguments[0].name, "left");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(
            &left_right_artifact.operation.root_arguments[0].value_canonical_json,
        )
        .expect("root argument value should be JSON"),
        serde_json::json!({ "$variable": "left" })
    );
    assert_ne!(
        left_right_artifact.operation.operation_id, right_left_artifact.operation.operation_id,
        "different root argument bindings must produce different operation identities"
    );
}

#[test]
fn selection_field_arguments_affect_operation_identity() {
    let schema = r#"
        type Query {
          library: Library!
        }

        type Library {
          item(id: ID!): Item!
        }

        type Item {
          name: String!
        }
    "#;
    let alpha = r#"
        query LibraryItem {
          library {
            item(id: "alpha") {
              name
            }
          }
        }
    "#;
    let beta = r#"
        query LibraryItem {
          library {
            item(id: "beta") {
              name
            }
          }
        }
    "#;

    let alpha_artifact = compile_runtime_optic(schema, alpha, Some("LibraryItem"))
        .expect("alpha item runtime optic should compile");
    let beta_artifact = compile_runtime_optic(schema, beta, Some("LibraryItem"))
        .expect("beta item runtime optic should compile");
    let argument_binding = alpha_artifact
        .operation
        .selection_arguments
        .first()
        .expect("selected field argument should be preserved");

    assert_eq!(argument_binding.path, "item");
    assert_eq!(argument_binding.name, "id");
    assert_eq!(argument_binding.type_ref.base, "ID");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&argument_binding.value_canonical_json)
            .expect("selection argument value should be JSON"),
        serde_json::json!("alpha")
    );
    assert_ne!(
        alpha_artifact.operation.operation_id, beta_artifact.operation.operation_id,
        "field argument values must contribute to operation identity"
    );
    assert_ne!(
        alpha_artifact.artifact_hash, beta_artifact.artifact_hash,
        "field argument values must contribute to artifact identity"
    );
}

#[test]
fn runtime_optic_preserves_operation_nested_and_fragment_directives() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = r#"
        mutation RenameSymbol($input: RenameSymbolInput!)
          @wes_law(id: "operation.audit.v1") {
          renameSymbol(input: $input)
            @wes_law(id: "bounded.rewrite.v1") {
            receipt {
              ...ReceiptWitness @wes_law(id: "fragment.spread.v1")
            }
          }
        }

        fragment ReceiptWitness on RewriteReceipt
          @wes_law(id: "fragment.definition.v1") {
          witnessDigest @wes_law(id: "payload.witness.v1")
        }
    "#;

    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic with scattered directives should compile");

    assert_contains_directive(
        &artifact.operation.directives,
        "Operation.RenameSymbol",
        "wes_law",
        serde_json::json!({ "id": "operation.audit.v1" }),
    );
    assert_contains_directive(
        &artifact.operation.directives,
        "RenameSymbolResult.receipt...ReceiptWitness",
        "wes_law",
        serde_json::json!({ "id": "fragment.spread.v1" }),
    );
    assert_contains_directive(
        &artifact.operation.directives,
        "Fragment.ReceiptWitness",
        "wes_law",
        serde_json::json!({ "id": "fragment.definition.v1" }),
    );
    assert_contains_directive(
        &artifact.operation.directives,
        "RewriteReceipt.witnessDigest",
        "wes_law",
        serde_json::json!({ "id": "payload.witness.v1" }),
    );
    assert_contains_law_claim(&artifact, "operation.audit.v1");
    assert_contains_law_claim(&artifact, "fragment.spread.v1");
    assert_contains_law_claim(&artifact, "fragment.definition.v1");
    assert_contains_law_claim(&artifact, "payload.witness.v1");
}

#[test]
fn payload_shape_uses_response_aliases() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input) {
            receipt {
              digest: witnessDigest
            }
          }
        }
    "#;
    let unaliased_operation = r#"
        mutation RenameSymbol($input: RenameSymbolInput!) {
          renameSymbol(input: $input) {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("aliased runtime optic should compile");
    let unaliased_artifact =
        compile_runtime_optic(schema, unaliased_operation, Some("RenameSymbol"))
            .expect("unaliased runtime optic should compile");

    let digest = find_codec_field(&artifact.operation.payload_shape.fields, "receipt.digest");
    assert_eq!(digest.type_ref.base, "String");
    assert!(
        !artifact
            .operation
            .payload_shape
            .fields
            .iter()
            .any(|field| field.name == "receipt.witnessDigest"),
        "aliased payload shape should use response names, not schema field names"
    );
    assert_ne!(
        artifact.artifact_hash, unaliased_artifact.artifact_hash,
        "changing response aliases must change artifact hash"
    );
}

#[test]
fn payload_shape_preserves_duplicate_schema_fields_with_distinct_aliases() {
    let schema = r#"
        type Query {
          library: Library!
        }

        type Library {
          item(id: ID!): Item!
        }

        type Item {
          name: String!
        }
    "#;
    let operation = r#"
        query LibraryItems {
          library {
            alpha: item(id: "alpha") {
              name
            }
            beta: item(id: "beta") {
              name
            }
          }
        }
    "#;

    let artifact = compile_runtime_optic(schema, operation, Some("LibraryItems"))
        .expect("multi-alias runtime optic should compile");

    let alpha_name = find_codec_field(&artifact.operation.payload_shape.fields, "alpha.name");
    let beta_name = find_codec_field(&artifact.operation.payload_shape.fields, "beta.name");
    let argument_paths = artifact
        .operation
        .selection_arguments
        .iter()
        .map(|argument| argument.path.as_str())
        .collect::<Vec<_>>();

    assert_eq!(alpha_name.type_ref.base, "String");
    assert_eq!(beta_name.type_ref.base, "String");
    assert_eq!(argument_paths, vec!["alpha", "beta"]);
    assert!(
        !artifact
            .operation
            .payload_shape
            .fields
            .iter()
            .any(|field| field.name == "item.name"),
        "duplicate aliased selections should not collapse to schema field paths"
    );
}

#[test]
fn nested_payload_requiredness_respects_nullable_ancestors() {
    let schema = r#"
        type Query {
          maybeResult: MaybeResult!
        }

        type MaybeResult {
          receipt: RewriteReceipt
        }

        type RewriteReceipt {
          witnessDigest: String!
        }
    "#;
    let operation = r#"
        query MaybeResult {
          maybeResult {
            receipt {
              witnessDigest
            }
          }
        }
    "#;

    let artifact = compile_runtime_optic(schema, operation, Some("MaybeResult"))
        .expect("nullable-parent runtime optic should compile");
    let receipt = find_codec_field(&artifact.operation.payload_shape.fields, "receipt");
    let witness_digest = find_codec_field(
        &artifact.operation.payload_shape.fields,
        "receipt.witnessDigest",
    );

    assert!(
        !receipt.required,
        "nullable parent field should not be marked required"
    );
    assert!(
        !witness_digest.required,
        "child path under nullable parent should not be marked required"
    );
}

#[test]
fn runtime_optic_preserves_variable_backed_executable_directives() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = r#"
        mutation RenameSymbol($input: RenameSymbolInput!, $includeDigest: Boolean!) {
          renameSymbol(input: $input) {
            receipt {
              witnessDigest @include(if: $includeDigest)
            }
          }
        }
    "#;

    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should preserve variable-backed executable directive");

    assert_contains_directive(
        &artifact.operation.directives,
        "RewriteReceipt.witnessDigest",
        "include",
        serde_json::json!({ "if": { "$variable": "includeDigest" } }),
    );
}

#[test]
fn optic_wire_shapes_serialize_with_stable_field_names() {
    let schema = include_str!("../../../test/fixtures/runtime-optics/workspace_schema.graphql");
    let operation = include_str!("../../../test/fixtures/runtime-optics/rename_symbol.graphql");
    let artifact = compile_runtime_optic(schema, operation, Some("RenameSymbol"))
        .expect("runtime optic should compile");
    let echo_handle = OpticArtifactHandle {
        kind: "optic-artifact-handle".to_string(),
        id: "echo.local.handle.1".to_string(),
    };
    let subject = PrincipalRef {
        kind: "agent".to_string(),
        id: "codex".to_string(),
    };
    let issuer = PrincipalRef {
        kind: "host".to_string(),
        id: "jedit".to_string(),
    };
    let grant = CapabilityGrant {
        grant_id: "grant-1".to_string(),
        subject: subject.clone(),
        artifact_hash: artifact.artifact_hash.clone(),
        operation_id: artifact.operation.operation_id.clone(),
        requirements_digest: artifact.requirements_digest.clone(),
        allowed_basis: Some(BasisConstraint {
            basis_ref: Some("basis-1".to_string()),
            max_staleness_ms: Some(250),
        }),
        allowed_apertures: vec![ApertureConstraint {
            kind: "file_range".to_string(),
            limit: Some(4096),
        }],
        budget: BudgetConstraint {
            max_operations: Some(1),
            max_bytes: Some(4096),
            max_millis: Some(1000),
        },
        expires_at: Some("2026-05-12T00:05:00Z".to_string()),
        rights: vec!["READ".to_string(), "WRITE".to_string()],
        issuer: issuer.clone(),
        issuer_signature: Some("issuer-signature-1".to_string()),
        delegation_chain_digest: Some("delegation-digest-1".to_string()),
        observer_class: Some(ObserverClass::Oc2),
        non_transferable: true,
    };
    let presentation = CapabilityPresentation {
        grant_id: "grant-1".to_string(),
        subject: subject.clone(),
        artifact_handle_id: echo_handle.id.clone(),
        operation_id: artifact.operation.operation_id.clone(),
        variables_digest: "vars-digest-1".to_string(),
        basis_request_digest: None,
        nonce: "nonce-1".to_string(),
        presented_at: "2026-05-12T00:00:00Z".to_string(),
        proof_digest: None,
    };
    let ticket = AdmissionTicket {
        ticket_id: "ticket-1".to_string(),
        artifact_handle: echo_handle.clone(),
        capability_grant_id: presentation.grant_id.clone(),
        operation_id: artifact.operation.operation_id.clone(),
        invocation_digest: "invocation-digest-1".to_string(),
        issued_at: "2026-05-12T00:00:01Z".to_string(),
        expires_at: None,
    };
    let witness = LawWitness {
        law_id: "footprint.closed.v1".to_string(),
        claim_id: "claim-1".to_string(),
        basis_ref: Some("basis-1".to_string()),
        checker_id: "echo.fixture.v0".to_string(),
        checker_artifact_hash: Some("checker-hash-1".to_string()),
        verdict: LawVerdict::Obstructed,
        evidence_digests: vec!["evidence-digest-1".to_string()],
        runtime_trace_digest: Some("trace-digest-1".to_string()),
        obstruction_reason: Some("forbidden resource touched".to_string()),
        replay_hints: vec![ReplayHint {
            kind: "trace".to_string(),
            value: "trace://fixture/1".to_string(),
        }],
    };

    assert_eq!(
        serde_json::to_value(&artifact.registration).expect("registration should serialize"),
        serde_json::json!({
            "artifactId": artifact.artifact_id,
            "artifactHash": artifact.artifact_hash,
            "schemaId": artifact.schema_id,
            "operationId": artifact.operation.operation_id,
            "requirementsDigest": artifact.requirements_digest,
        })
    );
    assert_eq!(
        serde_json::to_value(&echo_handle).expect("handle should serialize"),
        serde_json::json!({
            "kind": "optic-artifact-handle",
            "id": "echo.local.handle.1",
        })
    );
    assert_eq!(
        serde_json::to_value(&grant).expect("grant should serialize"),
        serde_json::json!({
            "grantId": "grant-1",
            "subject": {
                "kind": "agent",
                "id": "codex",
            },
            "artifactHash": artifact.artifact_hash,
            "operationId": artifact.operation.operation_id,
            "requirementsDigest": artifact.requirements_digest,
            "allowedBasis": {
                "basisRef": "basis-1",
                "maxStalenessMs": 250,
            },
            "allowedApertures": [
                {
                    "kind": "file_range",
                    "limit": 4096,
                }
            ],
            "budget": {
                "maxOperations": 1,
                "maxBytes": 4096,
                "maxMillis": 1000,
            },
            "expiresAt": "2026-05-12T00:05:00Z",
            "rights": ["READ", "WRITE"],
            "issuer": {
                "kind": "host",
                "id": "jedit",
            },
            "issuerSignature": "issuer-signature-1",
            "delegationChainDigest": "delegation-digest-1",
            "observerClass": "OC2",
            "nonTransferable": true,
        })
    );
    assert_eq!(
        serde_json::to_value(&presentation).expect("presentation should serialize"),
        serde_json::json!({
            "grantId": "grant-1",
            "subject": {
                "kind": "agent",
                "id": "codex",
            },
            "artifactHandleId": "echo.local.handle.1",
            "operationId": artifact.operation.operation_id,
            "variablesDigest": "vars-digest-1",
            "nonce": "nonce-1",
            "presentedAt": "2026-05-12T00:00:00Z",
        })
    );
    assert_eq!(
        serde_json::to_value(&ticket).expect("ticket should serialize"),
        serde_json::json!({
            "ticketId": "ticket-1",
            "artifactHandle": {
                "kind": "optic-artifact-handle",
                "id": "echo.local.handle.1",
            },
            "capabilityGrantId": "grant-1",
            "operationId": artifact.operation.operation_id,
            "invocationDigest": "invocation-digest-1",
            "issuedAt": "2026-05-12T00:00:01Z",
        })
    );
    assert_eq!(
        serde_json::to_value(&witness).expect("witness should serialize"),
        serde_json::json!({
            "lawId": "footprint.closed.v1",
            "claimId": "claim-1",
            "basisRef": "basis-1",
            "checkerId": "echo.fixture.v0",
            "checkerArtifactHash": "checker-hash-1",
            "verdict": "OBSTRUCTED",
            "evidenceDigests": ["evidence-digest-1"],
            "runtimeTraceDigest": "trace-digest-1",
            "obstructionReason": "forbidden resource touched",
            "replayHints": [
                {
                    "kind": "trace",
                    "value": "trace://fixture/1",
                }
            ],
        })
    );
    assert_eq!(
        serde_json::to_value(ObserverClass::Oc0).expect("observer class should serialize"),
        serde_json::json!("OC0")
    );
    assert_eq!(
        serde_json::to_value(ObserverClass::Oc1).expect("observer class should serialize"),
        serde_json::json!("OC1")
    );
    assert_eq!(
        serde_json::to_value(ObserverClass::Oc2).expect("observer class should serialize"),
        serde_json::json!("OC2")
    );
    assert_eq!(
        serde_json::to_value(ObserverClass::Oc3).expect("observer class should serialize"),
        serde_json::json!("OC3")
    );
    assert_eq!(
        serde_json::to_value(PermissionAction::Read).expect("permission action should serialize"),
        serde_json::json!("READ")
    );
    assert_eq!(
        serde_json::to_value(EvidenceKind::RuntimeTrace).expect("evidence kind should serialize"),
        serde_json::json!("RUNTIME_TRACE")
    );
    assert_eq!(
        serde_json::to_value(LawVerdict::Unknown).expect("law verdict should serialize"),
        serde_json::json!("UNKNOWN")
    );
}

fn assert_contains_directive(
    directives: &[DirectiveRecord],
    coordinate: &str,
    name: &str,
    arguments: serde_json::Value,
) {
    let directive = directives
        .iter()
        .find(|directive| directive.coordinate == coordinate && directive.name == name)
        .unwrap_or_else(|| panic!("directive {coordinate} @{name} should be preserved"));
    let actual: serde_json::Value = serde_json::from_str(&directive.arguments_canonical_json)
        .expect("directive arguments should be JSON");
    assert_eq!(actual, arguments);
}

fn find_codec_field<'a>(fields: &'a [CodecField], name: &str) -> &'a CodecField {
    fields
        .iter()
        .find(|field| field.name == name)
        .unwrap_or_else(|| panic!("codec field {name} should exist"))
}

fn assert_contains_law_claim(artifact: &wesley_core::OpticArtifact, law_id: &str) {
    let claim = artifact
        .operation
        .law_claims
        .iter()
        .find(|claim| claim.law_id == law_id)
        .unwrap_or_else(|| panic!("law claim {law_id} should exist"));
    assert_eq!(claim.operation_id, artifact.operation.operation_id);
    assert_eq!(claim.claim_id.len(), 64);
}

fn assert_contains_permission(
    permissions: &[PermissionRequirement],
    action: PermissionAction,
    resource: &str,
) {
    assert!(
        permissions
            .iter()
            .any(|permission| permission.action == action && permission.resource == resource),
        "permission {action:?} {resource} should exist"
    );
}

fn assert_operation_lowering_error(
    result: Result<wesley_core::OpticArtifact, wesley_core::WesleyError>,
) {
    match result {
        Err(wesley_core::WesleyError::LoweringError { area, .. }) => {
            assert_eq!(area, "operation");
        }
        Err(error) => panic!("expected operation lowering error, got {error:?}"),
        Ok(_) => panic!("runtime optic should reject invalid operation"),
    }
}
