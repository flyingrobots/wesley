//! Law evidence bundle model consumed by Holmes.

use serde::{Deserialize, Serialize};

use super::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};

/// Workspace-relative reference to a Wesley-published artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    /// Workspace-relative artifact path.
    pub path: String,
    /// Optional artifact-local schema version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<String>,
    /// Optional expected SHA-256 digest.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

impl ArtifactRef {
    /// Create an artifact reference with only a path.
    pub fn new(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            schema_version: None,
            sha256: None,
        }
    }

    fn is_blank(&self) -> bool {
        self.path.trim().is_empty()
    }
}

/// Required artifact families in a Holmes law evidence bundle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawEvidenceArtifacts {
    /// Machine-readable law diff artifact.
    pub law_diff: ArtifactRef,
    /// Law coverage artifact for the active assurance profile.
    pub law_coverage: ArtifactRef,
    /// Capability model artifact derived from operation footprint law.
    pub law_capabilities: ArtifactRef,
    /// Contract bundle manifest artifact.
    pub contract_bundle_manifest: ArtifactRef,
    /// Optional active policy artifact.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy: Option<ArtifactRef>,
    /// Optional rendered report artifact.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub report: Option<ArtifactRef>,
    /// Optional witness artifact.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub witness: Option<ArtifactRef>,
}

/// Hash and source provenance for a law evidence bundle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleProvenance {
    /// Canonical schema hash that the evidence was derived from.
    pub schema_hash: String,
    /// Canonical law hash that the evidence was derived from.
    pub law_hash: String,
    /// Optional policy hash active during evidence production.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_hash: Option<String>,
    /// Canonical contract bundle hash.
    pub bundle_hash: String,
    /// Human-readable source label for the bundle.
    pub source: String,
}

/// Top-level Holmes law evidence bundle envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolmesLawEvidenceBundle {
    /// Evidence bundle schema version.
    pub schema_version: String,
    /// Stable evidence bundle identifier.
    pub bundle_id: String,
    /// Required and optional artifacts that make up the bundle.
    pub artifacts: LawEvidenceArtifacts,
    /// Hash and source provenance.
    pub provenance: BundleProvenance,
}

impl HolmesLawEvidenceBundle {
    /// Validate that all required artifact references are present.
    pub fn validate_required_artifacts(&self) -> HolmesResult<()> {
        let required = [
            ("artifacts.lawDiff", &self.artifacts.law_diff),
            ("artifacts.lawCoverage", &self.artifacts.law_coverage),
            (
                "artifacts.lawCapabilities",
                &self.artifacts.law_capabilities,
            ),
            (
                "artifacts.contractBundleManifest",
                &self.artifacts.contract_bundle_manifest,
            ),
        ];

        for (field_path, artifact) in required {
            if artifact.is_blank() {
                return Err(HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
                    HolmesSeverity::Error,
                    "law evidence bundle is missing a required artifact reference",
                )
                .at_field(field_path));
            }
        }

        Ok(())
    }
}
