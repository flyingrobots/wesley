#![deny(warnings)]
#![deny(missing_docs)]

//! Rust Holmes law assurance foundation for Wesley.
//!
//! This crate hosts the new Holmes boundary that consumes Wesley-published law
//! evidence. The first implementation slice keeps the domain pure, exposes
//! deterministic ports, and validates artifact-family version envelopes without
//! adding public CLI commands.

pub mod adapters;
pub mod application;
pub mod domain;
pub mod ports;
pub mod reporting;

pub use application::{
    ContractBundleManifestIngestPort, ContractBundleManifestIngestResult,
    ContractBundleManifestIngestStatus, JsonContractBundleManifestIngestPort,
    JsonLawCapabilityIngestPort, JsonLawCoverageIngestPort, JsonLawDiffIngestPort,
    LawCapabilityIngestPort, LawCapabilityIngestResult, LawCapabilityIngestStatus,
    LawCoverageIngestPort, LawCoverageIngestResult, LawCoverageIngestStatus, LawDiffIngestPort,
    LawDiffIngestResult, LawDiffIngestStatus, LawEvidenceValidator, ResolvedArtifactPath,
    WeslawArtifactLocator,
};
pub use domain::{
    aggregate_law_assurance_assessment, apply_suppression_policy, bounded_finding_summary,
    default_severity_for_event, evaluate_bundle_traceability, evaluate_law_coverage_gates,
    law_assurance_provenance_report, map_semantic_finding_severities,
    matching_suppressions_for_finding, normalize_law_assurance_policy, parse_law_assurance_policy,
    percentage, semantic_change_findings_from_law_diff, sort_semantic_change_findings,
    AnnotatedFinding, ArtifactFamily, ArtifactRef, ArtifactRequirement, BoundedFindingSummary,
    BundleArtifactRef, BundleProvenance, BundleTraceabilityCheck, BundleTraceabilityGateDecision,
    BundleTraceabilityGateState, ContractBundleManifest, CoverageAbsentCategoryBehavior,
    CoverageUnavailableBehavior, HolmesDiagnostic, HolmesDiagnosticCode, HolmesLawEvidenceBundle,
    HolmesResult, HolmesSeverity, LawAssuranceArtifactProvenance, LawAssuranceAssessmentOutcome,
    LawAssuranceAssessmentSummary, LawAssuranceCoverageThresholdPolicy, LawAssurancePolicyProfile,
    LawAssurancePolicySchema, LawAssuranceProvenanceReport, LawAssuranceSuppressionMatch,
    LawAssuranceSuppressionRule, LawAssuranceSuppressionTarget, LawAssuranceSuppressionTargetKind,
    LawCapabilityClosure, LawCapabilityFootprint, LawCapabilityReport, LawCapabilitySlot,
    LawCoverageCategory, LawCoverageCategoryThreshold, LawCoverageGateDecision,
    LawCoverageGatePolicy, LawCoverageGateState, LawCoverageReport, LawDiffEvent, LawDiffEventKind,
    LawDiffFieldChange, LawDiffLawKind, LawDiffReport, LawDiffReviewPosture, LawEvidenceArtifacts,
    LawEvidenceValidationResult, LawEvidenceValidationStatus, LawFindingSeverity,
    LoadedArtifactMetadata, NormalizedContractBundleProvenance, NormalizedLawAssurancePolicy,
    NormalizedLawCapabilityOperation, NormalizedLawCoverageCategory, NormalizedLawCoverageProfile,
    NormalizedLawDiffEvent, ParsedSchemaVersion, SemanticChangeFinding,
    SuppressionApplicationRecord, SuppressionPolicyOutcome, SuppressionRejectionReason,
    SuppressionRejectionRecord, VersionCheck, VersionRegistry, VersionRequirement,
    HOLMES_LAW_ASSURANCE_POLICY_API_VERSION, WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC,
    WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION, WESLEY_LAW_CAPABILITIES_API_VERSION,
    WESLEY_LAW_COVERAGE_API_VERSION, WESLEY_LAW_DIFF_API_VERSION,
    WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
};
pub use ports::{
    ArtifactLoadPort, ArtifactWritePort, ClockPort, CommandIoPort, EchoReportRenderer,
    FilesystemPort, FixedClock, GithubPublishPort, InMemoryArtifactStore,
    InMemoryMcpResourceRegistry, McpResourcePort, PolicyLoadPort, RecordingCommandIo,
    RecordingGithubPublisher, ReportRenderPort, StaticPolicyLoader, Timestamp,
};
