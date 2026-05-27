//! Evidence-bundle validation application service.

use std::collections::BTreeMap;

use crate::application::WeslawArtifactLocator;
use crate::domain::{
    ArtifactRef, HolmesDiagnostic, HolmesDiagnosticCode, HolmesLawEvidenceBundle, HolmesSeverity,
    LawEvidenceValidationResult, LoadedArtifactMetadata, VersionRegistry,
};
use crate::ports::ArtifactLoadPort;

/// Validates Holmes law evidence bundles without performing assurance judgment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LawEvidenceValidator {
    locator: WeslawArtifactLocator,
    max_bytes: usize,
}

impl LawEvidenceValidator {
    /// Create a validator with a workspace artifact locator.
    pub fn new(locator: WeslawArtifactLocator) -> Self {
        Self {
            locator,
            max_bytes: 8 * 1024 * 1024,
        }
    }

    /// Return a validator with a deterministic artifact byte limit.
    pub fn with_max_bytes(mut self, max_bytes: usize) -> Self {
        self.max_bytes = max_bytes;
        self
    }

    /// Validate structure, provenance, and referenced artifact availability.
    pub fn validate(
        &self,
        bundle: &HolmesLawEvidenceBundle,
        artifact_loader: &impl ArtifactLoadPort,
        version_registry: &VersionRegistry,
    ) -> LawEvidenceValidationResult {
        let structural = bundle.validate_structure(version_registry);
        if structural
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == HolmesSeverity::Error)
        {
            return structural;
        }

        let mut diagnostics = structural.diagnostics;
        let mut loaded_artifacts = Vec::new();
        let mut normalized_paths = BTreeMap::new();

        for bundle_artifact in bundle.artifact_refs() {
            let artifact = bundle_artifact.artifact;
            let resolved = match self.locator.resolve(&artifact.path) {
                Ok(resolved) => resolved,
                Err(diagnostic) => {
                    diagnostics.push(diagnostic.at_field(bundle_artifact.field_path));
                    continue;
                }
            };

            if let Some(first_field_path) = normalized_paths.insert(
                resolved.workspace_relative.clone(),
                bundle_artifact.field_path,
            ) {
                diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
                        HolmesSeverity::Error,
                        format!(
                            "artifact path normalizes to the same path as {first_field_path}; each artifact role must point at distinct evidence"
                        ),
                    )
                    .for_family(bundle_artifact.family.id())
                    .at_field(bundle_artifact.field_path),
                );
                continue;
            }

            let normalized = ArtifactRef {
                path: resolved.workspace_relative.clone(),
                schema_version: artifact.schema_version.clone(),
                sha256: artifact.sha256.clone(),
            };

            match artifact_loader.read_artifact(&normalized) {
                Ok(bytes) if bytes.len() <= self.max_bytes => {
                    loaded_artifacts.push(LoadedArtifactMetadata {
                        field_path: bundle_artifact.field_path.to_owned(),
                        artifact_family: bundle_artifact.family.id().to_owned(),
                        path: normalized.path,
                        byte_len: bytes.len(),
                    });
                }
                Ok(bytes) => diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawArtifactOversized,
                        HolmesSeverity::Error,
                        format!(
                            "artifact {:?} is {} bytes, above the configured {} byte limit",
                            normalized.path,
                            bytes.len(),
                            self.max_bytes
                        ),
                    )
                    .for_family(bundle_artifact.family.id())
                    .at_field(bundle_artifact.field_path),
                ),
                Err(diagnostic) => diagnostics.push(
                    diagnostic
                        .for_family(bundle_artifact.family.id())
                        .at_field(bundle_artifact.field_path),
                ),
            }
        }

        LawEvidenceValidationResult::from_diagnostics(diagnostics)
            .with_loaded_artifacts(loaded_artifacts)
    }
}
