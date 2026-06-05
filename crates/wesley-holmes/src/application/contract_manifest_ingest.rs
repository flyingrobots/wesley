//! JSON ingest boundary for Wesley contract bundle manifest artifacts.

use serde::Deserialize;

use crate::domain::{
    BundleProvenance, ContractBundleManifest, HolmesDiagnostic, HolmesDiagnosticCode,
    HolmesSeverity, WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC,
    WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION, WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
};

/// Validation status for contract bundle manifest ingest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContractBundleManifestIngestStatus {
    /// Contract bundle manifest JSON was accepted and normalized into a typed report.
    Valid,
    /// Contract bundle manifest JSON was rejected before Holmes assessment.
    Invalid,
}

/// Result of ingesting a Wesley contract bundle manifest artifact.
#[derive(Debug, Clone, PartialEq)]
pub struct ContractBundleManifestIngestResult {
    /// Ingest status.
    pub status: ContractBundleManifestIngestStatus,
    /// Deterministically ordered ingest diagnostics.
    pub diagnostics: Vec<HolmesDiagnostic>,
    /// Parsed contract bundle manifest when ingest succeeded.
    pub manifest: Option<ContractBundleManifest>,
}

impl ContractBundleManifestIngestResult {
    fn valid(manifest: ContractBundleManifest) -> Self {
        Self {
            status: ContractBundleManifestIngestStatus::Valid,
            diagnostics: Vec::new(),
            manifest: Some(manifest),
        }
    }

    fn invalid(diagnostics: Vec<HolmesDiagnostic>) -> Self {
        Self {
            status: ContractBundleManifestIngestStatus::Invalid,
            diagnostics,
            manifest: None,
        }
    }
}

/// Input port for `wesley.contract-bundle-manifest/v1` JSON artifacts.
pub trait ContractBundleManifestIngestPort {
    /// Ingest raw manifest bytes and optionally cross-check evidence-bundle provenance.
    fn ingest_contract_bundle_manifest(
        &self,
        bytes: &[u8],
        bundle_provenance: Option<&BundleProvenance>,
    ) -> ContractBundleManifestIngestResult;
}

/// JSON implementation of the contract bundle manifest ingest port.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct JsonContractBundleManifestIngestPort;

impl ContractBundleManifestIngestPort for JsonContractBundleManifestIngestPort {
    fn ingest_contract_bundle_manifest(
        &self,
        bytes: &[u8],
        bundle_provenance: Option<&BundleProvenance>,
    ) -> ContractBundleManifestIngestResult {
        let raw = match serde_json::from_slice::<RawContractBundleManifest>(bytes) {
            Ok(raw) => raw,
            Err(err) => {
                return ContractBundleManifestIngestResult::invalid(vec![
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawManifestMalformedJson,
                        HolmesSeverity::Error,
                        format!(
                            "contract bundle manifest is not valid wesley.contract-bundle-manifest/v1 JSON: {err}"
                        ),
                    )
                    .for_family("contract-bundle-manifest"),
                ]);
            }
        };

        let mut diagnostics = Vec::new();
        validate_api_version(&raw, &mut diagnostics);
        validate_hash_field("schemaHash", raw.schema_hash.as_deref(), &mut diagnostics);
        validate_hash_field("lawHash", raw.law_hash.as_deref(), &mut diagnostics);
        validate_optional_hash_field(
            "lawDocumentHash",
            raw.law_document_hash.as_deref(),
            &mut diagnostics,
        );
        validate_hash_field("profileHash", raw.profile_hash.as_deref(), &mut diagnostics);
        validate_hash_field("bundleHash", raw.bundle_hash.as_deref(), &mut diagnostics);
        validate_required_text("compiler", raw.compiler.as_deref(), &mut diagnostics);
        validate_required_text(
            "compilerVersion",
            raw.compiler_version.as_deref(),
            &mut diagnostics,
        );
        validate_codec(
            "lawIrCodec",
            raw.law_ir_codec.as_deref(),
            WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
            &mut diagnostics,
        );
        validate_codec(
            "bundleHashCodec",
            raw.bundle_hash_codec.as_deref(),
            WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC,
            &mut diagnostics,
        );
        if raw.law_entry_count.is_none() {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawManifestMissingRequiredField,
                    HolmesSeverity::Error,
                    "contract bundle manifest is missing lawEntryCount",
                )
                .for_family("contract-bundle-manifest")
                .at_field("lawEntryCount"),
            );
        }

        if let Some(provenance) = bundle_provenance {
            cross_check_bundle_provenance(&raw, provenance, &mut diagnostics);
        }

        if !diagnostics.is_empty() {
            return ContractBundleManifestIngestResult::invalid(diagnostics);
        }

        ContractBundleManifestIngestResult::valid(ContractBundleManifest {
            api_version: raw.api_version.expect("apiVersion was validated"),
            schema_hash: raw.schema_hash.expect("schemaHash was validated"),
            law_hash: raw.law_hash.expect("lawHash was validated"),
            law_document_hash: raw.law_document_hash,
            profile_hash: raw.profile_hash.expect("profileHash was validated"),
            bundle_hash: raw.bundle_hash.expect("bundleHash was validated"),
            law_ir_codec: raw.law_ir_codec.expect("lawIrCodec was validated"),
            bundle_hash_codec: raw
                .bundle_hash_codec
                .expect("bundleHashCodec was validated"),
            compiler: raw.compiler.expect("compiler was validated"),
            compiler_version: raw.compiler_version.expect("compilerVersion was validated"),
            law_entry_count: raw.law_entry_count.expect("lawEntryCount was validated"),
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawContractBundleManifest {
    #[serde(default)]
    api_version: Option<String>,
    #[serde(default)]
    schema_hash: Option<String>,
    #[serde(default)]
    law_hash: Option<String>,
    #[serde(default)]
    law_document_hash: Option<String>,
    #[serde(default)]
    profile_hash: Option<String>,
    #[serde(default)]
    bundle_hash: Option<String>,
    #[serde(default)]
    law_ir_codec: Option<String>,
    #[serde(default)]
    bundle_hash_codec: Option<String>,
    #[serde(default)]
    compiler: Option<String>,
    #[serde(default)]
    compiler_version: Option<String>,
    #[serde(default)]
    law_entry_count: Option<usize>,
}

fn validate_api_version(raw: &RawContractBundleManifest, diagnostics: &mut Vec<HolmesDiagnostic>) {
    match raw.api_version.as_deref() {
        Some(WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION) => {}
        Some(version) => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestUnsupportedVersion,
                HolmesSeverity::Error,
                format!(
                    "unsupported contract bundle manifest apiVersion {version}; expected {WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION}"
                ),
            )
            .for_family("contract-bundle-manifest")
            .at_field("apiVersion"),
        ),
        None => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestMissingRequiredField,
                HolmesSeverity::Error,
                "contract bundle manifest is missing apiVersion",
            )
            .for_family("contract-bundle-manifest")
            .at_field("apiVersion"),
        ),
    }
}

fn validate_hash_field(
    field_path: &'static str,
    value: Option<&str>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    match value {
        Some(value) if is_canonical_sha256(value) => {}
        Some(value) if value.trim().is_empty() => diagnostics.push(missing_hash(field_path)),
        Some(_) => diagnostics.push(invalid_hash(field_path)),
        None => diagnostics.push(missing_hash(field_path)),
    }
}

fn validate_optional_hash_field(
    field_path: &'static str,
    value: Option<&str>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    if let Some(value) = value {
        if !is_canonical_sha256(value) {
            diagnostics.push(invalid_hash(field_path));
        }
    }
}

fn validate_required_text(
    field_path: &'static str,
    value: Option<&str>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    match value {
        Some(value) if !value.trim().is_empty() => {}
        _ => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestMissingRequiredField,
                HolmesSeverity::Error,
                "contract bundle manifest is missing required provenance metadata",
            )
            .for_family("contract-bundle-manifest")
            .at_field(field_path),
        ),
    }
}

fn validate_codec(
    field_path: &'static str,
    value: Option<&str>,
    expected: &'static str,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    match value {
        Some(value) if value == expected => {}
        Some(value) if value.trim().is_empty() => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestMissingRequiredField,
                HolmesSeverity::Error,
                "contract bundle manifest is missing required codec metadata",
            )
            .for_family("contract-bundle-manifest")
            .at_field(field_path),
        ),
        Some(value) => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestUnsupportedCodec,
                HolmesSeverity::Error,
                format!("unsupported contract bundle manifest codec {value}; expected {expected}"),
            )
            .for_family("contract-bundle-manifest")
            .at_field(field_path),
        ),
        None => diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawManifestMissingRequiredField,
                HolmesSeverity::Error,
                "contract bundle manifest is missing required codec metadata",
            )
            .for_family("contract-bundle-manifest")
            .at_field(field_path),
        ),
    }
}

fn cross_check_bundle_provenance(
    raw: &RawContractBundleManifest,
    provenance: &BundleProvenance,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    compare_hash(
        "schemaHash",
        raw.schema_hash.as_deref(),
        &provenance.schema_hash,
        diagnostics,
    );
    compare_hash(
        "lawHash",
        raw.law_hash.as_deref(),
        &provenance.law_hash,
        diagnostics,
    );
    if let Some(policy_hash) = provenance.policy_hash.as_deref() {
        compare_hash(
            "profileHash",
            raw.profile_hash.as_deref(),
            policy_hash,
            diagnostics,
        );
    }
    compare_hash(
        "bundleHash",
        raw.bundle_hash.as_deref(),
        &provenance.bundle_hash,
        diagnostics,
    );
}

fn compare_hash(
    field_path: &'static str,
    manifest_hash: Option<&str>,
    expected_hash: &str,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    if let Some(manifest_hash) = manifest_hash {
        if !is_canonical_sha256(manifest_hash) {
            return;
        }
        if manifest_hash != expected_hash {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawManifestHashMismatch,
                    HolmesSeverity::Error,
                    format!(
                        "contract bundle manifest {field_path} does not match evidence bundle provenance"
                    ),
                )
                .for_family("contract-bundle-manifest")
                .at_field(field_path),
            );
        }
    }
}

fn missing_hash(field_path: &'static str) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawManifestMissingRequiredHash,
        HolmesSeverity::Error,
        "contract bundle manifest is missing a required hash",
    )
    .for_family("contract-bundle-manifest")
    .at_field(field_path)
}

fn invalid_hash(field_path: &'static str) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawManifestInvalidHash,
        HolmesSeverity::Error,
        "contract bundle manifest hash must use sha256:<64 lowercase hex>",
    )
    .for_family("contract-bundle-manifest")
    .at_field(field_path)
}

fn is_canonical_sha256(value: &str) -> bool {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return false;
    };
    hex.len() == 64
        && hex
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
