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

pub use application::{ResolvedArtifactPath, WeslawArtifactLocator};
pub use domain::{
    ArtifactFamily, ArtifactRef, BundleProvenance, HolmesDiagnostic, HolmesDiagnosticCode,
    HolmesLawEvidenceBundle, HolmesResult, HolmesSeverity, LawEvidenceArtifacts,
    ParsedSchemaVersion, VersionRegistry, VersionRequirement,
};
pub use ports::{
    ArtifactLoadPort, ArtifactWritePort, ClockPort, CommandIoPort, EchoReportRenderer,
    FilesystemPort, FixedClock, GithubPublishPort, InMemoryArtifactStore,
    InMemoryMcpResourceRegistry, McpResourcePort, PolicyLoadPort, RecordingCommandIo,
    RecordingGithubPublisher, ReportRenderPort, StaticPolicyLoader, Timestamp,
};
