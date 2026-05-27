//! Pure Holmes law-assurance domain model.
//!
//! Domain code owns data, deterministic validation, and diagnostics. It must
//! not import ambient filesystem, network, process, GitHub, MCP, or wall-clock
//! dependencies.

mod diagnostic;
mod evidence;
mod law_diff;
mod versioning;

pub use diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
pub use evidence::{
    ArtifactRef, ArtifactRequirement, BundleArtifactRef, BundleProvenance, HolmesLawEvidenceBundle,
    LawEvidenceArtifacts, LawEvidenceValidationResult, LawEvidenceValidationStatus,
    LoadedArtifactMetadata,
};
pub use law_diff::{
    LawDiffEvent, LawDiffEventKind, LawDiffFieldChange, LawDiffLawKind, LawDiffReport,
    LawDiffReviewPosture, NormalizedLawDiffEvent, WESLEY_LAW_DIFF_API_VERSION,
};
pub use versioning::{
    ArtifactFamily, ParsedSchemaVersion, VersionCheck, VersionRegistry, VersionRequirement,
};
