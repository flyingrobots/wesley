//! Coverage gate decisions derived from normalized Wesley law coverage evidence.

use serde::{Deserialize, Serialize};

use super::law_coverage::NormalizedLawCoverageProfile;

/// Coverage gate state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LawCoverageGateState {
    /// Coverage satisfies policy.
    Pass,
    /// Coverage is below an advisory threshold.
    Warn,
    /// Coverage is below a required threshold.
    Fail,
    /// Coverage evidence or category evidence is unavailable.
    Unavailable,
}

impl LawCoverageGateState {
    /// Return the stable text label for renderer-neutral output.
    pub fn label(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Warn => "warn",
            Self::Fail => "fail",
            Self::Unavailable => "unavailable",
        }
    }
}

/// Policy behavior when the coverage artifact is unavailable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CoverageUnavailableBehavior {
    /// Emit an unavailable gate decision.
    Unavailable,
    /// Treat unavailable coverage as a failed gate.
    Fail,
}

/// Policy behavior when a category is absent from available coverage evidence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CoverageAbsentCategoryBehavior {
    /// Emit an unavailable gate decision.
    Unavailable,
    /// Treat the absent category as a failed gate.
    Fail,
}

/// Minimal coverage threshold policy input for one profile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCoverageGatePolicy {
    /// Profile evaluated by this policy.
    pub profile: String,
    /// Category thresholds evaluated for the profile.
    pub categories: Vec<LawCoverageCategoryThreshold>,
    /// Number of missing subjects to include in each decision.
    pub missing_subject_display_limit: usize,
    /// Behavior when coverage evidence is unavailable.
    pub unavailable_behavior: CoverageUnavailableBehavior,
    /// Behavior when a category is absent from available coverage evidence.
    pub absent_category_behavior: CoverageAbsentCategoryBehavior,
    /// Optional evidence artifact reference.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_ref: Option<String>,
}

/// Minimal threshold policy for one coverage category.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCoverageCategoryThreshold {
    /// Stable category identifier.
    pub category_id: String,
    /// Whether this category is required by policy.
    pub required: bool,
    /// Advisory threshold that produces a warning below this percentage.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_threshold: Option<f64>,
    /// Required threshold that produces a failure below this percentage.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_threshold: Option<f64>,
}

/// Coverage gate decision for one profile/category pair.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCoverageGateDecision {
    /// Stable gate id.
    pub gate_id: String,
    /// Evaluated profile.
    pub profile: String,
    /// Evaluated category id.
    pub category_id: String,
    /// Human-readable category label when evidence supplied it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_label: Option<String>,
    /// Gate state.
    pub state: LawCoverageGateState,
    /// Stable text state label.
    pub state_label: String,
    /// Whether this category is required by policy or evidence.
    pub required: bool,
    /// Covered subject count when evidence is available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub covered: Option<usize>,
    /// Total subject count when evidence is available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<usize>,
    /// Actual one-decimal coverage percentage when evidence is available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_percent: Option<f64>,
    /// Advisory threshold from policy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_threshold: Option<f64>,
    /// Required threshold from policy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_threshold: Option<f64>,
    /// Missing subject coordinates retained for inline display.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub missing_subjects: Vec<String>,
    /// Missing subject count omitted from inline display.
    pub omitted_missing_subject_count: usize,
    /// Optional evidence artifact reference.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_ref: Option<String>,
    /// Renderer-neutral rationale for the decision.
    pub rationale: String,
}

/// Evaluate coverage evidence against a minimal threshold policy.
pub fn evaluate_law_coverage_gates(
    coverage: Option<&NormalizedLawCoverageProfile>,
    policy: &LawCoverageGatePolicy,
) -> Vec<LawCoverageGateDecision> {
    policy
        .categories
        .iter()
        .map(|threshold| evaluate_category(coverage, policy, threshold))
        .collect()
}

fn evaluate_category(
    coverage: Option<&NormalizedLawCoverageProfile>,
    policy: &LawCoverageGatePolicy,
    threshold: &LawCoverageCategoryThreshold,
) -> LawCoverageGateDecision {
    let gate_id = format!("law-coverage:{}:{}", policy.profile, threshold.category_id);
    let Some(coverage) = coverage else {
        let state = match policy.unavailable_behavior {
            CoverageUnavailableBehavior::Unavailable => LawCoverageGateState::Unavailable,
            CoverageUnavailableBehavior::Fail => LawCoverageGateState::Fail,
        };
        return unavailable_decision(
            gate_id,
            policy,
            threshold,
            state,
            "coverage evidence is unavailable",
        );
    };

    if coverage.profile != policy.profile {
        let state = match policy.unavailable_behavior {
            CoverageUnavailableBehavior::Unavailable => LawCoverageGateState::Unavailable,
            CoverageUnavailableBehavior::Fail => LawCoverageGateState::Fail,
        };
        return unavailable_decision(
            gate_id,
            policy,
            threshold,
            state,
            "coverage evidence profile does not match policy profile",
        );
    }

    let Some(category) = coverage.category(&threshold.category_id) else {
        let state = match policy.absent_category_behavior {
            CoverageAbsentCategoryBehavior::Unavailable => LawCoverageGateState::Unavailable,
            CoverageAbsentCategoryBehavior::Fail => LawCoverageGateState::Fail,
        };
        return unavailable_decision(
            gate_id,
            policy,
            threshold,
            state,
            "coverage category is absent from evidence",
        );
    };

    let state = if threshold
        .failure_threshold
        .is_some_and(|failure_threshold| category.percent < failure_threshold)
    {
        LawCoverageGateState::Fail
    } else if threshold
        .warning_threshold
        .is_some_and(|warning_threshold| category.percent < warning_threshold)
    {
        LawCoverageGateState::Warn
    } else {
        LawCoverageGateState::Pass
    };

    let displayed_missing_subjects = category
        .missing_subjects
        .iter()
        .take(policy.missing_subject_display_limit)
        .cloned()
        .collect::<Vec<_>>();
    let omitted_missing_subject_count = category
        .missing_count
        .saturating_sub(displayed_missing_subjects.len());

    LawCoverageGateDecision {
        gate_id,
        profile: policy.profile.clone(),
        category_id: threshold.category_id.clone(),
        category_label: Some(category.label.clone()),
        state,
        state_label: state.label().to_owned(),
        required: threshold.required || category.required,
        covered: Some(category.covered),
        total: Some(category.total),
        actual_percent: Some(category.percent),
        warning_threshold: threshold.warning_threshold,
        failure_threshold: threshold.failure_threshold,
        missing_subjects: displayed_missing_subjects,
        omitted_missing_subject_count,
        evidence_ref: policy.evidence_ref.clone(),
        rationale: rationale_for_state(state, category.percent, threshold),
    }
}

fn unavailable_decision(
    gate_id: String,
    policy: &LawCoverageGatePolicy,
    threshold: &LawCoverageCategoryThreshold,
    state: LawCoverageGateState,
    rationale: &'static str,
) -> LawCoverageGateDecision {
    LawCoverageGateDecision {
        gate_id,
        profile: policy.profile.clone(),
        category_id: threshold.category_id.clone(),
        category_label: None,
        state,
        state_label: state.label().to_owned(),
        required: threshold.required,
        covered: None,
        total: None,
        actual_percent: None,
        warning_threshold: threshold.warning_threshold,
        failure_threshold: threshold.failure_threshold,
        missing_subjects: Vec::new(),
        omitted_missing_subject_count: 0,
        evidence_ref: policy.evidence_ref.clone(),
        rationale: rationale.to_owned(),
    }
}

fn rationale_for_state(
    state: LawCoverageGateState,
    actual_percent: f64,
    threshold: &LawCoverageCategoryThreshold,
) -> String {
    match state {
        LawCoverageGateState::Pass => "coverage satisfies configured thresholds".to_owned(),
        LawCoverageGateState::Warn => format!(
            "coverage {actual_percent:.1}% is below warning threshold {:.1}%",
            threshold
                .warning_threshold
                .expect("warning state requires warning threshold")
        ),
        LawCoverageGateState::Fail => format!(
            "coverage {actual_percent:.1}% is below failure threshold {:.1}%",
            threshold
                .failure_threshold
                .expect("failure state requires failure threshold")
        ),
        LawCoverageGateState::Unavailable => "coverage evidence is unavailable".to_owned(),
    }
}
