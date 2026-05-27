//! Deterministic diagnostic envelopes for Holmes law assurance.

use std::error::Error;
use std::fmt;

use serde::{Deserialize, Serialize};

/// Stable diagnostic code emitted by Holmes validation and ingest paths.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HolmesDiagnosticCode {
    /// A required `schemaVersion` field was absent or blank.
    HlawSchemaVersionMissing,
    /// A `schemaVersion` field was not valid semantic version syntax.
    HlawSchemaVersionMalformed,
    /// A `schemaVersion` is accepted but deprecated.
    HlawSchemaVersionDeprecated,
    /// A `schemaVersion` major version is not supported by this Holmes build.
    HlawSchemaVersionUnsupportedMajor,
    /// A `schemaVersion` minor version is newer than this Holmes build accepts.
    HlawSchemaVersionUnsupportedMinor,
    /// No local version requirement was configured for an artifact family.
    HlawSchemaVersionRequirementMissing,
    /// An artifact path attempted to escape the workspace root.
    HlawArtifactPathEscape,
    /// An artifact path was malformed before resolution.
    HlawArtifactPathInvalid,
    /// A law evidence bundle was missing a required artifact reference.
    HlawEvidenceBundleInvalid,
    /// A provenance hash was absent or blank.
    HlawProvenanceHashMissing,
    /// A provenance hash did not use canonical `sha256:<64 lowercase hex>` syntax.
    HlawProvenanceHashMalformed,
    /// A provenance source identity was absent or blank.
    HlawProvenanceSourceMissing,
    /// A requested artifact was unavailable through its port.
    HlawArtifactUnavailable,
    /// A requested artifact was present but unreadable through its port.
    HlawArtifactUnreadable,
    /// A requested artifact exceeded the configured byte limit.
    HlawArtifactOversized,
}

/// Severity attached to a Holmes diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HolmesSeverity {
    /// A hard failure that prevents safe continuation.
    Error,
    /// A non-blocking issue that should be visible in reports.
    Warning,
    /// Informational context attached to a report.
    Info,
}

/// Structured diagnostic envelope shared by validation and ingest flows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolmesDiagnostic {
    /// Stable diagnostic code.
    pub code: HolmesDiagnosticCode,
    /// Diagnostic severity.
    pub severity: HolmesSeverity,
    /// Human-readable explanation.
    pub message: String,
    /// Optional artifact family associated with this diagnostic.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_family: Option<String>,
    /// Optional field path associated with this diagnostic.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_path: Option<String>,
}

impl HolmesDiagnostic {
    /// Create a new diagnostic envelope.
    pub fn new(
        code: HolmesDiagnosticCode,
        severity: HolmesSeverity,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            severity,
            message: message.into(),
            artifact_family: None,
            field_path: None,
        }
    }

    /// Attach an artifact-family label.
    pub fn for_family(mut self, family: impl Into<String>) -> Self {
        self.artifact_family = Some(family.into());
        self
    }

    /// Attach a field path.
    pub fn at_field(mut self, field_path: impl Into<String>) -> Self {
        self.field_path = Some(field_path.into());
        self
    }
}

impl fmt::Display for HolmesDiagnostic {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:?}: {}", self.code, self.message)
    }
}

impl Error for HolmesDiagnostic {}

/// Result alias for Holmes domain and port operations.
pub type HolmesResult<T> = Result<T, HolmesDiagnostic>;
