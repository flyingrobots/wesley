//! The policy document as written and as normalized: the serde schema types.

use alloc::collections::BTreeMap;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;

use serde::{Deserialize, Serialize};

use crate::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use crate::finding::LawFindingSeverity;
use crate::law_coverage_gate::{
    CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior, LawCoverageGatePolicy,
    LawCoverageGateState,
};
use crate::law_diff::LawDiffEventKind;

/// Supported law assurance policy API version.
pub const HOLMES_LAW_ASSURANCE_POLICY_API_VERSION: &str = "holmes.law-assurance-policy/v1";

const DEFAULT_MISSING_SUBJECT_DISPLAY_LIMIT: usize = 25;

/// Versioned Holmes law assurance policy envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssurancePolicySchema {
    /// Policy artifact API version.
    pub api_version: String,
    /// Default profile selected when the caller does not provide one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_profile: Option<String>,
    /// Top-level severity mappings inherited by profiles.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Top-level coverage gate state severity mappings inherited by profiles.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub coverage_severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Top-level severity fallback inherited by profiles.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_severity: Option<LawFindingSeverity>,
    /// Whether inherited severity mappings must cover every event kind.
    #[serde(default)]
    pub severity_mapping_exhaustive: bool,
    /// Top-level coverage thresholds inherited by profiles.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub coverage_thresholds: BTreeMap<String, LawAssuranceCoverageThresholdPolicy>,
    /// Missing-subject display limit inherited by profiles.
    #[serde(default = "default_missing_subject_display_limit")]
    pub missing_subject_display_limit: usize,
    /// Unavailable-evidence behavior inherited by profiles.
    #[serde(default = "default_unavailable_behavior")]
    pub unavailable_behavior: CoverageUnavailableBehavior,
    /// Absent-category behavior inherited by profiles.
    #[serde(default = "default_absent_category_behavior")]
    pub absent_category_behavior: CoverageAbsentCategoryBehavior,
    /// Required evidence labels retained for later application services.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub required_evidence: Vec<String>,
    /// Fail-on labels retained for later application services.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fail_on: Vec<String>,
    /// Named policy profiles.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub profiles: BTreeMap<String, LawAssurancePolicyProfile>,
    /// Optional schema metadata retained for deterministic policy snapshots.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub schema_metadata: BTreeMap<String, String>,
}

/// Profile-specific policy overlay.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssurancePolicyProfile {
    /// Optional parent profile identifier.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inherits: Option<String>,
    /// Profile-local severity mapping overrides.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Profile-local coverage gate state severity overrides.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub coverage_severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Profile-local severity fallback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_severity: Option<LawFindingSeverity>,
    /// Profile-local exhaustive severity setting.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity_mapping_exhaustive: Option<bool>,
    /// Profile-local coverage threshold overrides.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub coverage_thresholds: BTreeMap<String, LawAssuranceCoverageThresholdPolicy>,
    /// Profile-local missing-subject display limit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub missing_subject_display_limit: Option<usize>,
    /// Profile-local unavailable-evidence behavior.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unavailable_behavior: Option<CoverageUnavailableBehavior>,
    /// Profile-local absent-category behavior.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub absent_category_behavior: Option<CoverageAbsentCategoryBehavior>,
    /// Profile-local suppression rules.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub suppressions: Vec<LawAssuranceSuppressionRule>,
    /// Gate ids that suppression and override handling must not bypass.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub non_overridable_gates: Vec<String>,
    /// Whether broad wildcard suppressions are accepted for this profile.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_broad_suppressions: Option<bool>,
}

/// Coverage threshold policy for one category.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceCoverageThresholdPolicy {
    /// Whether this category is required by policy.
    #[serde(default)]
    pub required: bool,
    /// Warning threshold percentage.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warning_threshold: Option<f64>,
    /// Failure threshold percentage.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_threshold: Option<f64>,
}

/// Suppression target kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LawAssuranceSuppressionTargetKind {
    /// Match a semantic finding id exactly.
    FindingId,
    /// Match a gate id exactly.
    GateId,
    /// Match a law id exactly.
    LawId,
    /// Match a subject coordinate exactly.
    Subject,
    /// Match a coverage category id exactly.
    Category,
}

/// Target selector for one suppression rule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceSuppressionTarget {
    /// Target kind.
    pub kind: LawAssuranceSuppressionTargetKind,
    /// Exact selector value.
    pub selector: String,
}

/// Policy-bound suppression rule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceSuppressionRule {
    /// Stable suppression id.
    pub id: String,
    /// Target selector.
    pub target: LawAssuranceSuppressionTarget,
    /// Optional profile restriction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    /// Human-authored reason text.
    pub reason: String,
    /// Owning person or team.
    pub owner: String,
    /// Creation date in `YYYY-MM-DD` format.
    pub created_on: String,
    /// Expiration date in `YYYY-MM-DD` format.
    pub expires_on: String,
    /// Severities this suppression may suppress.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_severities: Vec<LawFindingSeverity>,
    /// Audit tags retained in suppression summaries.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audit_tags: Vec<String>,
}

/// Matched suppression summary for one finding.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceSuppressionMatch {
    /// Matched suppression id.
    pub suppression_id: String,
    /// Owning person or team.
    pub owner: String,
    /// Human-authored reason text.
    pub reason: String,
    /// Expiration date in `YYYY-MM-DD` format.
    pub expires_on: String,
    /// Audit tags retained from the matched suppression.
    pub audit_tags: Vec<String>,
}

/// Normalized profile materialized from a law assurance policy.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedLawAssurancePolicy {
    /// Policy artifact API version.
    pub api_version: String,
    /// Selected profile id.
    pub profile: String,
    /// Canonical event-kind to severity mapping.
    pub severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Coverage gate state to severity mapping.
    pub coverage_gate_severity_mappings: BTreeMap<String, LawFindingSeverity>,
    /// Severity fallback used when an event kind is not explicitly mapped.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_severity: Option<LawFindingSeverity>,
    /// Whether every event kind must be explicitly mapped.
    pub severity_mapping_exhaustive: bool,
    /// Materialized coverage gate policy for the selected profile.
    pub coverage_gate_policy: LawCoverageGatePolicy,
    /// Active suppression rules for the selected profile.
    pub suppressions: Vec<LawAssuranceSuppressionRule>,
    /// Gate ids that suppression and override handling must not bypass.
    pub non_overridable_gates: Vec<String>,
    /// Whether broad wildcard suppressions are accepted for this profile.
    pub allow_broad_suppressions: bool,
}

impl NormalizedLawAssurancePolicy {
    /// Return the configured severity for an event kind.
    pub fn severity_for_event_kind(
        &self,
        event_kind: LawDiffEventKind,
    ) -> HolmesResult<Option<LawFindingSeverity>> {
        if let Some(severity) = self.severity_mappings.get(event_kind.as_str()).copied() {
            return Ok(Some(severity));
        }

        if let Some(default_severity) = self.default_severity {
            return Ok(Some(default_severity));
        }

        if self.severity_mapping_exhaustive {
            Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawSeverityUnmappedEventKind,
                HolmesSeverity::Error,
                format!(
                    "policy profile {:?} does not map event kind {}",
                    self.profile,
                    event_kind.as_str()
                ),
            )
            .for_family("policy")
            .at_field(format!("severityMappings.{}", event_kind.as_str())))
        } else {
            Ok(None)
        }
    }

    /// Return the configured severity for a coverage gate state.
    pub fn severity_for_coverage_gate_state(
        &self,
        gate_state: LawCoverageGateState,
    ) -> Option<LawFindingSeverity> {
        self.coverage_gate_severity_mappings
            .get(gate_state.label())
            .copied()
    }
}

fn default_missing_subject_display_limit() -> usize {
    DEFAULT_MISSING_SUBJECT_DISPLAY_LIMIT
}

fn default_unavailable_behavior() -> CoverageUnavailableBehavior {
    CoverageUnavailableBehavior::Unavailable
}

fn default_absent_category_behavior() -> CoverageAbsentCategoryBehavior {
    CoverageAbsentCategoryBehavior::Unavailable
}
