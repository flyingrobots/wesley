//! Domain-level law assurance policy parsing, normalization, and matching.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use super::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use super::finding::{LawFindingSeverity, SemanticChangeFinding};
use super::law_coverage_gate::{
    CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior, LawCoverageCategoryThreshold,
    LawCoverageGatePolicy, LawCoverageGateState,
};
use super::law_diff::LawDiffEventKind;

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

/// Parse a law assurance policy JSON artifact.
pub fn parse_law_assurance_policy(bytes: &[u8]) -> HolmesResult<LawAssurancePolicySchema> {
    let value = serde_json::from_slice::<serde_json::Value>(bytes).map_err(|error| {
        HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyMalformedJson,
            HolmesSeverity::Error,
            format!("law assurance policy is not valid JSON: {error}"),
        )
        .for_family("policy")
    })?;

    let object = value.as_object().ok_or_else(|| {
        HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyMalformedJson,
            HolmesSeverity::Error,
            "law assurance policy must be a JSON object",
        )
        .for_family("policy")
    })?;

    for key in object.keys() {
        if !known_policy_fields().contains(key.as_str()) {
            return Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawPolicyUnknownField,
                HolmesSeverity::Error,
                format!("law assurance policy contains unknown top-level field {key:?}"),
            )
            .for_family("policy")
            .at_field(key));
        }
    }

    let policy = serde_json::from_value::<LawAssurancePolicySchema>(value).map_err(|error| {
        HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyMalformedJson,
            HolmesSeverity::Error,
            format!("law assurance policy does not match v1 schema: {error}"),
        )
        .for_family("policy")
    })?;

    if policy.api_version != HOLMES_LAW_ASSURANCE_POLICY_API_VERSION {
        return Err(HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyUnsupportedVersion,
            HolmesSeverity::Error,
            format!(
                "unsupported law assurance policy apiVersion {:?}",
                policy.api_version
            ),
        )
        .for_family("policy")
        .at_field("apiVersion"));
    }

    if policy.profiles.is_empty() {
        return Err(HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyMissingProfile,
            HolmesSeverity::Error,
            "law assurance policy requires at least one profile",
        )
        .for_family("policy")
        .at_field("profiles"));
    }

    Ok(policy)
}

/// Normalize a policy for one profile.
pub fn normalize_law_assurance_policy(
    policy: &LawAssurancePolicySchema,
    profile: Option<&str>,
) -> HolmesResult<NormalizedLawAssurancePolicy> {
    if policy.api_version != HOLMES_LAW_ASSURANCE_POLICY_API_VERSION {
        return Err(HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyUnsupportedVersion,
            HolmesSeverity::Error,
            format!(
                "unsupported law assurance policy apiVersion {:?}",
                policy.api_version
            ),
        )
        .for_family("policy")
        .at_field("apiVersion"));
    }

    let profile_id = profile
        .or(policy.default_profile.as_deref())
        .ok_or_else(|| {
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawPolicyMissingProfile,
                HolmesSeverity::Error,
                "law assurance policy requires an explicit or default profile",
            )
            .for_family("policy")
            .at_field("defaultProfile")
        })?;

    let mut visiting = BTreeSet::new();
    let materialized = materialize_profile(policy, profile_id, &mut visiting)?;
    let mut categories = Vec::new();
    for (category_id, threshold) in &materialized.coverage_thresholds {
        validate_threshold(category_id, threshold)?;
        categories.push(LawCoverageCategoryThreshold {
            category_id: category_id.clone(),
            required: threshold.required,
            warning_threshold: threshold.warning_threshold,
            failure_threshold: threshold.failure_threshold,
        });
    }

    let mut suppressions = materialized
        .suppressions
        .into_iter()
        .filter(|rule| match rule.profile.as_deref() {
            Some(rule_profile) => rule_profile == profile_id,
            None => true,
        })
        .collect::<Vec<_>>();
    suppressions.sort_by(|left, right| left.id.cmp(&right.id));
    for suppression in &suppressions {
        validate_suppression(
            suppression,
            materialized.allow_broad_suppressions,
            profile_id,
        )?;
    }

    let mut non_overridable_gates = materialized.non_overridable_gates;
    non_overridable_gates.sort();
    non_overridable_gates.dedup();

    Ok(NormalizedLawAssurancePolicy {
        api_version: policy.api_version.clone(),
        profile: profile_id.to_owned(),
        severity_mappings: materialized.severity_mappings,
        coverage_gate_severity_mappings: materialized.coverage_gate_severity_mappings,
        default_severity: materialized.default_severity,
        severity_mapping_exhaustive: materialized.severity_mapping_exhaustive,
        coverage_gate_policy: LawCoverageGatePolicy {
            profile: profile_id.to_owned(),
            categories,
            missing_subject_display_limit: materialized.missing_subject_display_limit,
            unavailable_behavior: materialized.unavailable_behavior,
            absent_category_behavior: materialized.absent_category_behavior,
            evidence_ref: None,
        },
        suppressions,
        non_overridable_gates,
        allow_broad_suppressions: materialized.allow_broad_suppressions,
    })
}

/// Apply policy severity mappings without changing Wesley event identity.
pub fn map_semantic_finding_severities(
    findings: &[SemanticChangeFinding],
    policy: &NormalizedLawAssurancePolicy,
) -> HolmesResult<Vec<SemanticChangeFinding>> {
    findings
        .iter()
        .map(|finding| {
            let mut mapped = finding.clone();
            if let Some(severity) = policy.severity_for_event_kind(finding.event_kind)? {
                mapped.severity = severity;
                mapped.severity_label = severity.label().to_owned();
            }
            Ok(mapped)
        })
        .collect()
}

/// A semantic finding annotated with its suppression state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotatedFinding {
    /// The underlying semantic change finding.
    pub finding: SemanticChangeFinding,
    /// The suppression that muted this finding, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suppressed_by: Option<LawAssuranceSuppressionMatch>,
}

impl AnnotatedFinding {
    /// Return whether this finding was suppressed.
    pub fn is_suppressed(&self) -> bool {
        self.suppressed_by.is_some()
    }
}

/// Record of one successfully applied suppression.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuppressionApplicationRecord {
    /// Matched suppression id.
    pub suppression_id: String,
    /// Finding id that was muted.
    pub finding_id: String,
    /// Target selector that matched — determines the suppression scope.
    pub target: LawAssuranceSuppressionTarget,
    /// Owning person or team.
    pub owner: String,
    /// Human-authored reason text.
    pub reason: String,
    /// Creation date in `YYYY-MM-DD` format.
    pub created_on: String,
    /// Expiration date in `YYYY-MM-DD` format.
    pub expires_on: String,
    /// Audit tags retained from the suppression rule.
    pub audit_tags: Vec<String>,
}

/// Why a suppression rule was rejected.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum SuppressionRejectionReason {
    /// Evidence was invalid; no suppression may override an invalid bundle.
    InvalidEvidence,
    /// The suppression targeted a gate that policy marks non-overridable.
    NonOverridableGate {
        /// The protected gate id.
        gate_id: String,
    },
}

/// Record of one rejected suppression attempt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuppressionRejectionRecord {
    /// Rejected suppression id.
    pub suppression_id: String,
    /// Owning person or team.
    pub owner: String,
    /// Target of the rejected rule.
    pub target: LawAssuranceSuppressionTarget,
    /// Reason this suppression was rejected.
    pub rejection_reason: SuppressionRejectionReason,
}

/// Outcome of applying suppression policy to a set of semantic findings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuppressionPolicyOutcome {
    /// All findings annotated with their suppression state.
    pub annotated_findings: Vec<AnnotatedFinding>,
    /// Suppression rules that were successfully applied to a finding.
    pub applied: Vec<SuppressionApplicationRecord>,
    /// Suppression rules that were rejected by abuse-prevention policy.
    pub rejected: Vec<SuppressionRejectionRecord>,
    /// Ids of suppression rules that were present but expired.
    pub expired: Vec<String>,
    /// Diagnostics emitted for rejected and expired suppressions.
    pub diagnostics: Vec<HolmesDiagnostic>,
}

impl SuppressionPolicyOutcome {
    /// Return only the findings that were not suppressed.
    pub fn active_findings(&self) -> Vec<&SemanticChangeFinding> {
        self.annotated_findings
            .iter()
            .filter(|annotated| !annotated.is_suppressed())
            .map(|annotated| &annotated.finding)
            .collect()
    }
}

/// Apply suppression policy to a set of semantic findings.
///
/// Enforces three abuse-prevention rules in order:
/// 1. Invalid evidence blocks all suppressions.
/// 2. Suppressions targeting a non-overridable gate are rejected.
/// 3. Expired suppressions are reported as diagnostics but not applied.
///
/// # Parameters
///
/// - `evaluation_date` — current date in **`YYYY-MM-DD`** format. Malformed input
///   (wrong separators, timestamps with a time component, etc.) returns a single
///   `HlawSuppressionInvalid` diagnostic and leaves all findings unsuppressed.
///
/// # Matching semantics
///
/// A suppression silences **every** finding whose `target` (kind + selector) matches,
/// not just the first. The selector kind defines the blast radius: use `finding-id` to
/// suppress a single specific finding, `law-id` or `subject` to suppress an entire class.
/// Each finding is suppressed by **at most one rule**: the first matching suppression in
/// policy declaration order wins per finding.
///
/// # Expiry boundary
///
/// Expiry uses strict less-than (`expires_on < evaluation_date`), so a suppression
/// is still active on its `expiresOn` date (last valid day inclusive).
pub fn apply_suppression_policy(
    findings: &[SemanticChangeFinding],
    validation_result: &super::evidence::LawEvidenceValidationResult,
    policy: &NormalizedLawAssurancePolicy,
    evaluation_date: &str,
) -> SuppressionPolicyOutcome {
    use super::diagnostic::{HolmesDiagnosticCode, HolmesSeverity};
    use super::evidence::LawEvidenceValidationStatus;

    if !is_iso_date(evaluation_date) {
        return SuppressionPolicyOutcome {
            annotated_findings: findings
                .iter()
                .map(|f| AnnotatedFinding {
                    finding: f.clone(),
                    suppressed_by: None,
                })
                .collect(),
            applied: Vec::new(),
            rejected: Vec::new(),
            expired: Vec::new(),
            diagnostics: vec![HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawSuppressionInvalid,
                HolmesSeverity::Error,
                format!(
                    "evaluation_date {evaluation_date:?} is not in YYYY-MM-DD format; \
                     no suppressions were applied"
                ),
            )
            .for_family("policy")
            .at_field("evaluation_date")],
        };
    }

    let evidence_invalid = matches!(
        validation_result.status,
        LawEvidenceValidationStatus::Invalid | LawEvidenceValidationStatus::InfrastructureError,
    );

    let mut annotated_findings: Vec<AnnotatedFinding> = findings
        .iter()
        .map(|finding| AnnotatedFinding {
            finding: finding.clone(),
            suppressed_by: None,
        })
        .collect();

    let mut applied = Vec::new();
    let mut rejected = Vec::new();
    let mut expired = Vec::new();
    let mut diagnostics = Vec::new();

    for suppression in &policy.suppressions {
        // Rule 1: invalid evidence blocks all suppressions.
        if evidence_invalid {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawSuppressionRejectedInvalidEvidence,
                    HolmesSeverity::Error,
                    format!(
                        "suppression {} was rejected: evidence validation failed \
                         and suppressions cannot override invalid evidence",
                        suppression.id
                    ),
                )
                .for_family("policy")
                .at_field("suppressions"),
            );
            rejected.push(SuppressionRejectionRecord {
                suppression_id: suppression.id.clone(),
                owner: suppression.owner.clone(),
                target: suppression.target.clone(),
                rejection_reason: SuppressionRejectionReason::InvalidEvidence,
            });
            continue;
        }

        // Rule 2: non-overridable gate protection.
        if suppression.target.kind == LawAssuranceSuppressionTargetKind::GateId
            && policy
                .non_overridable_gates
                .contains(&suppression.target.selector)
        {
            let gate_id = suppression.target.selector.clone();
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawSuppressionRejectedNonOverridable,
                    HolmesSeverity::Error,
                    format!(
                        "suppression {} was rejected: gate {} is non-overridable",
                        suppression.id, gate_id,
                    ),
                )
                .for_family("policy")
                .at_field("suppressions"),
            );
            rejected.push(SuppressionRejectionRecord {
                suppression_id: suppression.id.clone(),
                owner: suppression.owner.clone(),
                target: suppression.target.clone(),
                rejection_reason: SuppressionRejectionReason::NonOverridableGate { gate_id },
            });
            continue;
        }

        // Rule 3: expired suppression — report but do not apply.
        if suppression.expires_on.as_str() < evaluation_date {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawSuppressionExpired,
                    HolmesSeverity::Warning,
                    format!(
                        "suppression {} expired on {} and was not applied",
                        suppression.id, suppression.expires_on,
                    ),
                )
                .for_family("policy")
                .at_field("suppressions"),
            );
            expired.push(suppression.id.clone());
            continue;
        }

        // Each suppression silences all findings it matches; each finding is suppressed by at
        // most one rule (first suppression in policy order wins per finding).
        for annotated in &mut annotated_findings {
            if annotated.suppressed_by.is_none()
                && suppression_matches_finding(suppression, &annotated.finding, evaluation_date)
            {
                applied.push(SuppressionApplicationRecord {
                    suppression_id: suppression.id.clone(),
                    finding_id: annotated.finding.finding_id.clone(),
                    target: suppression.target.clone(),
                    owner: suppression.owner.clone(),
                    reason: suppression.reason.clone(),
                    created_on: suppression.created_on.clone(),
                    expires_on: suppression.expires_on.clone(),
                    audit_tags: suppression.audit_tags.clone(),
                });
                annotated.suppressed_by = Some(LawAssuranceSuppressionMatch {
                    suppression_id: suppression.id.clone(),
                    owner: suppression.owner.clone(),
                    reason: suppression.reason.clone(),
                    expires_on: suppression.expires_on.clone(),
                    audit_tags: suppression.audit_tags.clone(),
                });
            }
        }
    }

    SuppressionPolicyOutcome {
        annotated_findings,
        applied,
        rejected,
        expired,
        diagnostics,
    }
}

/// Return active suppression matches for one semantic finding.
pub fn matching_suppressions_for_finding(
    finding: &SemanticChangeFinding,
    policy: &NormalizedLawAssurancePolicy,
    now_date: &str,
) -> Vec<LawAssuranceSuppressionMatch> {
    policy
        .suppressions
        .iter()
        .filter(|suppression| suppression_matches_finding(suppression, finding, now_date))
        .map(|suppression| LawAssuranceSuppressionMatch {
            suppression_id: suppression.id.clone(),
            owner: suppression.owner.clone(),
            reason: suppression.reason.clone(),
            expires_on: suppression.expires_on.clone(),
            audit_tags: suppression.audit_tags.clone(),
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq)]
struct MaterializedPolicyProfile {
    severity_mappings: BTreeMap<String, LawFindingSeverity>,
    coverage_gate_severity_mappings: BTreeMap<String, LawFindingSeverity>,
    default_severity: Option<LawFindingSeverity>,
    severity_mapping_exhaustive: bool,
    coverage_thresholds: BTreeMap<String, LawAssuranceCoverageThresholdPolicy>,
    missing_subject_display_limit: usize,
    unavailable_behavior: CoverageUnavailableBehavior,
    absent_category_behavior: CoverageAbsentCategoryBehavior,
    suppressions: Vec<LawAssuranceSuppressionRule>,
    non_overridable_gates: Vec<String>,
    allow_broad_suppressions: bool,
}

impl MaterializedPolicyProfile {
    fn from_schema(policy: &LawAssurancePolicySchema) -> HolmesResult<Self> {
        let mut severity_mappings = BTreeMap::new();
        insert_severity_mappings(
            &mut severity_mappings,
            &policy.severity_mappings,
            "severityMappings",
        )?;
        let mut coverage_gate_severity_mappings = BTreeMap::new();
        insert_coverage_severity_mappings(
            &mut coverage_gate_severity_mappings,
            &policy.coverage_severity_mappings,
            "coverageSeverityMappings",
        )?;

        Ok(Self {
            severity_mappings,
            coverage_gate_severity_mappings,
            default_severity: policy.default_severity,
            severity_mapping_exhaustive: policy.severity_mapping_exhaustive,
            coverage_thresholds: policy.coverage_thresholds.clone(),
            missing_subject_display_limit: policy.missing_subject_display_limit,
            unavailable_behavior: policy.unavailable_behavior,
            absent_category_behavior: policy.absent_category_behavior,
            suppressions: Vec::new(),
            non_overridable_gates: Vec::new(),
            allow_broad_suppressions: false,
        })
    }

    fn apply_profile(
        &mut self,
        profile_id: &str,
        profile: &LawAssurancePolicyProfile,
    ) -> HolmesResult<()> {
        insert_severity_mappings(
            &mut self.severity_mappings,
            &profile.severity_mappings,
            &format!("profiles.{profile_id}.severityMappings"),
        )?;
        insert_coverage_severity_mappings(
            &mut self.coverage_gate_severity_mappings,
            &profile.coverage_severity_mappings,
            &format!("profiles.{profile_id}.coverageSeverityMappings"),
        )?;

        if let Some(default_severity) = profile.default_severity {
            self.default_severity = Some(default_severity);
        }
        if let Some(exhaustive) = profile.severity_mapping_exhaustive {
            self.severity_mapping_exhaustive = exhaustive;
        }
        self.coverage_thresholds
            .extend(profile.coverage_thresholds.clone());
        if let Some(display_limit) = profile.missing_subject_display_limit {
            self.missing_subject_display_limit = display_limit;
        }
        if let Some(unavailable_behavior) = profile.unavailable_behavior {
            self.unavailable_behavior = unavailable_behavior;
        }
        if let Some(absent_category_behavior) = profile.absent_category_behavior {
            self.absent_category_behavior = absent_category_behavior;
        }
        self.suppressions.extend(profile.suppressions.clone());
        self.non_overridable_gates
            .extend(profile.non_overridable_gates.clone());
        if let Some(allow_broad_suppressions) = profile.allow_broad_suppressions {
            self.allow_broad_suppressions = allow_broad_suppressions;
        }

        Ok(())
    }
}

fn materialize_profile(
    policy: &LawAssurancePolicySchema,
    profile_id: &str,
    visiting: &mut BTreeSet<String>,
) -> HolmesResult<MaterializedPolicyProfile> {
    if !visiting.insert(profile_id.to_owned()) {
        return Err(HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyCircularInheritance,
            HolmesSeverity::Error,
            format!("law assurance policy profile {profile_id:?} inherits circularly"),
        )
        .for_family("policy")
        .at_field(format!("profiles.{profile_id}.inherits")));
    }

    let profile = policy.profiles.get(profile_id).ok_or_else(|| {
        HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawPolicyUnknownProfile,
            HolmesSeverity::Error,
            format!("law assurance policy profile {profile_id:?} is not defined"),
        )
        .for_family("policy")
        .at_field(format!("profiles.{profile_id}"))
    })?;

    let mut materialized = if let Some(parent_id) = profile.inherits.as_deref() {
        materialize_profile(policy, parent_id, visiting)?
    } else {
        MaterializedPolicyProfile::from_schema(policy)?
    };

    materialized.apply_profile(profile_id, profile)?;
    visiting.remove(profile_id);
    Ok(materialized)
}

fn insert_severity_mappings(
    target: &mut BTreeMap<String, LawFindingSeverity>,
    mappings: &BTreeMap<String, LawFindingSeverity>,
    field_prefix: &str,
) -> HolmesResult<()> {
    for (raw_kind, severity) in mappings {
        let event_kind = parse_policy_event_kind(raw_kind).ok_or_else(|| {
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawPolicyUnknownEventKind,
                HolmesSeverity::Error,
                format!("policy severity mapping references unknown event kind {raw_kind:?}"),
            )
            .for_family("policy")
            .at_field(format!("{field_prefix}.{raw_kind}"))
        })?;
        target.insert(event_kind.as_str().to_owned(), *severity);
    }
    Ok(())
}

fn insert_coverage_severity_mappings(
    target: &mut BTreeMap<String, LawFindingSeverity>,
    mappings: &BTreeMap<String, LawFindingSeverity>,
    field_prefix: &str,
) -> HolmesResult<()> {
    for (raw_state, severity) in mappings {
        let state = parse_coverage_gate_state(raw_state).ok_or_else(|| {
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawPolicyUnknownEventKind,
                HolmesSeverity::Error,
                format!(
                    "policy coverage severity mapping references unknown gate state {raw_state:?}"
                ),
            )
            .for_family("policy")
            .at_field(format!("{field_prefix}.{raw_state}"))
        })?;
        target.insert(state.label().to_owned(), *severity);
    }
    Ok(())
}

fn validate_threshold(
    category_id: &str,
    threshold: &LawAssuranceCoverageThresholdPolicy,
) -> HolmesResult<()> {
    if category_id.trim().is_empty() {
        return invalid_threshold(
            "coverageThresholds",
            "coverage category id must not be blank",
        );
    }

    if let Some(warning_threshold) = threshold.warning_threshold {
        validate_percent(
            warning_threshold,
            &format!("coverageThresholds.{category_id}.warningThreshold"),
        )?;
    }
    if let Some(failure_threshold) = threshold.failure_threshold {
        validate_percent(
            failure_threshold,
            &format!("coverageThresholds.{category_id}.failureThreshold"),
        )?;
    }
    if let (Some(warning_threshold), Some(failure_threshold)) =
        (threshold.warning_threshold, threshold.failure_threshold)
    {
        if warning_threshold < failure_threshold {
            return invalid_threshold(
                &format!("coverageThresholds.{category_id}.warningThreshold"),
                "warning threshold must be greater than or equal to failure threshold",
            );
        }
    }

    Ok(())
}

fn validate_percent(percent: f64, field_path: &str) -> HolmesResult<()> {
    if percent.is_finite() && (0.0..=100.0).contains(&percent) {
        Ok(())
    } else {
        invalid_threshold(field_path, "threshold percentage must be between 0 and 100")
    }
}

fn invalid_threshold(field_path: &str, message: &str) -> HolmesResult<()> {
    Err(HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawPolicyInvalidThreshold,
        HolmesSeverity::Error,
        message,
    )
    .for_family("policy")
    .at_field(field_path))
}

fn validate_suppression(
    suppression: &LawAssuranceSuppressionRule,
    allow_broad_suppressions: bool,
    profile_id: &str,
) -> HolmesResult<()> {
    let field_prefix = format!("profiles.{profile_id}.suppressions.{}", suppression.id);
    if suppression.id.trim().is_empty() {
        return invalid_suppression(&field_prefix, "suppression id must not be blank");
    }
    if suppression.owner.trim().is_empty() {
        return invalid_suppression(
            &format!("{field_prefix}.owner"),
            "suppression owner must not be blank",
        );
    }
    if suppression.reason.trim().is_empty() {
        return invalid_suppression(
            &format!("{field_prefix}.reason"),
            "suppression reason must not be blank",
        );
    }
    if suppression.target.selector.trim().is_empty() {
        return invalid_suppression(
            &format!("{field_prefix}.target.selector"),
            "suppression selector must not be blank",
        );
    }
    if suppression.target.selector == "*" && !allow_broad_suppressions {
        return invalid_suppression(
            &format!("{field_prefix}.target.selector"),
            "broad wildcard suppression is disabled for this profile",
        );
    }
    if suppression.allowed_severities.is_empty() {
        return invalid_suppression(
            &format!("{field_prefix}.allowedSeverities"),
            "suppression must list allowed severities",
        );
    }
    if !is_iso_date(&suppression.created_on) {
        return invalid_suppression(
            &format!("{field_prefix}.createdOn"),
            "suppression createdOn must use YYYY-MM-DD",
        );
    }
    if !is_iso_date(&suppression.expires_on) {
        return invalid_suppression(
            &format!("{field_prefix}.expiresOn"),
            "suppression expiresOn must use YYYY-MM-DD",
        );
    }
    if suppression.expires_on < suppression.created_on {
        return invalid_suppression(
            &format!("{field_prefix}.expiresOn"),
            "suppression expiresOn must not precede createdOn",
        );
    }

    Ok(())
}

fn invalid_suppression(field_path: &str, message: &str) -> HolmesResult<()> {
    Err(HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawSuppressionInvalid,
        HolmesSeverity::Error,
        message,
    )
    .for_family("policy")
    .at_field(field_path))
}

fn suppression_matches_finding(
    suppression: &LawAssuranceSuppressionRule,
    finding: &SemanticChangeFinding,
    now_date: &str,
) -> bool {
    if suppression.expires_on.as_str() < now_date {
        return false;
    }
    if !suppression.allowed_severities.contains(&finding.severity) {
        return false;
    }

    match suppression.target.kind {
        LawAssuranceSuppressionTargetKind::FindingId => {
            finding.finding_id == suppression.target.selector
        }
        LawAssuranceSuppressionTargetKind::LawId => {
            finding.law_id.as_deref() == Some(suppression.target.selector.as_str())
        }
        LawAssuranceSuppressionTargetKind::Subject => {
            finding.subject.as_deref() == Some(suppression.target.selector.as_str())
        }
        LawAssuranceSuppressionTargetKind::Category | LawAssuranceSuppressionTargetKind::GateId => {
            false
        }
    }
}

fn parse_policy_event_kind(raw_kind: &str) -> Option<LawDiffEventKind> {
    LawDiffEventKind::parse(raw_kind).or_else(|| {
        let canonical = canonical_event_kind_key(raw_kind);
        LawDiffEventKind::parse(&canonical)
    })
}

fn parse_coverage_gate_state(raw_state: &str) -> Option<LawCoverageGateState> {
    match raw_state {
        "pass" | "PASS" => Some(LawCoverageGateState::Pass),
        "warn" | "warning" | "WARN" | "WARNING" => Some(LawCoverageGateState::Warn),
        "fail" | "failure" | "FAIL" | "FAILURE" => Some(LawCoverageGateState::Fail),
        "unavailable" | "UNAVAILABLE" => Some(LawCoverageGateState::Unavailable),
        _ => None,
    }
}

fn canonical_event_kind_key(raw_kind: &str) -> String {
    let mut canonical = String::new();
    let mut previous_was_separator = true;
    for character in raw_kind.chars() {
        if matches!(character, '-' | '_' | ' ') {
            if !canonical.ends_with('_') {
                canonical.push('_');
            }
            previous_was_separator = true;
        } else if character.is_ascii_uppercase() {
            if !previous_was_separator && !canonical.ends_with('_') {
                canonical.push('_');
            }
            canonical.push(character);
            previous_was_separator = false;
        } else {
            canonical.push(character.to_ascii_uppercase());
            previous_was_separator = false;
        }
    }
    canonical.trim_matches('_').to_owned()
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
}

fn known_policy_fields() -> BTreeSet<&'static str> {
    [
        "apiVersion",
        "defaultProfile",
        "severityMappings",
        "coverageSeverityMappings",
        "defaultSeverity",
        "severityMappingExhaustive",
        "coverageThresholds",
        "missingSubjectDisplayLimit",
        "unavailableBehavior",
        "absentCategoryBehavior",
        "requiredEvidence",
        "failOn",
        "profiles",
        "schemaMetadata",
    ]
    .into_iter()
    .collect()
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
