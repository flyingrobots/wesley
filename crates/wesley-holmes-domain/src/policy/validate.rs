//! Validation of thresholds and suppressions, and the small parsers they share.

use alloc::borrow::ToOwned;
use alloc::collections::BTreeSet;
use alloc::format;
use alloc::string::String;

use super::schema::{LawAssuranceCoverageThresholdPolicy, LawAssuranceSuppressionRule};
use crate::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use crate::law_coverage_gate::LawCoverageGateState;
use crate::law_diff::LawDiffEventKind;

pub(super) fn validate_threshold(
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
        && warning_threshold < failure_threshold
    {
        return invalid_threshold(
            &format!("coverageThresholds.{category_id}.warningThreshold"),
            "warning threshold must be greater than or equal to failure threshold",
        );
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

pub(super) fn validate_suppression(
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

pub(super) fn parse_policy_event_kind(raw_kind: &str) -> Option<LawDiffEventKind> {
    LawDiffEventKind::parse(raw_kind).or_else(|| {
        let canonical = canonical_event_kind_key(raw_kind);
        LawDiffEventKind::parse(&canonical)
    })
}

pub(super) fn parse_coverage_gate_state(raw_state: &str) -> Option<LawCoverageGateState> {
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

pub(super) fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
}

pub(super) fn known_policy_fields() -> BTreeSet<&'static str> {
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
