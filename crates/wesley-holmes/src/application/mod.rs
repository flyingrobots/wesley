//! Application services for deterministic Holmes law-assurance orchestration.

mod artifact_locator;
mod evidence_validation;
mod law_diff_ingest;

pub use artifact_locator::{ResolvedArtifactPath, WeslawArtifactLocator};
pub use evidence_validation::LawEvidenceValidator;
pub use law_diff_ingest::{
    JsonLawDiffIngestPort, LawDiffIngestPort, LawDiffIngestResult, LawDiffIngestStatus,
};
