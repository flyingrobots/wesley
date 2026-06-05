//! Pure Holmes law-assurance domain model.
//!
//! Domain code owns data, deterministic validation, and diagnostics. It must
//! not import ambient filesystem, network, process, GitHub, MCP, or wall-clock
//! dependencies.

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
    aggregate_law_assurance_assessment, bounded_finding_summary, evaluate_bundle_traceability,
    law_assurance_provenance_report, BoundedFindingSummary, BundleTraceabilityCheck,
    BundleTraceabilityGateDecision, BundleTraceabilityGateState, LawAssuranceArtifactProvenance,
    LawAssuranceAssessmentOutcome, LawAssuranceAssessmentSummary, LawAssuranceProvenanceReport,
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
    default_severity_for_event, semantic_change_findings_from_law_diff,
    sort_semantic_change_findings, LawFindingSeverity, SemanticChangeFinding,
};
pub use law_capability::{
    LawCapabilityClosure, LawCapabilityFootprint, LawCapabilityReport, LawCapabilitySlot,
    NormalizedLawCapabilityOperation, WESLEY_LAW_CAPABILITIES_API_VERSION,
    WESLEY_LEGACY_CAPABILITY_REPORT_API_VERSION,
};
pub use law_coverage::{
    percentage, LawCoverageCategory, LawCoverageReport, NormalizedLawCoverageCategory,
    NormalizedLawCoverageProfile, WESLEY_LAW_COVERAGE_API_VERSION,
};
pub use law_coverage_gate::{
    evaluate_law_coverage_gates, CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior,
    LawCoverageCategoryThreshold, LawCoverageGateDecision, LawCoverageGatePolicy,
    LawCoverageGateState,
};
pub use law_diff::{
    LawDiffEvent, LawDiffEventKind, LawDiffFieldChange, LawDiffLawKind, LawDiffReport,
    LawDiffReviewPosture, NormalizedLawDiffEvent, WESLEY_LAW_DIFF_API_VERSION,
};
pub use policy::{
    map_semantic_finding_severities, matching_suppressions_for_finding,
    normalize_law_assurance_policy, parse_law_assurance_policy,
    LawAssuranceCoverageThresholdPolicy, LawAssurancePolicyProfile, LawAssurancePolicySchema,
    LawAssuranceSuppressionMatch, LawAssuranceSuppressionRule, LawAssuranceSuppressionTarget,
    LawAssuranceSuppressionTargetKind, NormalizedLawAssurancePolicy,
    HOLMES_LAW_ASSURANCE_POLICY_API_VERSION,
};
pub use versioning::{
    ArtifactFamily, ParsedSchemaVersion, VersionCheck, VersionRegistry, VersionRequirement,
};
