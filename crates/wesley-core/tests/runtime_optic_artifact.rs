use wesley_core::{
    compile_runtime_optic, compile_runtime_optic_registration, AdmissionTicket,
    CapabilityPresentation, CodecField, DirectiveRecord, InMemoryOpticArtifactRegistry,
    ObserverClass, OperationKind, OpticArtifactHandle, OpticArtifactResolver, PermissionAction,
    PermissionRequirement, PrincipalRef, ResolveError,
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

    assert_error_contains(
        compile_runtime_optic(schema, missing_required, Some("RenameSymbol")),
        "missing required argument 'input'",
    );
    assert_error_contains(
        compile_runtime_optic(schema, unknown_argument, Some("RenameSymbol")),
        "unknown argument 'unexpected'",
    );
    assert_error_contains(
        compile_runtime_optic(schema, wrong_variable_type, Some("RenameSymbol")),
        "Variable '$input' has type 'String!' but argument 'input' expects 'RenameSymbolInput!'",
    );
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

fn assert_error_contains(
    result: Result<wesley_core::OpticArtifact, wesley_core::WesleyError>,
    needle: &str,
) {
    let error = result.expect_err("runtime optic should reject invalid operation");
    let message = error.to_string();
    assert!(
        message.contains(needle),
        "expected error '{message}' to contain '{needle}'"
    );
}
