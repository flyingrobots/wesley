//! Law evidence bundle model consumed by Holmes.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use super::versioning::{ArtifactFamily, VersionRegistry};

/// Workspace-relative reference to a Wesley-published artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    /// Workspace-relative artifact path.
    pub path: String,
    /// Artifact-local schema version required for present artifact references.
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

    /// Attach an artifact-local schema version.
    pub fn with_schema_version(mut self, schema_version: impl Into<String>) -> Self {
        self.schema_version = Some(schema_version.into());
        self
    }

    fn is_blank(&self) -> bool {
        self.path.trim().is_empty()
    }
}

/// Whether a bundle artifact reference is required for validation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArtifactRequirement {
    /// The artifact reference must be present and non-blank.
    Required,
    /// The artifact reference may be omitted, but must be valid when present.
    Optional,
}

/// A bundle artifact reference with its stable field path and family.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BundleArtifactRef<'a> {
    /// Stable field path in the evidence bundle.
    pub field_path: &'static str,
    /// Artifact family used for schema-version validation.
    pub family: ArtifactFamily,
    /// Requirement class for this reference.
    pub requirement: ArtifactRequirement,
    /// Referenced artifact.
    pub artifact: &'a ArtifactRef,
}

/// Validation status before Holmes performs assurance assessment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LawEvidenceValidationStatus {
    /// Evidence is structurally valid and all required artifacts were readable.
    Valid,
    /// Evidence is usable, but carries non-fatal diagnostics.
    ValidWithWarnings,
    /// Evidence is invalid and assessment must not run.
    Invalid,
    /// A dependency failure prevented validation from completing.
    InfrastructureError,
}

/// Metadata captured for a loaded evidence artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedArtifactMetadata {
    /// Stable evidence-bundle field path for this artifact.
    pub field_path: String,
    /// Artifact-family identifier.
    pub artifact_family: String,
    /// Normalized workspace-relative path.
    pub path: String,
    /// Loaded byte length.
    pub byte_len: usize,
}

/// Collected evidence validation result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawEvidenceValidationResult {
    /// Validation status.
    pub status: LawEvidenceValidationStatus,
    /// Deterministically ordered diagnostics.
    pub diagnostics: Vec<HolmesDiagnostic>,
    /// Metadata for artifacts successfully loaded by the validation gate.
    pub loaded_artifacts: Vec<LoadedArtifactMetadata>,
}

impl LawEvidenceValidationResult {
    /// Build a validation result from diagnostics.
    pub fn from_diagnostics(diagnostics: Vec<HolmesDiagnostic>) -> Self {
        let status = validation_status_for(&diagnostics);
        Self {
            status,
            diagnostics,
            loaded_artifacts: Vec::new(),
        }
    }

    /// Add loaded artifact metadata.
    pub fn with_loaded_artifacts(mut self, loaded_artifacts: Vec<LoadedArtifactMetadata>) -> Self {
        self.loaded_artifacts = loaded_artifacts;
        self
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
    /// Return all present required and optional artifact references.
    pub fn artifact_refs(&self) -> Vec<BundleArtifactRef<'_>> {
        let mut artifacts = vec![
            BundleArtifactRef {
                field_path: "artifacts.lawDiff",
                family: ArtifactFamily::LawDiff,
                requirement: ArtifactRequirement::Required,
                artifact: &self.artifacts.law_diff,
            },
            BundleArtifactRef {
                field_path: "artifacts.lawCoverage",
                family: ArtifactFamily::LawCoverage,
                requirement: ArtifactRequirement::Required,
                artifact: &self.artifacts.law_coverage,
            },
            BundleArtifactRef {
                field_path: "artifacts.lawCapabilities",
                family: ArtifactFamily::LawCapabilities,
                requirement: ArtifactRequirement::Required,
                artifact: &self.artifacts.law_capabilities,
            },
            BundleArtifactRef {
                field_path: "artifacts.contractBundleManifest",
                family: ArtifactFamily::ContractBundleManifest,
                requirement: ArtifactRequirement::Required,
                artifact: &self.artifacts.contract_bundle_manifest,
            },
        ];

        if let Some(artifact) = &self.artifacts.policy {
            artifacts.push(BundleArtifactRef {
                field_path: "artifacts.policy",
                family: ArtifactFamily::Policy,
                requirement: ArtifactRequirement::Optional,
                artifact,
            });
        }
        if let Some(artifact) = &self.artifacts.report {
            artifacts.push(BundleArtifactRef {
                field_path: "artifacts.report",
                family: ArtifactFamily::Report,
                requirement: ArtifactRequirement::Optional,
                artifact,
            });
        }
        if let Some(artifact) = &self.artifacts.witness {
            artifacts.push(BundleArtifactRef {
                field_path: "artifacts.witness",
                family: ArtifactFamily::AuditWitness,
                requirement: ArtifactRequirement::Optional,
                artifact,
            });
        }

        artifacts
    }

    /// Validate bundle shape, artifact references, schema versions, and provenance.
    pub fn validate_structure(
        &self,
        version_registry: &VersionRegistry,
    ) -> LawEvidenceValidationResult {
        let mut diagnostics = Vec::new();

        match version_registry.classify(
            ArtifactFamily::EvidenceBundle,
            Some(self.schema_version.as_str()),
        ) {
            Ok(version_check) => diagnostics.extend(version_check.diagnostics),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }

        if self.bundle_id.trim().is_empty() {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
                    HolmesSeverity::Error,
                    "law evidence bundle is missing bundleId",
                )
                .at_field("bundleId"),
            );
        }

        self.validate_artifact_structure(version_registry, &mut diagnostics);
        self.validate_provenance(&mut diagnostics);

        LawEvidenceValidationResult::from_diagnostics(diagnostics)
    }

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

    fn validate_artifact_structure(
        &self,
        version_registry: &VersionRegistry,
        diagnostics: &mut Vec<HolmesDiagnostic>,
    ) {
        let mut paths = BTreeMap::new();

        for bundle_artifact in self.artifact_refs() {
            let artifact = bundle_artifact.artifact;
            if artifact.is_blank() {
                diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
                        HolmesSeverity::Error,
                        match bundle_artifact.requirement {
                            ArtifactRequirement::Required => {
                                "law evidence bundle is missing a required artifact reference"
                            }
                            ArtifactRequirement::Optional => {
                                "law evidence bundle contains a blank optional artifact reference"
                            }
                        },
                    )
                    .for_family(bundle_artifact.family.id())
                    .at_field(bundle_artifact.field_path),
                );
                continue;
            }

            let duplicate_of =
                paths.insert(artifact.path.trim().to_owned(), bundle_artifact.field_path);
            if let Some(first_field_path) = duplicate_of {
                diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
                        HolmesSeverity::Error,
                        format!(
                            "artifact path duplicates {first_field_path}; each artifact role must point at distinct evidence"
                        ),
                    )
                    .for_family(bundle_artifact.family.id())
                    .at_field(bundle_artifact.field_path),
                );
            }

            let schema_field = format!("{}.schemaVersion", bundle_artifact.field_path);
            match version_registry
                .classify(bundle_artifact.family, artifact.schema_version.as_deref())
            {
                Ok(version_check) => diagnostics.extend(
                    version_check
                        .diagnostics
                        .into_iter()
                        .map(|diagnostic| diagnostic.at_field(schema_field.clone())),
                ),
                Err(diagnostic) => diagnostics.push(diagnostic.at_field(schema_field)),
            }

            if let Some(sha256) = artifact.sha256.as_deref() {
                validate_artifact_sha256(
                    sha256,
                    format!("{}.sha256", bundle_artifact.field_path),
                    diagnostics,
                );
            }
        }
    }

    fn validate_provenance(&self, diagnostics: &mut Vec<HolmesDiagnostic>) {
        validate_required_sha256(
            &self.provenance.schema_hash,
            "provenance.schemaHash",
            diagnostics,
        );
        validate_required_sha256(&self.provenance.law_hash, "provenance.lawHash", diagnostics);
        if let Some(policy_hash) = &self.provenance.policy_hash {
            validate_required_sha256(policy_hash, "provenance.policyHash", diagnostics);
        }
        validate_required_sha256(
            &self.provenance.bundle_hash,
            "provenance.bundleHash",
            diagnostics,
        );

        if self.provenance.source.trim().is_empty() {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawProvenanceSourceMissing,
                    HolmesSeverity::Error,
                    "law evidence bundle provenance source must not be blank",
                )
                .at_field("provenance.source"),
            );
        }
    }
}

fn validation_status_for(diagnostics: &[HolmesDiagnostic]) -> LawEvidenceValidationStatus {
    if diagnostics
        .iter()
        .any(|diagnostic| diagnostic.severity == HolmesSeverity::Error)
    {
        LawEvidenceValidationStatus::Invalid
    } else if diagnostics
        .iter()
        .any(|diagnostic| diagnostic.severity == HolmesSeverity::Warning)
    {
        LawEvidenceValidationStatus::ValidWithWarnings
    } else {
        LawEvidenceValidationStatus::Valid
    }
}

fn validate_required_sha256(
    value: &str,
    field_path: impl Into<String>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    let field_path = field_path.into();
    if value.trim().is_empty() {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawProvenanceHashMissing,
                HolmesSeverity::Error,
                "law evidence bundle provenance hash must not be blank",
            )
            .at_field(field_path),
        );
    } else if !is_canonical_sha256(value) {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawProvenanceHashMalformed,
                HolmesSeverity::Error,
                "law evidence bundle provenance hash must use sha256:<64 lowercase hex>",
            )
            .at_field(field_path),
        );
    }
}

fn validate_artifact_sha256(
    value: &str,
    field_path: impl Into<String>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    let field_path = field_path.into();
    if value.trim().is_empty() {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawArtifactHashMissing,
                HolmesSeverity::Error,
                "artifact sha256 digest must not be blank",
            )
            .at_field(field_path),
        );
    } else if !is_canonical_sha256(value) {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawArtifactHashMalformed,
                HolmesSeverity::Error,
                "artifact sha256 digest must use sha256:<64 lowercase hex>",
            )
            .at_field(field_path),
        );
    }
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
