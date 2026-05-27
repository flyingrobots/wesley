//! Schema-version registry for Holmes artifact families.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};

/// Artifact families that Holmes accepts at its ingest boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArtifactFamily {
    /// Law evidence bundle envelope.
    EvidenceBundle,
    /// Machine-readable law diff artifact.
    LawDiff,
    /// Law coverage artifact.
    LawCoverage,
    /// Law capability summary artifact.
    LawCapabilities,
    /// Contract bundle manifest artifact.
    ContractBundleManifest,
    /// Assurance policy artifact.
    Policy,
    /// Rendered or structured assurance report artifact.
    Report,
    /// Audit witness artifact.
    AuditWitness,
    /// MCP response payload artifact.
    McpResponse,
    /// Agent summary payload artifact.
    AgentSummary,
    /// GitHub PR comment or review payload artifact.
    GithubPayload,
}

impl ArtifactFamily {
    /// Return the stable artifact-family identifier.
    pub fn id(self) -> &'static str {
        match self {
            ArtifactFamily::EvidenceBundle => "evidence-bundle",
            ArtifactFamily::LawDiff => "law-diff",
            ArtifactFamily::LawCoverage => "law-coverage",
            ArtifactFamily::LawCapabilities => "law-capabilities",
            ArtifactFamily::ContractBundleManifest => "contract-bundle-manifest",
            ArtifactFamily::Policy => "policy",
            ArtifactFamily::Report => "report",
            ArtifactFamily::AuditWitness => "audit-witness",
            ArtifactFamily::McpResponse => "mcp-response",
            ArtifactFamily::AgentSummary => "agent-summary",
            ArtifactFamily::GithubPayload => "github-payload",
        }
    }

    fn all() -> [ArtifactFamily; 11] {
        [
            ArtifactFamily::EvidenceBundle,
            ArtifactFamily::LawDiff,
            ArtifactFamily::LawCoverage,
            ArtifactFamily::LawCapabilities,
            ArtifactFamily::ContractBundleManifest,
            ArtifactFamily::Policy,
            ArtifactFamily::Report,
            ArtifactFamily::AuditWitness,
            ArtifactFamily::McpResponse,
            ArtifactFamily::AgentSummary,
            ArtifactFamily::GithubPayload,
        ]
    }
}

/// Parsed three-part semantic schema version.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSchemaVersion {
    /// Major version.
    pub major: u64,
    /// Minor version.
    pub minor: u64,
    /// Patch version.
    pub patch: u64,
}

impl ParsedSchemaVersion {
    /// Parse a strict `MAJOR.MINOR.PATCH` schema version.
    pub fn parse(value: &str) -> HolmesResult<Self> {
        let parts = value.split('.').collect::<Vec<_>>();
        if parts.len() != 3 || parts.iter().any(|part| part.is_empty()) {
            return Err(malformed_version(value));
        }

        let parse_part = |part: &str| {
            if !part.bytes().all(|byte| byte.is_ascii_digit()) {
                return Err(malformed_version(value));
            }
            if part.len() > 1 && part.starts_with('0') {
                return Err(malformed_version(value));
            }
            part.parse::<u64>().map_err(|_| malformed_version(value))
        };

        Ok(Self {
            major: parse_part(parts[0])?,
            minor: parse_part(parts[1])?,
            patch: parse_part(parts[2])?,
        })
    }
}

/// Accepted version requirement for one artifact family.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionRequirement {
    /// Artifact family covered by the requirement.
    pub family: ArtifactFamily,
    /// Accepted major version.
    pub major: u64,
    /// Highest accepted minor version for the accepted major.
    pub max_minor: u64,
    /// Highest accepted minor version that should be reported as deprecated.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deprecated_minor_through: Option<u64>,
}

impl VersionRequirement {
    /// Create a version requirement.
    pub fn new(family: ArtifactFamily, major: u64, max_minor: u64) -> Self {
        Self {
            family,
            major,
            max_minor,
            deprecated_minor_through: None,
        }
    }

    /// Mark accepted versions at or below a minor version as deprecated.
    pub fn with_deprecated_minor_through(mut self, minor: u64) -> Self {
        self.deprecated_minor_through = Some(minor);
        self
    }
}

/// Schema-version validation details for an accepted artifact version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionCheck {
    /// Parsed schema version.
    pub parsed: ParsedSchemaVersion,
    /// Non-fatal diagnostics, such as deprecation warnings.
    pub diagnostics: Vec<HolmesDiagnostic>,
}

/// Local registry of accepted artifact-family schema versions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionRegistry {
    requirements: BTreeMap<ArtifactFamily, VersionRequirement>,
}

impl VersionRegistry {
    /// Create a registry from explicit requirements.
    pub fn new(requirements: impl IntoIterator<Item = VersionRequirement>) -> Self {
        Self {
            requirements: requirements
                .into_iter()
                .map(|requirement| (requirement.family, requirement))
                .collect(),
        }
    }

    /// Return a registry with one requirement inserted or replaced.
    pub fn with_requirement(mut self, requirement: VersionRequirement) -> Self {
        self.requirements.insert(requirement.family, requirement);
        self
    }

    /// Return the requirement for an artifact family.
    pub fn requirement(&self, family: ArtifactFamily) -> Option<VersionRequirement> {
        self.requirements.get(&family).copied()
    }

    /// Validate a schema version for an artifact family.
    pub fn validate(
        &self,
        family: ArtifactFamily,
        schema_version: Option<&str>,
    ) -> HolmesResult<ParsedSchemaVersion> {
        Ok(self.classify(family, schema_version)?.parsed)
    }

    /// Validate and classify a schema version for an artifact family.
    pub fn classify(
        &self,
        family: ArtifactFamily,
        schema_version: Option<&str>,
    ) -> HolmesResult<VersionCheck> {
        let Some(raw_version) = schema_version else {
            return Err(missing_version(family));
        };

        if raw_version.trim().is_empty() {
            return Err(missing_version(family));
        }

        let parsed = ParsedSchemaVersion::parse(raw_version)
            .map_err(|diagnostic| diagnostic.for_family(family.id()))?;
        let requirement = self
            .requirement(family)
            .ok_or_else(|| missing_requirement(family))?;

        if parsed.major != requirement.major {
            return Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMajor,
                HolmesSeverity::Error,
                format!(
                    "unsupported {} schemaVersion major {}; expected {}",
                    family.id(),
                    parsed.major,
                    requirement.major
                ),
            )
            .for_family(family.id())
            .at_field("schemaVersion"));
        }

        if parsed.minor > requirement.max_minor {
            return Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawSchemaVersionUnsupportedMinor,
                HolmesSeverity::Error,
                format!(
                    "unsupported {} schemaVersion minor {}; maximum accepted minor is {}",
                    family.id(),
                    parsed.minor,
                    requirement.max_minor
                ),
            )
            .for_family(family.id())
            .at_field("schemaVersion"));
        }

        let mut diagnostics = Vec::new();
        if requirement
            .deprecated_minor_through
            .is_some_and(|minor| parsed.minor <= minor)
        {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawSchemaVersionDeprecated,
                    HolmesSeverity::Warning,
                    format!(
                        "{} schemaVersion {}.{}.{} is accepted but deprecated",
                        family.id(),
                        parsed.major,
                        parsed.minor,
                        parsed.patch
                    ),
                )
                .for_family(family.id())
                .at_field("schemaVersion"),
            );
        }

        Ok(VersionCheck {
            parsed,
            diagnostics,
        })
    }
}

impl Default for VersionRegistry {
    fn default() -> Self {
        Self::new(
            ArtifactFamily::all()
                .into_iter()
                .map(|family| VersionRequirement::new(family, 1, 0)),
        )
    }
}

fn missing_version(family: ArtifactFamily) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawSchemaVersionMissing,
        HolmesSeverity::Error,
        format!("{} artifact is missing schemaVersion", family.id()),
    )
    .for_family(family.id())
    .at_field("schemaVersion")
}

fn malformed_version(value: &str) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawSchemaVersionMalformed,
        HolmesSeverity::Error,
        format!("schemaVersion must use MAJOR.MINOR.PATCH digits, got {value:?}"),
    )
    .at_field("schemaVersion")
}

fn missing_requirement(family: ArtifactFamily) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawSchemaVersionRequirementMissing,
        HolmesSeverity::Error,
        format!(
            "no schemaVersion requirement is configured for {}",
            family.id()
        ),
    )
    .for_family(family.id())
    .at_field("schemaVersion")
}
