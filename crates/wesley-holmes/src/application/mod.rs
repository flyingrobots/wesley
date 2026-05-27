//! Application services for deterministic Holmes law-assurance orchestration.

mod artifact_locator;
mod evidence_validation;

pub use artifact_locator::{ResolvedArtifactPath, WeslawArtifactLocator};
pub use evidence_validation::LawEvidenceValidator;
