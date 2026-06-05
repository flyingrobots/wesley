//! Domain-level Holmes law assurance assessment and traceability models.

use serde::{Deserialize, Serialize};

use super::contract_manifest::{ContractBundleManifest, NormalizedContractBundleProvenance};
use super::evidence::{
    HolmesLawEvidenceBundle, LawEvidenceValidationResult, LawEvidenceValidationStatus,
};
use super::finding::{sort_semantic_change_findings, LawFindingSeverity, SemanticChangeFinding};
use super::law_coverage_gate::{LawCoverageGateDecision, LawCoverageGateState};

/// State for one bundle traceability check or the aggregate traceability gate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BundleTraceabilityGateState {
    /// All compared values agree.
    Pass,
    /// At least one compared value disagrees.
    Fail,
    /// Required traceability evidence is absent.
    Unavailable,
}

impl BundleTraceabilityGateState {
    /// Stable lowercase state label.
    pub fn label(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Fail => "fail",
            Self::Unavailable => "unavailable",
        }
    }
}

/// One deterministic traceability comparison.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleTraceabilityCheck {
    /// Stable field path for this comparison.
    pub field_path: String,
    /// Expected value from the evidence bundle when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
    /// Actual value from the compared artifact when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
    /// Check state.
    pub state: BundleTraceabilityGateState,
    /// Stable lowercase state label.
    pub state_label: String,
    /// Renderer-neutral explanation.
    pub rationale: String,
}

/// Aggregate traceability gate for one law evidence bundle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleTraceabilityGateDecision {
    /// Stable gate id.
    pub gate_id: String,
    /// Aggregate gate state.
    pub state: BundleTraceabilityGateState,
    /// Stable lowercase state label.
    pub state_label: String,
    /// Individual deterministic checks included in the gate.
    pub checks: Vec<BundleTraceabilityCheck>,
    /// Renderer-neutral explanation.
    pub rationale: String,
}

/// Build the bundle traceability gate without recomputing hashes or loading artifacts.
pub fn evaluate_bundle_traceability(
    bundle: &HolmesLawEvidenceBundle,
    manifest: Option<&ContractBundleManifest>,
) -> BundleTraceabilityGateDecision {
    let mut checks = Vec::new();

    match manifest {
        Some(manifest) => {
            checks.push(hash_check(
                "manifest.schemaHash",
                Some(bundle.provenance.schema_hash.as_str()),
                Some(manifest.schema_hash.as_str()),
            ));
            checks.push(hash_check(
                "manifest.lawHash",
                Some(bundle.provenance.law_hash.as_str()),
                Some(manifest.law_hash.as_str()),
            ));
            checks.push(hash_check(
                "manifest.profileHash",
                bundle.provenance.policy_hash.as_deref(),
                Some(manifest.profile_hash.as_str()),
            ));
            checks.push(hash_check(
                "manifest.bundleHash",
                Some(bundle.provenance.bundle_hash.as_str()),
                Some(manifest.bundle_hash.as_str()),
            ));
        }
        None => checks.push(unavailable_check(
            "manifest",
            "contract bundle manifest evidence is unavailable",
        )),
    }

    for artifact in bundle.artifact_refs() {
        let field_path = format!("{}.sha256", artifact.field_path);
        let sha256 = artifact.artifact.sha256.as_deref();
        checks.push(hash_check(&field_path, sha256, sha256));
    }

    let state = aggregate_traceability_state(&checks);
    BundleTraceabilityGateDecision {
        gate_id: "bundle-traceability".to_owned(),
        state,
        state_label: state.label().to_owned(),
        checks,
        rationale: traceability_rationale(state).to_owned(),
    }
}

/// Provenance details retained for one evidence artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceArtifactProvenance {
    /// Stable evidence bundle field path.
    pub field_path: String,
    /// Artifact family identifier.
    pub artifact_family: String,
    /// Workspace-relative path.
    pub path: String,
    /// Artifact-local schema version when declared.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<String>,
    /// Artifact digest when declared.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    /// Renderer-facing evidence reference.
    pub evidence_ref: String,
}

/// Deterministic provenance report substrate for later renderer sections.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceProvenanceReport {
    /// Stable evidence bundle identifier.
    pub bundle_id: String,
    /// Human-readable bundle source.
    pub bundle_source: String,
    /// Evidence bundle schema hash.
    pub schema_hash: String,
    /// Evidence bundle law hash.
    pub law_hash: String,
    /// Evidence bundle policy/profile hash when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_hash: Option<String>,
    /// Evidence bundle contract bundle hash.
    pub bundle_hash: String,
    /// Normalized contract bundle manifest provenance when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<NormalizedContractBundleProvenance>,
    /// Provenance details for each present artifact reference.
    pub artifacts: Vec<LawAssuranceArtifactProvenance>,
}

/// Build deterministic provenance report data from bundle and manifest evidence.
pub fn law_assurance_provenance_report(
    bundle: &HolmesLawEvidenceBundle,
    manifest: Option<&ContractBundleManifest>,
) -> LawAssuranceProvenanceReport {
    LawAssuranceProvenanceReport {
        bundle_id: bundle.bundle_id.clone(),
        bundle_source: bundle.provenance.source.clone(),
        schema_hash: bundle.provenance.schema_hash.clone(),
        law_hash: bundle.provenance.law_hash.clone(),
        policy_hash: bundle.provenance.policy_hash.clone(),
        bundle_hash: bundle.provenance.bundle_hash.clone(),
        manifest: manifest.map(ContractBundleManifest::normalized_provenance),
        artifacts: bundle
            .artifact_refs()
            .into_iter()
            .map(|artifact| LawAssuranceArtifactProvenance {
                field_path: artifact.field_path.to_owned(),
                artifact_family: artifact.family.id().to_owned(),
                path: artifact.artifact.path.clone(),
                schema_version: artifact.artifact.schema_version.clone(),
                sha256: artifact.artifact.sha256.clone(),
                evidence_ref: artifact.artifact.path.clone(),
            })
            .collect(),
    }
}

/// Aggregate outcome for a Holmes law assurance assessment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LawAssuranceAssessmentOutcome {
    /// All validation, finding, coverage, and traceability gates passed.
    Pass,
    /// Assessment is usable but carries warning-level evidence.
    Warn,
    /// Assessment found blocking semantic or gate evidence.
    Fail,
    /// Required evidence was unavailable.
    Unavailable,
    /// Input evidence was invalid and assessment must not continue.
    Invalid,
}

impl LawAssuranceAssessmentOutcome {
    /// Stable lowercase outcome label.
    pub fn label(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Warn => "warn",
            Self::Fail => "fail",
            Self::Unavailable => "unavailable",
            Self::Invalid => "invalid",
        }
    }
}

/// Deterministic aggregate assessment summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawAssuranceAssessmentSummary {
    /// Aggregate assessment outcome.
    pub outcome: LawAssuranceAssessmentOutcome,
    /// Stable lowercase outcome label.
    pub outcome_label: String,
    /// Validation status that fed the aggregate decision.
    pub validation_status: LawEvidenceValidationStatus,
    /// Stable lowercase validation status label.
    pub validation_status_label: String,
    /// Total semantic finding count.
    pub finding_count: usize,
    /// Critical semantic finding count.
    pub critical_finding_count: usize,
    /// Error semantic finding count.
    pub error_finding_count: usize,
    /// Warning semantic finding count.
    pub warning_finding_count: usize,
    /// Total coverage gate count.
    pub coverage_gate_count: usize,
    /// Coverage gates that failed.
    pub coverage_fail_count: usize,
    /// Coverage gates that warned.
    pub coverage_warn_count: usize,
    /// Coverage gates that were unavailable.
    pub coverage_unavailable_count: usize,
    /// Traceability gate state.
    pub traceability_state: BundleTraceabilityGateState,
    /// Stable lowercase traceability state label.
    pub traceability_state_label: String,
    /// Renderer-neutral aggregate rationale.
    pub rationale: String,
}

/// Aggregate validation, findings, coverage, and traceability into one outcome.
pub fn aggregate_law_assurance_assessment(
    validation: &LawEvidenceValidationResult,
    findings: &[SemanticChangeFinding],
    coverage_gates: &[LawCoverageGateDecision],
    traceability_gate: &BundleTraceabilityGateDecision,
) -> LawAssuranceAssessmentSummary {
    let finding_counts = FindingSeverityCounts::from_findings(findings);
    let coverage_fail_count = coverage_gates
        .iter()
        .filter(|gate| gate.state == LawCoverageGateState::Fail)
        .count();
    let coverage_warn_count = coverage_gates
        .iter()
        .filter(|gate| gate.state == LawCoverageGateState::Warn)
        .count();
    let coverage_unavailable_count = coverage_gates
        .iter()
        .filter(|gate| gate.state == LawCoverageGateState::Unavailable)
        .count();

    let outcome = if validation.status == LawEvidenceValidationStatus::Invalid {
        LawAssuranceAssessmentOutcome::Invalid
    } else if traceability_gate.state == BundleTraceabilityGateState::Fail
        || finding_counts.critical > 0
        || finding_counts.error > 0
        || coverage_fail_count > 0
    {
        LawAssuranceAssessmentOutcome::Fail
    } else if validation.status == LawEvidenceValidationStatus::InfrastructureError
        || traceability_gate.state == BundleTraceabilityGateState::Unavailable
        || coverage_unavailable_count > 0
    {
        LawAssuranceAssessmentOutcome::Unavailable
    } else if validation.status == LawEvidenceValidationStatus::ValidWithWarnings
        || finding_counts.warning > 0
        || coverage_warn_count > 0
    {
        LawAssuranceAssessmentOutcome::Warn
    } else {
        LawAssuranceAssessmentOutcome::Pass
    };

    LawAssuranceAssessmentSummary {
        outcome,
        outcome_label: outcome.label().to_owned(),
        validation_status: validation.status,
        validation_status_label: validation_status_label(validation.status).to_owned(),
        finding_count: findings.len(),
        critical_finding_count: finding_counts.critical,
        error_finding_count: finding_counts.error,
        warning_finding_count: finding_counts.warning,
        coverage_gate_count: coverage_gates.len(),
        coverage_fail_count,
        coverage_warn_count,
        coverage_unavailable_count,
        traceability_state: traceability_gate.state,
        traceability_state_label: traceability_gate.state.label().to_owned(),
        rationale: assessment_rationale(outcome).to_owned(),
    }
}

/// Bounded finding display summary with omitted-detail accounting.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundedFindingSummary {
    /// Findings retained for inline display after deterministic sorting.
    pub displayed_findings: Vec<SemanticChangeFinding>,
    /// Findings omitted from inline display.
    pub omitted_finding_count: usize,
    /// Total finding count before display limiting.
    pub total_finding_count: usize,
    /// Critical finding count.
    pub critical_count: usize,
    /// Error finding count.
    pub error_count: usize,
    /// Warning finding count.
    pub warning_count: usize,
    /// Advisory finding count.
    pub advisory_count: usize,
    /// Informational finding count.
    pub info_count: usize,
}

/// Build a bounded deterministic finding summary for renderer and agent surfaces.
pub fn bounded_finding_summary(
    findings: &[SemanticChangeFinding],
    display_limit: usize,
) -> BoundedFindingSummary {
    let mut sorted = findings.to_vec();
    sort_semantic_change_findings(&mut sorted);
    let counts = FindingSeverityCounts::from_findings(&sorted);
    let displayed_findings = sorted
        .iter()
        .take(display_limit)
        .cloned()
        .collect::<Vec<_>>();
    BoundedFindingSummary {
        omitted_finding_count: sorted.len().saturating_sub(displayed_findings.len()),
        total_finding_count: sorted.len(),
        displayed_findings,
        critical_count: counts.critical,
        error_count: counts.error,
        warning_count: counts.warning,
        advisory_count: counts.advisory,
        info_count: counts.info,
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct FindingSeverityCounts {
    critical: usize,
    error: usize,
    warning: usize,
    advisory: usize,
    info: usize,
}

impl FindingSeverityCounts {
    fn from_findings(findings: &[SemanticChangeFinding]) -> Self {
        let mut counts = Self::default();
        for finding in findings {
            match finding.severity {
                LawFindingSeverity::Critical => counts.critical += 1,
                LawFindingSeverity::Error => counts.error += 1,
                LawFindingSeverity::Warning => counts.warning += 1,
                LawFindingSeverity::Advisory => counts.advisory += 1,
                LawFindingSeverity::Info => counts.info += 1,
            }
        }
        counts
    }
}

fn hash_check(
    field_path: &str,
    expected: Option<&str>,
    actual: Option<&str>,
) -> BundleTraceabilityCheck {
    let state = match (expected, actual) {
        (Some(expected), Some(actual)) if expected == actual => BundleTraceabilityGateState::Pass,
        (Some(_), Some(_)) => BundleTraceabilityGateState::Fail,
        _ => BundleTraceabilityGateState::Unavailable,
    };
    BundleTraceabilityCheck {
        field_path: field_path.to_owned(),
        expected: expected.map(str::to_owned),
        actual: actual.map(str::to_owned),
        state,
        state_label: state.label().to_owned(),
        rationale: check_rationale(state).to_owned(),
    }
}

fn unavailable_check(field_path: &str, rationale: &str) -> BundleTraceabilityCheck {
    BundleTraceabilityCheck {
        field_path: field_path.to_owned(),
        expected: None,
        actual: None,
        state: BundleTraceabilityGateState::Unavailable,
        state_label: BundleTraceabilityGateState::Unavailable.label().to_owned(),
        rationale: rationale.to_owned(),
    }
}

fn aggregate_traceability_state(checks: &[BundleTraceabilityCheck]) -> BundleTraceabilityGateState {
    if checks
        .iter()
        .any(|check| check.state == BundleTraceabilityGateState::Fail)
    {
        BundleTraceabilityGateState::Fail
    } else if checks
        .iter()
        .any(|check| check.state == BundleTraceabilityGateState::Unavailable)
    {
        BundleTraceabilityGateState::Unavailable
    } else {
        BundleTraceabilityGateState::Pass
    }
}

fn check_rationale(state: BundleTraceabilityGateState) -> &'static str {
    match state {
        BundleTraceabilityGateState::Pass => "traceability value matches",
        BundleTraceabilityGateState::Fail => "traceability value does not match",
        BundleTraceabilityGateState::Unavailable => "traceability value is unavailable",
    }
}

fn traceability_rationale(state: BundleTraceabilityGateState) -> &'static str {
    match state {
        BundleTraceabilityGateState::Pass => "bundle traceability checks passed",
        BundleTraceabilityGateState::Fail => "bundle traceability contains mismatched hashes",
        BundleTraceabilityGateState::Unavailable => {
            "bundle traceability cannot be fully evaluated from available evidence"
        }
    }
}

fn validation_status_label(status: LawEvidenceValidationStatus) -> &'static str {
    match status {
        LawEvidenceValidationStatus::Valid => "valid",
        LawEvidenceValidationStatus::ValidWithWarnings => "valid-with-warnings",
        LawEvidenceValidationStatus::Invalid => "invalid",
        LawEvidenceValidationStatus::InfrastructureError => "infrastructure-error",
    }
}

fn assessment_rationale(outcome: LawAssuranceAssessmentOutcome) -> &'static str {
    match outcome {
        LawAssuranceAssessmentOutcome::Pass => "all assessment inputs passed",
        LawAssuranceAssessmentOutcome::Warn => "assessment contains warning-level evidence",
        LawAssuranceAssessmentOutcome::Fail => "assessment contains blocking evidence",
        LawAssuranceAssessmentOutcome::Unavailable => {
            "assessment cannot be completed from available evidence"
        }
        LawAssuranceAssessmentOutcome::Invalid => "assessment input evidence is invalid",
    }
}
