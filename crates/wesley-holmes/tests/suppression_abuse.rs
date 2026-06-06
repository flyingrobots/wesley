use wesley_holmes::{
    apply_suppression_policy, normalize_law_assurance_policy, parse_law_assurance_policy,
    HolmesDiagnosticCode, HolmesSeverity, JsonLawDiffIngestPort, LawDiffIngestPort,
    LawEvidenceValidationResult, SuppressionRejectionReason,
};

const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");

const BUNDLE_HASH: &str =
    "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const POLICY_WITH_ACTIVE_SUPPRESSION: &str = r#"{
  "apiVersion": "holmes.law-assurance-policy/v1",
  "defaultProfile": "release",
  "defaultSeverity": "advisory",
  "profiles": {
    "release": {
      "suppressions": [
        {
          "id": "known-scalar-window",
          "target": { "kind": "law-id", "selector": "echo.scalar.positiveInt.u32-positive" },
          "reason": "temporary scalar migration window",
          "owner": "release-team",
          "createdOn": "2026-06-01",
          "expiresOn": "2026-07-01",
          "allowedSeverities": ["critical", "error", "warning", "advisory"],
          "auditTags": ["migration"]
        }
      ]
    }
  }
}"#;

const POLICY_WITH_EXPIRED_SUPPRESSION: &str = r#"{
  "apiVersion": "holmes.law-assurance-policy/v1",
  "defaultProfile": "release",
  "defaultSeverity": "advisory",
  "profiles": {
    "release": {
      "suppressions": [
        {
          "id": "expired-scalar-window",
          "target": { "kind": "law-id", "selector": "echo.scalar.positiveInt.u32-positive" },
          "reason": "expired migration window",
          "owner": "release-team",
          "createdOn": "2026-05-01",
          "expiresOn": "2026-05-31",
          "allowedSeverities": ["critical", "error", "warning", "advisory"],
          "auditTags": []
        }
      ]
    }
  }
}"#;

const POLICY_WITH_NON_OVERRIDABLE_GATE_SUPPRESSION: &str = r#"{
  "apiVersion": "holmes.law-assurance-policy/v1",
  "defaultProfile": "release",
  "defaultSeverity": "advisory",
  "profiles": {
    "release": {
      "nonOverridableGates": ["bundle-traceability"],
      "suppressions": [
        {
          "id": "attempted-traceability-bypass",
          "target": { "kind": "gate-id", "selector": "bundle-traceability" },
          "reason": "trying to bypass traceability check",
          "owner": "bad-actor",
          "createdOn": "2026-06-01",
          "expiresOn": "2026-12-31",
          "allowedSeverities": ["critical", "error", "warning", "advisory"],
          "auditTags": []
        }
      ]
    }
  }
}"#;

fn semantic_findings() -> Vec<wesley_holmes::SemanticChangeFinding> {
    let report = JsonLawDiffIngestPort::default()
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    wesley_holmes::semantic_change_findings_from_law_diff(
        &report,
        BUNDLE_HASH,
        "evidence/law-diff.json",
        Some("release".to_owned()),
    )
    .expect("findings should construct")
}

fn valid_evidence() -> LawEvidenceValidationResult {
    LawEvidenceValidationResult::from_diagnostics(Vec::new())
}

fn invalid_evidence() -> LawEvidenceValidationResult {
    LawEvidenceValidationResult::from_diagnostics(vec![
        wesley_holmes::HolmesDiagnostic::new(
            HolmesDiagnosticCode::HlawEvidenceBundleInvalid,
            HolmesSeverity::Error,
            "required artifact reference is missing",
        ),
    ])
}

#[test]
fn active_suppression_is_applied_to_matching_finding() {
    let schema =
        parse_law_assurance_policy(POLICY_WITH_ACTIVE_SUPPRESSION.as_bytes()).expect("should parse");
    let policy =
        normalize_law_assurance_policy(&schema, None).expect("should normalize");
    let findings = semantic_findings();

    let outcome = apply_suppression_policy(&findings, &valid_evidence(), &policy, "2026-06-05");

    let suppressed = outcome
        .annotated_findings
        .iter()
        .filter(|annotated| annotated.is_suppressed())
        .collect::<Vec<_>>();
    assert!(!suppressed.is_empty(), "at least one finding should be suppressed");

    let record = suppressed[0].suppressed_by.as_ref().unwrap();
    assert_eq!(record.suppression_id, "known-scalar-window");
    assert_eq!(record.owner, "release-team");
    assert_eq!(record.audit_tags, ["migration"]);

    assert_eq!(outcome.applied.len(), suppressed.len());
    assert!(outcome.rejected.is_empty());
    assert!(outcome.expired.is_empty());
    assert!(outcome.diagnostics.is_empty());
}

#[test]
fn invalid_evidence_rejects_all_suppressions_with_diagnostic() {
    let schema =
        parse_law_assurance_policy(POLICY_WITH_ACTIVE_SUPPRESSION.as_bytes()).expect("should parse");
    let policy =
        normalize_law_assurance_policy(&schema, None).expect("should normalize");
    let findings = semantic_findings();

    let outcome = apply_suppression_policy(&findings, &invalid_evidence(), &policy, "2026-06-05");

    assert!(
        outcome.annotated_findings.iter().all(|f| !f.is_suppressed()),
        "no finding should be suppressed when evidence is invalid"
    );
    assert_eq!(outcome.rejected.len(), 1);
    assert_eq!(outcome.rejected[0].suppression_id, "known-scalar-window");
    assert_eq!(
        outcome.rejected[0].rejection_reason,
        SuppressionRejectionReason::InvalidEvidence
    );
    assert!(outcome.applied.is_empty());

    let diagnostic = &outcome.diagnostics[0];
    assert_eq!(
        diagnostic.code,
        HolmesDiagnosticCode::HlawSuppressionRejectedInvalidEvidence
    );
    assert_eq!(diagnostic.severity, HolmesSeverity::Error);
}

#[test]
fn non_overridable_gate_suppression_is_rejected_with_diagnostic() {
    let schema =
        parse_law_assurance_policy(POLICY_WITH_NON_OVERRIDABLE_GATE_SUPPRESSION.as_bytes())
            .expect("should parse");
    let policy =
        normalize_law_assurance_policy(&schema, None).expect("should normalize");
    let findings = semantic_findings();

    let outcome = apply_suppression_policy(&findings, &valid_evidence(), &policy, "2026-06-05");

    assert_eq!(outcome.rejected.len(), 1);
    assert_eq!(outcome.rejected[0].suppression_id, "attempted-traceability-bypass");
    assert_eq!(
        outcome.rejected[0].rejection_reason,
        SuppressionRejectionReason::NonOverridableGate {
            gate_id: "bundle-traceability".to_owned()
        }
    );
    assert!(outcome.applied.is_empty());
    assert!(
        outcome.annotated_findings.iter().all(|f| !f.is_suppressed()),
        "no finding should be suppressed"
    );

    let diagnostic = &outcome.diagnostics[0];
    assert_eq!(
        diagnostic.code,
        HolmesDiagnosticCode::HlawSuppressionRejectedNonOverridable
    );
    assert_eq!(diagnostic.severity, HolmesSeverity::Error);
}

#[test]
fn expired_suppression_emits_warning_diagnostic_and_is_not_applied() {
    let schema =
        parse_law_assurance_policy(POLICY_WITH_EXPIRED_SUPPRESSION.as_bytes()).expect("should parse");
    let policy =
        normalize_law_assurance_policy(&schema, None).expect("should normalize");
    let findings = semantic_findings();

    let outcome = apply_suppression_policy(&findings, &valid_evidence(), &policy, "2026-06-05");

    assert!(
        outcome.annotated_findings.iter().all(|f| !f.is_suppressed()),
        "expired suppression must not mute any finding"
    );
    assert_eq!(outcome.expired, ["expired-scalar-window"]);
    assert!(outcome.applied.is_empty());
    assert!(outcome.rejected.is_empty());

    let diagnostic = &outcome.diagnostics[0];
    assert_eq!(diagnostic.code, HolmesDiagnosticCode::HlawSuppressionExpired);
    assert_eq!(diagnostic.severity, HolmesSeverity::Warning);
}

#[test]
fn suppression_with_no_matching_finding_produces_no_applied_records() {
    let policy_json = r#"{
      "apiVersion": "holmes.law-assurance-policy/v1",
      "defaultProfile": "release",
      "defaultSeverity": "advisory",
      "profiles": {
        "release": {
          "suppressions": [
            {
              "id": "unmatched-suppression",
              "target": { "kind": "law-id", "selector": "nonexistent.law.id" },
              "reason": "targets a law id not present in the diff",
              "owner": "test",
              "createdOn": "2026-06-01",
              "expiresOn": "2026-12-31",
              "allowedSeverities": ["critical", "error", "warning", "advisory"],
              "auditTags": []
            }
          ]
        }
      }
    }"#;
    let schema = parse_law_assurance_policy(policy_json.as_bytes()).expect("should parse");
    let policy = normalize_law_assurance_policy(&schema, None).expect("should normalize");
    let findings = semantic_findings();

    let outcome = apply_suppression_policy(&findings, &valid_evidence(), &policy, "2026-06-05");

    assert!(outcome.applied.is_empty());
    assert!(outcome.rejected.is_empty());
    assert!(outcome.expired.is_empty());
    assert!(outcome.diagnostics.is_empty());
    assert!(outcome.annotated_findings.iter().all(|f| !f.is_suppressed()));
}
