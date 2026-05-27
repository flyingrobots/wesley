//! Pure Holmes law-assurance domain model.
//!
//! Domain code owns data, deterministic validation, and diagnostics. It must
//! not import ambient filesystem, network, process, GitHub, MCP, or wall-clock
//! dependencies.

mod diagnostic;
mod evidence;
mod versioning;

pub use diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
pub use evidence::{
    ArtifactRef, ArtifactRequirement, BundleArtifactRef, BundleProvenance, HolmesLawEvidenceBundle,
    LawEvidenceArtifacts, LawEvidenceValidationResult, LawEvidenceValidationStatus,
    LoadedArtifactMetadata,
};
pub use versioning::{
    ArtifactFamily, ParsedSchemaVersion, VersionCheck, VersionRegistry, VersionRequirement,
};
