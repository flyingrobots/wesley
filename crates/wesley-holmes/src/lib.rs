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
    default_severity_for_event, evaluate_law_coverage_gates, percentage,
    semantic_change_findings_from_law_diff, sort_semantic_change_findings, ArtifactFamily,
    ArtifactRef, ArtifactRequirement, BundleArtifactRef, BundleProvenance, ContractBundleManifest,
    CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior, HolmesDiagnostic,
    HolmesDiagnosticCode, HolmesLawEvidenceBundle, HolmesResult, HolmesSeverity,
    LawCapabilityClosure, LawCapabilityFootprint, LawCapabilityReport, LawCapabilitySlot,
    LawCoverageCategory, LawCoverageCategoryThreshold, LawCoverageGateDecision,
    LawCoverageGatePolicy, LawCoverageGateState, LawCoverageReport, LawDiffEvent, LawDiffEventKind,
    LawDiffFieldChange, LawDiffLawKind, LawDiffReport, LawDiffReviewPosture, LawEvidenceArtifacts,
    LawEvidenceValidationResult, LawEvidenceValidationStatus, LawFindingSeverity,
    LoadedArtifactMetadata, NormalizedContractBundleProvenance, NormalizedLawCapabilityOperation,
    NormalizedLawCoverageCategory, NormalizedLawCoverageProfile, NormalizedLawDiffEvent,
    ParsedSchemaVersion, SemanticChangeFinding, VersionCheck, VersionRegistry, VersionRequirement,
    WESLEY_CAPABILITY_REPORT_API_VERSION, WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC,
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
