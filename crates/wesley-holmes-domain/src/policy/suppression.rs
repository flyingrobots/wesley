//! Applying a normalized policy to findings: severity mapping and suppression.

use alloc::borrow::ToOwned;
use alloc::format;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;

use serde::{Deserialize, Serialize};

use super::schema::{
    LawAssuranceSuppressionMatch, LawAssuranceSuppressionRule, LawAssuranceSuppressionTarget,
    LawAssuranceSuppressionTargetKind, NormalizedLawAssurancePolicy,
};
use super::validate::is_iso_date;
use crate::diagnostic::{HolmesDiagnostic, HolmesResult};
use crate::finding::SemanticChangeFinding;

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
    validation_result: &crate::evidence::LawEvidenceValidationResult,
    policy: &NormalizedLawAssurancePolicy,
    evaluation_date: &str,
) -> SuppressionPolicyOutcome {
    use crate::diagnostic::{HolmesDiagnosticCode, HolmesSeverity};
    use crate::evidence::LawEvidenceValidationStatus;

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
            diagnostics: vec![
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawSuppressionInvalid,
                    HolmesSeverity::Error,
                    format!(
                        "evaluation_date {evaluation_date:?} is not in YYYY-MM-DD format; \
                     no suppressions were applied"
                    ),
                )
                .for_family("policy")
                .at_field("evaluation_date"),
            ],
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
