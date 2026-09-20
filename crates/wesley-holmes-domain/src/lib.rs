#![deny(warnings)]
#![deny(missing_docs)]
#![forbid(unsafe_code)]
// The boundary, held by the compiler. Without `std` in scope there is no
// `std::fs`, `std::net`, `std::process`, `std::env`, `SystemTime`, or `Instant`
// to reach for, and nobody has to remember a list of what to forbid.
#![no_std]

//! Pure Holmes law-assurance domain model.
//!
//! Domain code owns data, deterministic validation, and diagnostics. It must not
//! touch the filesystem, the network, a process, the environment, or a clock.
//! The crate is `no_std`, so none of those is in scope, and
//! `cargo xtask holmes-domain-check` builds it for a target that has no `std`.
//!
//! Two things that guard does not see, and review must: a second `extern crate`
//! (the one below is the only one this crate should ever have), and a new entry
//! in the dependency list, which today is `serde`, `serde_json`, and `libm`.

// Each module imports what it uses from `alloc` by name: `String`, `Vec`,
// `format!` and the rest are not in scope by default without `std`.
extern crate alloc;

mod assessment;
mod contract_manifest;
mod diagnostic;
mod evidence;
mod finding;
mod law_capability;
mod law_coverage;
mod law_coverage_gate;
mod law_diff;
mod policy;
mod versioning;

pub use assessment::{
    BoundedFindingSummary, BundleTraceabilityCheck, BundleTraceabilityGateDecision,
    BundleTraceabilityGateState, LawAssuranceArtifactProvenance, LawAssuranceAssessmentOutcome,
    LawAssuranceAssessmentSummary, LawAssuranceProvenanceReport,
    aggregate_law_assurance_assessment, bounded_finding_summary, evaluate_bundle_traceability,
    law_assurance_provenance_report,
};
pub use contract_manifest::{
    ContractBundleManifest, NormalizedContractBundleProvenance,
    WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC, WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION,
    WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
};
pub use diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
pub use evidence::{
    ArtifactRef, ArtifactRequirement, BundleArtifactRef, BundleProvenance, HolmesLawEvidenceBundle,
    LawEvidenceArtifacts, LawEvidenceValidationResult, LawEvidenceValidationStatus,
    LoadedArtifactMetadata,
};
pub use finding::{
    LawFindingSeverity, SemanticChangeFinding, default_severity_for_event,
    semantic_change_findings_from_law_diff, sort_semantic_change_findings,
};
pub use law_capability::{
    LawCapabilityClosure, LawCapabilityFootprint, LawCapabilityReport, LawCapabilitySlot,
    NormalizedLawCapabilityOperation, WESLEY_LAW_CAPABILITIES_API_VERSION,
};
pub use law_coverage::{
    LawCoverageCategory, LawCoverageReport, NormalizedLawCoverageCategory,
    NormalizedLawCoverageProfile, WESLEY_LAW_COVERAGE_API_VERSION, percentage,
};
pub use law_coverage_gate::{
    CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior, LawCoverageCategoryThreshold,
    LawCoverageGateDecision, LawCoverageGatePolicy, LawCoverageGateState,
    evaluate_law_coverage_gates,
};
pub use law_diff::{
    LawDiffEvent, LawDiffEventKind, LawDiffFieldChange, LawDiffLawKind, LawDiffReport,
    LawDiffReviewPosture, NormalizedLawDiffEvent, WESLEY_LAW_DIFF_API_VERSION,
};
pub use policy::{
    AnnotatedFinding, HOLMES_LAW_ASSURANCE_POLICY_API_VERSION, LawAssuranceCoverageThresholdPolicy,
    LawAssurancePolicyProfile, LawAssurancePolicySchema, LawAssuranceSuppressionMatch,
    LawAssuranceSuppressionRule, LawAssuranceSuppressionTarget, LawAssuranceSuppressionTargetKind,
    NormalizedLawAssurancePolicy, SuppressionApplicationRecord, SuppressionPolicyOutcome,
    SuppressionRejectionReason, SuppressionRejectionRecord, apply_suppression_policy,
    map_semantic_finding_severities, matching_suppressions_for_finding,
    normalize_law_assurance_policy, parse_law_assurance_policy,
};
pub use versioning::{
    ArtifactFamily, ParsedSchemaVersion, VersionCheck, VersionRegistry, VersionRequirement,
};
