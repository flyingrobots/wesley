use wesley_holmes::{
    evaluate_law_coverage_gates, CoverageAbsentCategoryBehavior, CoverageUnavailableBehavior,
    JsonLawCoverageIngestPort, LawCoverageCategoryThreshold, LawCoverageGatePolicy,
    LawCoverageGateState, LawCoverageIngestPort,
};

const RELEASE_COVERAGE: &str = r#"{
  "apiVersion": "wesley.law-coverage/v1",
  "profile": "release",
  "requiredTotal": 3,
  "requiredCovered": 1,
  "requiredPercent": 33.3,
  "categories": [
    {
      "id": "mutationFootprintLaw",
      "label": "Mutation footprint law",
      "required": true,
      "total": 3,
      "covered": 1,
      "missingSubjects": [
        "operation:Mutation.archive",
        "operation:Mutation.replaceRange"
      ]
    }
  ]
}"#;

#[test]
fn coverage_gate_fails_required_category_below_failure_threshold() {
    let coverage = normalized_release_coverage();
    let policy = policy(vec![LawCoverageCategoryThreshold {
        category_id: "mutationFootprintLaw".to_owned(),
        required: true,
        warning_threshold: None,
        failure_threshold: Some(100.0),
    }]);

    let decisions = evaluate_law_coverage_gates(Some(&coverage), &policy);

    assert_eq!(decisions.len(), 1);
    assert_eq!(decisions[0].state, LawCoverageGateState::Fail);
    assert_eq!(decisions[0].state_label, "fail");
    assert_eq!(decisions[0].actual_percent, Some(33.3));
    assert_eq!(decisions[0].covered, Some(1));
    assert_eq!(decisions[0].total, Some(3));
    assert_eq!(
        decisions[0].missing_subjects,
        ["operation:Mutation.archive"]
    );
    assert_eq!(decisions[0].omitted_missing_subject_count, 1);
}

#[test]
fn coverage_gate_warns_for_advisory_gap_without_failure_threshold() {
    let coverage = normalized_release_coverage();
    let policy = policy(vec![LawCoverageCategoryThreshold {
        category_id: "mutationFootprintLaw".to_owned(),
        required: false,
        warning_threshold: Some(80.0),
        failure_threshold: None,
    }]);

    let decisions = evaluate_law_coverage_gates(Some(&coverage), &policy);

    assert_eq!(decisions[0].state, LawCoverageGateState::Warn);
    assert_eq!(decisions[0].state_label, "warn");
    assert_eq!(decisions[0].warning_threshold, Some(80.0));
    assert!(decisions[0].rationale.contains("warning threshold"));
}

#[test]
fn coverage_gate_passes_exact_boundary_threshold() {
    let coverage = normalized_release_coverage();
    let policy = policy(vec![LawCoverageCategoryThreshold {
        category_id: "mutationFootprintLaw".to_owned(),
        required: true,
        warning_threshold: None,
        failure_threshold: Some(33.3),
    }]);

    let decisions = evaluate_law_coverage_gates(Some(&coverage), &policy);

    assert_eq!(decisions[0].state, LawCoverageGateState::Pass);
    assert_eq!(decisions[0].actual_percent, Some(33.3));
}

#[test]
fn coverage_gate_marks_unavailable_evidence_without_false_pass() {
    let policy = policy(vec![LawCoverageCategoryThreshold {
        category_id: "mutationFootprintLaw".to_owned(),
        required: true,
        warning_threshold: None,
        failure_threshold: Some(100.0),
    }]);

    let decisions = evaluate_law_coverage_gates(None, &policy);

    assert_eq!(decisions[0].state, LawCoverageGateState::Unavailable);
    assert_eq!(decisions[0].state_label, "unavailable");
    assert_eq!(decisions[0].actual_percent, None);
}

#[test]
fn coverage_gate_follows_absent_category_policy() {
    let coverage = normalized_release_coverage();
    let mut policy = policy(vec![LawCoverageCategoryThreshold {
        category_id: "customScalarSemantics".to_owned(),
        required: true,
        warning_threshold: None,
        failure_threshold: Some(100.0),
    }]);
    policy.absent_category_behavior = CoverageAbsentCategoryBehavior::Fail;

    let decisions = evaluate_law_coverage_gates(Some(&coverage), &policy);

    assert_eq!(decisions[0].state, LawCoverageGateState::Fail);
    assert_eq!(decisions[0].actual_percent, None);
    assert!(decisions[0].rationale.contains("absent"));
}

fn normalized_release_coverage() -> wesley_holmes::NormalizedLawCoverageProfile {
    JsonLawCoverageIngestPort::default()
        .ingest_law_coverage(RELEASE_COVERAGE.as_bytes())
        .report
        .expect("coverage fixture should parse")
        .normalized_profile(10)
}

fn policy(categories: Vec<LawCoverageCategoryThreshold>) -> LawCoverageGatePolicy {
    LawCoverageGatePolicy {
        profile: "release".to_owned(),
        categories,
        missing_subject_display_limit: 1,
        unavailable_behavior: CoverageUnavailableBehavior::Unavailable,
        absent_category_behavior: CoverageAbsentCategoryBehavior::Unavailable,
        evidence_ref: Some("artifacts/law-coverage.json".to_owned()),
    }
}
