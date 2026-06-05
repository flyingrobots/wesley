use wesley_holmes::{
    map_semantic_finding_severities, matching_suppressions_for_finding,
    normalize_law_assurance_policy, parse_law_assurance_policy, HolmesDiagnosticCode,
    JsonLawDiffIngestPort, LawCoverageGateState, LawDiffEventKind, LawDiffIngestPort,
    LawFindingSeverity, SemanticChangeFinding, HOLMES_LAW_ASSURANCE_POLICY_API_VERSION,
};

const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");

const RELEASE_POLICY: &str = r#"{
  "apiVersion": "holmes.law-assurance-policy/v1",
  "defaultProfile": "release",
  "defaultSeverity": "advisory",
  "severityMappings": {
    "lawWeakened": "critical"
  },
  "coverageSeverityMappings": {
    "fail": "error",
    "warn": "warning",
    "unavailable": "error"
  },
  "profiles": {
    "base": {
      "missingSubjectDisplayLimit": 1,
      "unavailableBehavior": "unavailable",
      "absentCategoryBehavior": "fail",
      "coverageThresholds": {
        "mutationFootprintLaw": {
          "required": true,
          "warningThreshold": 100.0,
          "failureThreshold": 100.0
        }
      }
    },
    "release": {
      "inherits": "base",
      "severityMappings": {
        "footprintExpanded": "error"
      },
      "coverageThresholds": {
        "scalarSemantics": {
          "required": false,
          "warningThreshold": 90.0
        }
      },
      "nonOverridableGates": [
        "bundle-traceability"
      ],
      "suppressions": [
        {
          "id": "known-scalar-window",
          "target": {
            "kind": "law-id",
            "selector": "echo.scalar.positiveInt.u32-positive"
          },
          "reason": "temporary scalar migration window",
          "owner": "release-team",
          "createdOn": "2026-06-01",
          "expiresOn": "2026-07-01",
          "allowedSeverities": [
            "critical"
          ],
          "auditTags": [
            "migration"
          ]
        }
      ]
    },
    "local": {
      "inherits": "base",
      "severityMappings": {
        "lawWeakened": "warning"
      }
    }
  }
}"#;

#[test]
fn policy_schema_normalizes_default_profile_with_inherited_thresholds() {
    let schema =
        parse_law_assurance_policy(RELEASE_POLICY.as_bytes()).expect("policy should parse");

    let policy =
        normalize_law_assurance_policy(&schema, None).expect("default profile should normalize");

    assert_eq!(schema.api_version, HOLMES_LAW_ASSURANCE_POLICY_API_VERSION);
    assert_eq!(policy.profile, "release");
    assert_eq!(policy.default_severity, Some(LawFindingSeverity::Advisory));
    assert_eq!(
        policy.severity_mappings.get("LAW_WEAKENED"),
        Some(&LawFindingSeverity::Critical)
    );
    assert_eq!(
        policy.severity_mappings.get("FOOTPRINT_EXPANDED"),
        Some(&LawFindingSeverity::Error)
    );
    assert_eq!(
        policy.severity_for_coverage_gate_state(LawCoverageGateState::Fail),
        Some(LawFindingSeverity::Error)
    );
    assert_eq!(policy.coverage_gate_policy.profile, "release");
    assert_eq!(policy.coverage_gate_policy.missing_subject_display_limit, 1);
    assert_eq!(policy.coverage_gate_policy.categories.len(), 2);
    assert_eq!(
        policy.coverage_gate_policy.categories[0].category_id,
        "mutationFootprintLaw"
    );
    assert_eq!(
        policy.coverage_gate_policy.categories[0].failure_threshold,
        Some(100.0)
    );
    assert_eq!(
        policy.coverage_gate_policy.categories[1].category_id,
        "scalarSemantics"
    );
    assert_eq!(
        policy.coverage_gate_policy.categories[1].warning_threshold,
        Some(90.0)
    );
    assert_eq!(policy.suppressions.len(), 1);
    assert_eq!(policy.non_overridable_gates, ["bundle-traceability"]);
}

#[test]
fn policy_schema_rejects_unknown_top_level_field() {
    let err = parse_law_assurance_policy(
        br#"{
          "apiVersion": "holmes.law-assurance-policy/v1",
          "profiles": { "release": {} },
          "implicitEnvironmentProfile": true
        }"#,
    )
    .expect_err("unknown top-level fields should be rejected");

    assert_eq!(err.code, HolmesDiagnosticCode::HlawPolicyUnknownField);
    assert_eq!(
        err.field_path.as_deref(),
        Some("implicitEnvironmentProfile")
    );
}

#[test]
fn policy_normalization_rejects_unknown_profile() {
    let schema =
        parse_law_assurance_policy(RELEASE_POLICY.as_bytes()).expect("policy should parse");

    let err = normalize_law_assurance_policy(&schema, Some("staging"))
        .expect_err("unknown profile should be rejected");

    assert_eq!(err.code, HolmesDiagnosticCode::HlawPolicyUnknownProfile);
    assert_eq!(err.field_path.as_deref(), Some("profiles.staging"));
}

#[test]
fn severity_policy_preserves_wesley_event_identity() {
    let schema =
        parse_law_assurance_policy(RELEASE_POLICY.as_bytes()).expect("policy should parse");
    let policy = normalize_law_assurance_policy(&schema, Some("local"))
        .expect("local profile should normalize");
    let findings = semantic_findings();

    let mapped =
        map_semantic_finding_severities(&findings, &policy).expect("severity mapping should apply");
    let original = findings
        .iter()
        .find(|finding| finding.event_kind == LawDiffEventKind::LawWeakened)
        .expect("fixture should contain weakened law");
    let remapped = mapped
        .iter()
        .find(|finding| finding.finding_id == original.finding_id)
        .expect("mapped finding should retain identity");

    assert_eq!(remapped.severity, LawFindingSeverity::Warning);
    assert_eq!(remapped.severity_label, "warning");
    assert_eq!(remapped.event_kind, original.event_kind);
    assert_eq!(remapped.change_posture, original.change_posture);
    assert_eq!(remapped.law_id, original.law_id);
    assert_eq!(remapped.subject, original.subject);
}

#[test]
fn suppression_policy_matches_narrow_unexpired_findings_only() {
    let schema =
        parse_law_assurance_policy(RELEASE_POLICY.as_bytes()).expect("policy should parse");
    let policy = normalize_law_assurance_policy(&schema, Some("release"))
        .expect("release profile should normalize");
    let findings = semantic_findings();
    let suppressed = findings
        .iter()
        .find(|finding| finding.law_id.as_deref() == Some("echo.scalar.positiveInt.u32-positive"))
        .expect("fixture should contain scalar finding");

    let active = matching_suppressions_for_finding(suppressed, &policy, "2026-06-04");
    let expired = matching_suppressions_for_finding(suppressed, &policy, "2026-07-02");

    assert_eq!(active.len(), 1);
    assert_eq!(active[0].suppression_id, "known-scalar-window");
    assert_eq!(active[0].owner, "release-team");
    assert_eq!(active[0].audit_tags, ["migration"]);
    assert!(expired.is_empty());
}

fn semantic_findings() -> Vec<SemanticChangeFinding> {
    let report = JsonLawDiffIngestPort::default()
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    wesley_holmes::semantic_change_findings_from_law_diff(
        &report,
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "evidence/law-diff.json",
        Some("policy-test".to_owned()),
    )
    .expect("findings should construct")
}
