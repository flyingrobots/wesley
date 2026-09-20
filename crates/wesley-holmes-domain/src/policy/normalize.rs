//! Parsing a policy document and resolving a profile, with inheritance, into a normalized policy.

use alloc::borrow::ToOwned;
use alloc::collections::{BTreeMap, BTreeSet};
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;

use super::schema::{
    HOLMES_LAW_ASSURANCE_POLICY_API_VERSION, LawAssuranceCoverageThresholdPolicy,
    LawAssurancePolicyProfile, LawAssurancePolicySchema, LawAssuranceSuppressionRule,
    NormalizedLawAssurancePolicy,
};
use super::validate::{
    known_policy_fields, parse_coverage_gate_state, parse_policy_event_kind, validate_suppression,
    validate_threshold,
};
use crate::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use crate::finding::LawFindingSeverity;
use crate::law_coverage_gate::{
    CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior, LawCoverageCategoryThreshold,
    LawCoverageGatePolicy,
};

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
