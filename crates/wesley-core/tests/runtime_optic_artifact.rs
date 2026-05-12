use wesley_core::{
    compile_runtime_optic, compile_runtime_optic_registration, CodecField, DirectiveRecord,
    InMemoryOpticArtifactRegistry, OperationKind, OpticArtifactResolver, PermissionAction,
    PermissionRequirement, ResolveError,
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
