//! Typed Wesley contract bundle manifest evidence accepted by Holmes.

use serde::{Deserialize, Serialize};

/// API version supported by the first Holmes contract bundle manifest ingest port.
pub const WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION: &str = "wesley.contract-bundle-manifest/v1";

/// Canonical Law IR codec expected in current Wesley manifests.
pub const WESLEY_LAW_IR_CANONICAL_JSON_CODEC: &str = "wesley.law-ir.canonical-json.v1";

/// Contract bundle hash input codec expected in current Wesley manifests.
pub const WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC: &str =
    "wesley.contract-bundle.hash-input.canonical-json.v1";

/// Contract bundle manifest emitted after schema-bound Law IR validation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractBundleManifest {
    /// Manifest API version.
    pub api_version: String,
    /// Canonical Shape IR hash, prefixed with `sha256:`.
    pub schema_hash: String,
    /// Canonical active semantic Law IR hash.
    pub law_hash: String,
    /// Optional provenance-bearing law document hash.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_document_hash: Option<String>,
    /// Canonical policy/profile hash.
    pub profile_hash: String,
    /// Hash over schema, law, profile, compiler, and codec identities.
    pub bundle_hash: String,
    /// Law IR semantic byte codec.
    pub law_ir_codec: String,
    /// Bundle hash input codec.
    pub bundle_hash_codec: String,
    /// Compiler crate identity.
    pub compiler: String,
    /// Compiler crate version.
    pub compiler_version: String,
    /// Bound active Law IR entry count.
    pub law_entry_count: usize,
}

impl ContractBundleManifest {
    /// Return normalized manifest provenance fields for report construction.
    pub fn normalized_provenance(&self) -> NormalizedContractBundleProvenance {
        NormalizedContractBundleProvenance {
            manifest_ref: "contractBundleManifest".to_owned(),
            api_version: self.api_version.clone(),
            schema_hash: self.schema_hash.clone(),
            law_hash: self.law_hash.clone(),
            law_document_hash: self.law_document_hash.clone(),
            profile_hash: self.profile_hash.clone(),
            bundle_hash: self.bundle_hash.clone(),
            law_ir_codec: self.law_ir_codec.clone(),
            bundle_hash_codec: self.bundle_hash_codec.clone(),
            compiler: self.compiler.clone(),
            compiler_version: self.compiler_version.clone(),
            law_entry_count: self.law_entry_count,
        }
    }
}

/// Normalized manifest provenance fields used by later report sections.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedContractBundleProvenance {
    /// Stable manifest reference for later diagnostics and report links.
    pub manifest_ref: String,
    /// Manifest API version.
    pub api_version: String,
    /// Canonical Shape IR hash, prefixed with `sha256:`.
    pub schema_hash: String,
    /// Canonical active semantic Law IR hash.
    pub law_hash: String,
    /// Optional provenance-bearing law document hash.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_document_hash: Option<String>,
    /// Canonical policy/profile hash.
    pub profile_hash: String,
    /// Contract bundle hash.
    pub bundle_hash: String,
    /// Law IR semantic byte codec.
    pub law_ir_codec: String,
    /// Bundle hash input codec.
    pub bundle_hash_codec: String,
    /// Compiler crate identity.
    pub compiler: String,
    /// Compiler crate version.
    pub compiler_version: String,
    /// Bound active Law IR entry count.
    pub law_entry_count: usize,
}
