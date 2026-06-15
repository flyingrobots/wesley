use wesley_holmes::{
    BundleProvenance, ContractBundleManifestIngestPort, ContractBundleManifestIngestStatus,
    HolmesDiagnosticCode, JsonContractBundleManifestIngestPort,
};

const HASH_A: &str = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B: &str = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C: &str = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const HASH_D: &str = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const HASH_E: &str = "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

fn release_manifest() -> String {
    format!(
        r#"{{
  "apiVersion": "wesley.contract-bundle-manifest/v1",
  "schemaHash": "{HASH_A}",
  "lawHash": "{HASH_B}",
  "lawDocumentHash": "{HASH_E}",
  "profileHash": "{HASH_C}",
  "bundleHash": "{HASH_D}",
  "lawIrCodec": "wesley.law-ir.canonical-json.v1",
  "bundleHashCodec": "wesley.contract-bundle.hash-input.canonical-json.v1",
  "compiler": "wesley-core",
  "compilerVersion": "0.0.5",
  "lawEntryCount": 4
}}"#
    )
}

#[test]
fn contract_manifest_ingest_accepts_release_manifest_and_normalizes_provenance() {
    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(release_manifest().as_bytes(), None);

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Valid);
    assert!(result.diagnostics.is_empty());

    let manifest = result
        .manifest
        .expect("valid manifest should produce typed provenance");
    assert_eq!(manifest.api_version, "wesley.contract-bundle-manifest/v1");
    assert_eq!(manifest.schema_hash, HASH_A);
    assert_eq!(manifest.law_hash, HASH_B);
    assert_eq!(manifest.profile_hash, HASH_C);
    assert_eq!(manifest.bundle_hash, HASH_D);
    assert_eq!(manifest.law_ir_codec, "wesley.law-ir.canonical-json.v1");
    assert_eq!(manifest.compiler, "wesley-core");
    assert_eq!(manifest.law_entry_count, 4);

    let provenance = manifest.normalized_provenance();
    assert_eq!(provenance.manifest_ref, "contractBundleManifest");
    assert_eq!(provenance.law_document_hash.as_deref(), Some(HASH_E));
}

#[test]
fn contract_manifest_ingest_cross_checks_bundle_provenance_hashes() {
    let provenance = BundleProvenance {
        schema_hash: HASH_A.to_owned(),
        law_hash: HASH_B.to_owned(),
        policy_hash: Some(HASH_C.to_owned()),
        bundle_hash: HASH_D.to_owned(),
        source: "ci".to_owned(),
    };

    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(release_manifest().as_bytes(), Some(&provenance));

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Valid);

    let stale_provenance = BundleProvenance {
        schema_hash: HASH_A.to_owned(),
        law_hash: HASH_E.to_owned(),
        policy_hash: Some(HASH_C.to_owned()),
        bundle_hash: HASH_D.to_owned(),
        source: "ci".to_owned(),
    };
    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(release_manifest().as_bytes(), Some(&stale_provenance));

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Invalid);
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestHashMismatch,
    );
    assert_diagnostic_field(&result.diagnostics, "lawHash");
}

#[test]
fn contract_manifest_ingest_rejects_invalid_hash_syntax() {
    let invalid = release_manifest().replace(HASH_A, "abc");

    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(invalid.as_bytes(), None);

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Invalid);
    assert!(result.manifest.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestInvalidHash,
    );
    assert_diagnostic_field(&result.diagnostics, "schemaHash");
}

#[test]
fn contract_manifest_ingest_rejects_missing_required_hash() {
    let missing = release_manifest().replace(&format!("  \"bundleHash\": \"{HASH_D}\",\n"), "");

    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(missing.as_bytes(), None);

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Invalid);
    assert!(result.manifest.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestMissingRequiredHash,
    );
    assert_diagnostic_field(&result.diagnostics, "bundleHash");
}

#[test]
fn contract_manifest_ingest_rejects_unsupported_version_and_codec() {
    let unsupported = release_manifest()
        .replace(
            "wesley.contract-bundle-manifest/v1",
            "wesley.contract-bundle-manifest/v2",
        )
        .replace("wesley.law-ir.canonical-json.v1", "custom-law-ir/v9");

    let result = JsonContractBundleManifestIngestPort
        .ingest_contract_bundle_manifest(unsupported.as_bytes(), None);

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Invalid);
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestUnsupportedVersion,
    );
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestUnsupportedCodec,
    );
}

#[test]
fn contract_manifest_ingest_rejects_malformed_json() {
    let result =
        JsonContractBundleManifestIngestPort.ingest_contract_bundle_manifest(b"{broken", None);

    assert_eq!(result.status, ContractBundleManifestIngestStatus::Invalid);
    assert!(result.manifest.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawManifestMalformedJson,
    );
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
