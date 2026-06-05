//! Application services for deterministic Holmes law-assurance orchestration.

mod artifact_locator;
mod contract_manifest_ingest;
mod evidence_validation;
mod law_capability_ingest;
mod law_coverage_ingest;
mod law_diff_ingest;

pub use artifact_locator::{ResolvedArtifactPath, WeslawArtifactLocator};
pub use contract_manifest_ingest::{
    ContractBundleManifestIngestPort, ContractBundleManifestIngestResult,
    ContractBundleManifestIngestStatus, JsonContractBundleManifestIngestPort,
};
pub use evidence_validation::LawEvidenceValidator;
pub use law_capability_ingest::{
    JsonLawCapabilityIngestPort, LawCapabilityIngestPort, LawCapabilityIngestResult,
    LawCapabilityIngestStatus,
};
pub use law_coverage_ingest::{
    JsonLawCoverageIngestPort, LawCoverageIngestPort, LawCoverageIngestResult,
    LawCoverageIngestStatus,
};
pub use law_diff_ingest::{
    JsonLawDiffIngestPort, LawDiffIngestPort, LawDiffIngestResult, LawDiffIngestStatus,
};
