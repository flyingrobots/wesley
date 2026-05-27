use wesley_holmes::{
    ArtifactFamily, ArtifactLoadPort, ArtifactRef, ArtifactWritePort, BundleProvenance, ClockPort,
    CommandIoPort, EchoReportRenderer, FilesystemPort, FixedClock, HolmesDiagnosticCode,
    HolmesLawEvidenceBundle, InMemoryArtifactStore, LawEvidenceArtifacts,
    LawEvidenceValidationStatus, LawEvidenceValidator, McpResourcePort, RecordingCommandIo,
    ReportRenderPort, Timestamp, VersionRegistry, VersionRequirement, WeslawArtifactLocator,
};

#[test]
fn fixed_clock_returns_deterministic_timestamp() {
    let clock = FixedClock::new(Timestamp::new("2026-05-26T00:00:00Z"));

    assert_eq!(clock.now(), Timestamp::new("2026-05-26T00:00:00Z"));
}

#[test]
fn in_memory_artifact_store_reads_and_writes() {
    let mut store = InMemoryArtifactStore::default();
    store.insert("evidence/law-diff.json", b"diff".to_vec());

    let bytes = store
        .read_artifact(&ArtifactRef::new("evidence/law-diff.json"))
        .expect("artifact should be readable");
    store
        .write_artifact("reports/summary.md", b"summary")
        .expect("artifact should be writable");

    assert_eq!(bytes, b"diff");
    assert_eq!(store.written("reports/summary.md"), Some(&b"summary"[..]));
    assert_eq!(
        store
            .read_artifact(&ArtifactRef::new("reports/summary.md"))
            .expect("written artifact should be readable"),
        b"summary"
    );
}

#[test]
fn filesystem_port_uses_workspace_relative_bytes_without_real_filesystem() {
    let mut store = InMemoryArtifactStore::default();
    store.insert("policy/release.json", b"policy".to_vec());

    let bytes = store
        .read_workspace_file("policy/release.json")
        .expect("workspace file should be readable");
    store
        .write_workspace_file("reports/holmes.md", b"report")
        .expect("workspace file should be writable");

    assert_eq!(bytes, b"policy");
    assert_eq!(store.written("reports/holmes.md"), Some(&b"report"[..]));
    assert_eq!(
        store
            .read_workspace_file("reports/holmes.md")
            .expect("written workspace file should be readable"),
        b"report"
    );
}

#[test]
fn evidence_bundle_requires_core_artifacts() {
    let bundle = evidence_bundle_with_law_diff_path("");

    let diagnostic = bundle
        .validate_required_artifacts()
        .expect_err("blank law diff path should fail validation");

    assert_eq!(
        diagnostic.code,
        HolmesDiagnosticCode::HlawEvidenceBundleInvalid
    );
    assert_eq!(diagnostic.field_path.as_deref(), Some("artifacts.lawDiff"));
}

#[test]
fn evidence_bundle_structure_validation_collects_required_optional_and_duplicate_errors() {
    let mut bundle = valid_evidence_bundle();
    bundle.bundle_id = "  ".to_owned();
    bundle.artifacts.law_diff.path = "evidence/shared.json".to_owned();
    bundle.artifacts.law_coverage.path = "evidence/shared.json".to_owned();
    bundle.artifacts.law_capabilities.path = "".to_owned();
    bundle.artifacts.policy = Some(ArtifactRef::new(" "));

    let result = bundle.validate_structure(&VersionRegistry::default());

    assert_eq!(result.status, LawEvidenceValidationStatus::Invalid);
    assert_diagnostic_field(&result.diagnostics, "bundleId");
    assert_diagnostic_field(&result.diagnostics, "artifacts.lawCapabilities");
    assert_diagnostic_field(&result.diagnostics, "artifacts.policy");
    assert_diagnostic_field(&result.diagnostics, "artifacts.lawCoverage");
}

#[test]
fn evidence_bundle_provenance_validation_requires_canonical_hashes_and_source() {
    let mut bundle = valid_evidence_bundle();
    bundle.provenance.schema_hash = "schema".to_owned();
    bundle.provenance.law_hash = format!("sha256:{}z", "a".repeat(63));
    bundle.provenance.policy_hash = Some(" ".to_owned());
    bundle.provenance.bundle_hash = format!("sha1:{}", "b".repeat(64));
    bundle.provenance.source = "\t".to_owned();

    let result = bundle.validate_structure(&VersionRegistry::default());

    assert_eq!(result.status, LawEvidenceValidationStatus::Invalid);
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawProvenanceHashMalformed,
    );
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawProvenanceHashMissing,
    );
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawProvenanceSourceMissing,
    );
    assert_diagnostic_field(&result.diagnostics, "provenance.schemaHash");
    assert_diagnostic_field(&result.diagnostics, "provenance.lawHash");
    assert_diagnostic_field(&result.diagnostics, "provenance.policyHash");
    assert_diagnostic_field(&result.diagnostics, "provenance.bundleHash");
    assert_diagnostic_field(&result.diagnostics, "provenance.source");
}

#[test]
fn version_fixture_matrix_covers_current_deprecated_malformed_unsupported_and_mixed_artifacts() {
    let registry = VersionRegistry::default().with_requirement(
        VersionRequirement::new(ArtifactFamily::EvidenceBundle, 1, 1)
            .with_deprecated_minor_through(0),
    );

    let deprecated = valid_evidence_bundle();
    let deprecated_result = deprecated.validate_structure(&registry);
    assert_eq!(
        deprecated_result.status,
        LawEvidenceValidationStatus::ValidWithWarnings
    );
    assert_diagnostic(
        &deprecated_result.diagnostics,
        HolmesDiagnosticCode::HlawSchemaVersionDeprecated,
    );

    let mut current = valid_evidence_bundle();
    current.schema_version = "1.1.0".to_owned();
    assert_eq!(
        current.validate_structure(&registry).status,
        LawEvidenceValidationStatus::Valid
    );

    let mut malformed = valid_evidence_bundle();
    malformed.schema_version = "v1.0.0".to_owned();
    assert_diagnostic(
        &malformed.validate_structure(&registry).diagnostics,
        HolmesDiagnosticCode::HlawSchemaVersionMalformed,
    );

    let mut unsupported = valid_evidence_bundle();
    unsupported.schema_version = "1.2.0".to_owned();
    assert_diagnostic(
        &unsupported.validate_structure(&registry).diagnostics,
        HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMinor,
    );

    let mut mixed_generation = valid_evidence_bundle();
    mixed_generation.artifacts.law_diff.schema_version = Some("2.0.0".to_owned());
    let mixed_result = mixed_generation.validate_structure(&registry);
    assert_diagnostic(
        &mixed_result.diagnostics,
        HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMajor,
    );
    assert_diagnostic_field(&mixed_result.diagnostics, "artifacts.lawDiff.schemaVersion");
}

#[test]
fn law_evidence_validator_reports_artifact_availability_size_and_read_errors() {
    let bundle = valid_evidence_bundle();
    let mut store = InMemoryArtifactStore::default();
    store.insert("evidence/law-diff.json", b"oversized".to_vec());
    store.mark_unreadable("evidence/law-capabilities.json", "permission denied");
    store.insert("evidence/bundle-manifest.json", b"manifest".to_vec());

    let validator =
        LawEvidenceValidator::new(WeslawArtifactLocator::new("/workspace")).with_max_bytes(8);
    let result = validator.validate(&bundle, &store, &VersionRegistry::default());

    assert_eq!(result.status, LawEvidenceValidationStatus::Invalid);
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawArtifactOversized,
    );
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawArtifactUnavailable,
    );
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawArtifactUnreadable,
    );
    assert_eq!(result.loaded_artifacts.len(), 1);
    assert_eq!(
        result.loaded_artifacts[0].field_path,
        "artifacts.contractBundleManifest"
    );
}

#[test]
fn first_law_evidence_validation_gate_accepts_clean_bundle_and_artifacts() {
    let bundle = valid_evidence_bundle();
    let mut store = InMemoryArtifactStore::default();
    for artifact in [
        &bundle.artifacts.law_diff,
        &bundle.artifacts.law_coverage,
        &bundle.artifacts.law_capabilities,
        &bundle.artifacts.contract_bundle_manifest,
    ] {
        store.insert(&artifact.path, b"{}".to_vec());
    }

    let validator =
        LawEvidenceValidator::new(WeslawArtifactLocator::new("/workspace")).with_max_bytes(1024);
    let result = validator.validate(&bundle, &store, &VersionRegistry::default());

    assert_eq!(result.status, LawEvidenceValidationStatus::Valid);
    assert!(result.diagnostics.is_empty());
    assert_eq!(result.loaded_artifacts.len(), 4);
    assert_eq!(result.loaded_artifacts[0].field_path, "artifacts.lawDiff");
}

#[test]
fn artifact_locator_normalizes_workspace_relative_paths() {
    let locator = WeslawArtifactLocator::new("/workspace");

    let resolved = locator
        .resolve("./evidence/../evidence/law-diff.json")
        .expect("path should normalize inside workspace");

    assert_eq!(resolved.workspace_relative, "evidence/law-diff.json");
}

#[test]
fn artifact_locator_rejects_escape_and_absolute_paths() {
    let locator = WeslawArtifactLocator::new("/workspace");

    let escape = locator
        .resolve("../outside.json")
        .expect_err("parent traversal should be rejected");
    let absolute = locator
        .resolve("/tmp/outside.json")
        .expect_err("absolute paths should be rejected");

    assert_eq!(escape.code, HolmesDiagnosticCode::HlawArtifactPathEscape);
    assert_eq!(absolute.code, HolmesDiagnosticCode::HlawArtifactPathEscape);
}

#[test]
fn artifact_locator_rejects_backslash_and_windows_drive_paths() {
    let locator = WeslawArtifactLocator::new("/workspace");

    for path in [
        "..\\outside.json",
        "C:\\tmp\\outside.json",
        "\\\\server\\share\\outside.json",
        "C:/tmp/outside.json",
    ] {
        let diagnostic = locator
            .resolve(path)
            .expect_err("platform-specific path syntax should be rejected");
        assert_eq!(
            diagnostic.code,
            HolmesDiagnosticCode::HlawArtifactPathEscape
        );
    }
}

#[test]
fn version_registry_accepts_current_versions() {
    let registry = VersionRegistry::default();

    for family in [
        ArtifactFamily::EvidenceBundle,
        ArtifactFamily::LawDiff,
        ArtifactFamily::LawCoverage,
        ArtifactFamily::LawCapabilities,
        ArtifactFamily::ContractBundleManifest,
        ArtifactFamily::Policy,
        ArtifactFamily::Report,
        ArtifactFamily::AuditWitness,
        ArtifactFamily::McpResponse,
        ArtifactFamily::AgentSummary,
        ArtifactFamily::GithubPayload,
    ] {
        let parsed = registry
            .validate(family, Some("1.0.0"))
            .expect("current schema version should be accepted");
        assert_eq!(parsed.major, 1);
        assert_eq!(parsed.minor, 0);
        assert_eq!(parsed.patch, 0);
    }
}

#[test]
fn version_registry_rejects_missing_malformed_and_unsupported_versions() {
    let registry = VersionRegistry::default();

    let missing = registry
        .validate(ArtifactFamily::EvidenceBundle, None)
        .expect_err("missing schema version should fail");
    let malformed = registry
        .validate(ArtifactFamily::EvidenceBundle, Some("v1.0.0"))
        .expect_err("malformed schema version should fail");
    let unsupported_major = registry
        .validate(ArtifactFamily::EvidenceBundle, Some("2.0.0"))
        .expect_err("unsupported major should fail");
    let unsupported_minor = registry
        .validate(ArtifactFamily::EvidenceBundle, Some("1.1.0"))
        .expect_err("unsupported minor should fail");
    let leading_zero = registry
        .validate(ArtifactFamily::EvidenceBundle, Some("01.0.0"))
        .expect_err("leading-zero schema version should fail");

    assert_eq!(missing.code, HolmesDiagnosticCode::HlawSchemaVersionMissing);
    assert_eq!(
        malformed.code,
        HolmesDiagnosticCode::HlawSchemaVersionMalformed
    );
    assert_eq!(
        unsupported_major.code,
        HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMajor
    );
    assert_eq!(
        unsupported_minor.code,
        HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMinor
    );
    assert_eq!(
        leading_zero.code,
        HolmesDiagnosticCode::HlawSchemaVersionMalformed
    );
}

#[test]
fn version_registry_fails_closed_when_requirement_is_missing() {
    let registry = VersionRegistry::new([]);

    let diagnostic = registry
        .validate(ArtifactFamily::EvidenceBundle, Some("999.999.0"))
        .expect_err("missing registry entry should fail closed");

    assert_eq!(
        diagnostic.code,
        HolmesDiagnosticCode::HlawSchemaVersionRequirementMissing
    );
    assert_eq!(
        diagnostic.artifact_family.as_deref(),
        Some("evidence-bundle")
    );
}

#[test]
fn schema_version_parser_rejects_leading_zero_identifiers() {
    for version in ["01.0.0", "1.01.0", "1.0.01"] {
        let diagnostic = VersionRegistry::default()
            .validate(ArtifactFamily::EvidenceBundle, Some(version))
            .expect_err("leading-zero semver identifiers should be malformed");
        assert_eq!(
            diagnostic.code,
            HolmesDiagnosticCode::HlawSchemaVersionMalformed
        );
    }
}

#[test]
fn recording_ports_capture_outputs() {
    let mut io = RecordingCommandIo::default();
    let mut mcp = wesley_holmes::InMemoryMcpResourceRegistry::default();

    io.stdout("ready");
    io.stderr("diagnostic");
    mcp.put_resource("holmes://summary", b"payload")
        .expect("MCP resource should record");

    assert_eq!(io.stdout_lines(), &["ready".to_owned()]);
    assert_eq!(io.stderr_lines(), &["diagnostic".to_owned()]);
    assert_eq!(mcp.resource("holmes://summary"), Some(&b"payload"[..]));
}

#[test]
fn report_renderer_fake_is_deterministic() {
    let renderer = EchoReportRenderer::new("prefix:");

    assert_eq!(
        renderer
            .render_report("body")
            .expect("report rendering should be deterministic"),
        "prefix:body"
    );
}

fn evidence_bundle_with_law_diff_path(path: &str) -> HolmesLawEvidenceBundle {
    let mut bundle = valid_evidence_bundle();
    bundle.artifacts.law_diff.path = path.to_owned();
    bundle
}

fn valid_evidence_bundle() -> HolmesLawEvidenceBundle {
    HolmesLawEvidenceBundle {
        schema_version: "1.0.0".to_owned(),
        bundle_id: "bundle-001".to_owned(),
        artifacts: LawEvidenceArtifacts {
            law_diff: ArtifactRef::new("evidence/law-diff.json"),
            law_coverage: ArtifactRef::new("evidence/law-coverage.json"),
            law_capabilities: ArtifactRef::new("evidence/law-capabilities.json"),
            contract_bundle_manifest: ArtifactRef::new("evidence/bundle-manifest.json"),
            policy: None,
            report: None,
            witness: None,
        },
        provenance: BundleProvenance {
            schema_hash: format!("sha256:{}", "a".repeat(64)),
            law_hash: format!("sha256:{}", "b".repeat(64)),
            policy_hash: None,
            bundle_hash: format!("sha256:{}", "c".repeat(64)),
            source: "test".to_owned(),
        },
    }
}

fn assert_diagnostic(diagnostics: &[wesley_holmes::HolmesDiagnostic], code: HolmesDiagnosticCode) {
    assert!(
        diagnostics.iter().any(|diagnostic| diagnostic.code == code),
        "expected {code:?} in {diagnostics:#?}"
    );
}

fn assert_diagnostic_field(diagnostics: &[wesley_holmes::HolmesDiagnostic], field_path: &str) {
    assert!(
        diagnostics
            .iter()
            .any(|diagnostic| diagnostic.field_path.as_deref() == Some(field_path)),
        "expected field {field_path:?} in {diagnostics:#?}"
    );
}
