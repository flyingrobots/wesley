use wesley_holmes::{
    ArtifactFamily, ArtifactLoadPort, ArtifactRef, ArtifactWritePort, BundleProvenance, ClockPort,
    CommandIoPort, FilesystemPort, FixedClock, HolmesDiagnosticCode, HolmesLawEvidenceBundle,
    InMemoryArtifactStore, LawEvidenceArtifacts, McpResourcePort, RecordingCommandIo, Timestamp,
    VersionRegistry, WeslawArtifactLocator,
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

    assert!(escape.message.contains("escape"));
    assert!(absolute.message.contains("workspace-relative"));
}

#[test]
fn version_registry_accepts_current_versions() {
    let registry = VersionRegistry::default();

    for family in [
        ArtifactFamily::EvidenceBundle,
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

fn evidence_bundle_with_law_diff_path(path: &str) -> HolmesLawEvidenceBundle {
    HolmesLawEvidenceBundle {
        schema_version: "1.0.0".to_owned(),
        bundle_id: "bundle-001".to_owned(),
        artifacts: LawEvidenceArtifacts {
            law_diff: ArtifactRef::new(path),
            law_coverage: ArtifactRef::new("evidence/law-coverage.json"),
            law_capabilities: ArtifactRef::new("evidence/law-capabilities.json"),
            contract_bundle_manifest: ArtifactRef::new("evidence/bundle-manifest.json"),
            policy: None,
            report: None,
            witness: None,
        },
        provenance: BundleProvenance {
            schema_hash: "sha256:schema".to_owned(),
            law_hash: "sha256:law".to_owned(),
            policy_hash: None,
            bundle_hash: "sha256:bundle".to_owned(),
            source: "test".to_owned(),
        },
    }
}
