use wesley_holmes::{
    aggregate_law_assurance_assessment, bounded_finding_summary, evaluate_bundle_traceability,
    law_assurance_provenance_report, ArtifactRef, BundleProvenance, BundleTraceabilityGateState,
    ContractBundleManifest, HolmesLawEvidenceBundle, JsonLawDiffIngestPort,
    LawAssuranceArtifactProvenance, LawAssuranceAssessmentOutcome, LawCoverageGateDecision,
    LawCoverageGateState, LawDiffIngestPort, LawEvidenceArtifacts, LawEvidenceValidationResult,
    SemanticChangeFinding,
};

const HASH_A: &str = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B: &str = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C: &str = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const HASH_D: &str = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const HASH_E: &str = "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");

#[test]
fn bundle_traceability_gate_passes_matching_manifest_and_artifact_hashes() {
    let bundle = evidence_bundle();
    let manifest = contract_manifest(HASH_B);

    let decision = evaluate_bundle_traceability(&bundle, Some(&manifest));

    assert_eq!(decision.state, BundleTraceabilityGateState::Pass);
    assert_eq!(decision.state_label, "pass");
    assert_eq!(decision.checks.len(), 8);
    assert!(decision
        .checks
        .iter()
        .all(|check| check.state == BundleTraceabilityGateState::Pass));
}

#[test]
fn bundle_traceability_gate_fails_manifest_hash_mismatch() {
    let bundle = evidence_bundle();
    let stale_manifest = contract_manifest(HASH_E);

    let decision = evaluate_bundle_traceability(&bundle, Some(&stale_manifest));

    assert_eq!(decision.state, BundleTraceabilityGateState::Fail);
    let law_hash = decision
        .checks
        .iter()
        .find(|check| check.field_path == "manifest.lawHash")
        .expect("lawHash check should exist");
    assert_eq!(law_hash.state, BundleTraceabilityGateState::Fail);
    assert_eq!(law_hash.expected.as_deref(), Some(HASH_B));
    assert_eq!(law_hash.actual.as_deref(), Some(HASH_E));
}

#[test]
fn assessment_aggregates_validation_findings_coverage_and_traceability() {
    let bundle = evidence_bundle();
    let manifest = contract_manifest(HASH_B);
    let traceability = evaluate_bundle_traceability(&bundle, Some(&manifest));
    let findings = semantic_findings();
    let validation = LawEvidenceValidationResult::from_diagnostics(Vec::new());
    let coverage_gates = vec![coverage_decision(LawCoverageGateState::Pass)];

    let assessment =
        aggregate_law_assurance_assessment(&validation, &findings, &coverage_gates, &traceability);

    assert_eq!(assessment.outcome, LawAssuranceAssessmentOutcome::Fail);
    assert_eq!(assessment.outcome_label, "fail");
    assert_eq!(assessment.finding_count, 3);
    assert_eq!(assessment.critical_finding_count, 2);
    assert_eq!(assessment.error_finding_count, 1);
    assert_eq!(assessment.coverage_fail_count, 0);
    assert_eq!(
        assessment.traceability_state,
        BundleTraceabilityGateState::Pass
    );
}

#[test]
fn assessment_failures_dominate_unavailable_evidence() {
    let bundle = evidence_bundle();
    let traceability = evaluate_bundle_traceability(&bundle, None);
    let findings = semantic_findings();
    let validation = LawEvidenceValidationResult::from_diagnostics(Vec::new());
    let coverage_gates = vec![coverage_decision(LawCoverageGateState::Pass)];

    let assessment =
        aggregate_law_assurance_assessment(&validation, &findings, &coverage_gates, &traceability);

    assert_eq!(traceability.state, BundleTraceabilityGateState::Unavailable);
    assert_eq!(assessment.outcome, LawAssuranceAssessmentOutcome::Fail);
    assert_eq!(assessment.outcome_label, "fail");
    assert_eq!(
        assessment.traceability_state,
        BundleTraceabilityGateState::Unavailable
    );
}

#[test]
fn bounded_finding_summary_tracks_omitted_details_by_severity() {
    let findings = semantic_findings();

    let summary = bounded_finding_summary(&findings, 2);

    assert_eq!(summary.total_finding_count, 3);
    assert_eq!(summary.displayed_findings.len(), 2);
    assert_eq!(summary.omitted_finding_count, 1);
    assert_eq!(summary.critical_count, 2);
    assert_eq!(summary.error_count, 1);
}

#[test]
fn provenance_report_snapshot_is_stable() {
    let bundle = evidence_bundle();
    let manifest = contract_manifest(HASH_B);

    let report = law_assurance_provenance_report(&bundle, Some(&manifest));

    assert_eq!(
        report.artifacts[0],
        LawAssuranceArtifactProvenance {
            field_path: "artifacts.lawDiff".to_owned(),
            artifact_family: "law-diff".to_owned(),
            path: "evidence/law-diff.json".to_owned(),
            schema_version: Some("1.0.0".to_owned()),
            sha256: Some(HASH_A.to_owned()),
            evidence_ref: "evidence/law-diff.json".to_owned(),
        }
    );

    let json = serde_json::to_string_pretty(&report).expect("report should serialize");
    assert_eq!(
        json,
        r#"{
  "bundleId": "bundle-release",
  "bundleSource": "ci",
  "schemaHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "lawHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "policyHash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "bundleHash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "manifest": {
    "manifestRef": "contractBundleManifest",
    "apiVersion": "wesley.contract-bundle-manifest/v1",
    "schemaHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "lawHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "lawDocumentHash": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "profileHash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "bundleHash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "lawIrCodec": "wesley.law-ir.canonical-json.v1",
    "bundleHashCodec": "wesley.contract-bundle.hash-input.canonical-json.v1",
    "compiler": "wesley-core",
    "compilerVersion": "0.0.5",
    "lawEntryCount": 4
  },
  "artifacts": [
    {
      "fieldPath": "artifacts.lawDiff",
      "artifactFamily": "law-diff",
      "path": "evidence/law-diff.json",
      "schemaVersion": "1.0.0",
      "sha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "evidenceRef": "evidence/law-diff.json"
    },
    {
      "fieldPath": "artifacts.lawCoverage",
      "artifactFamily": "law-coverage",
      "path": "evidence/law-coverage.json",
      "schemaVersion": "1.0.0",
      "sha256": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "evidenceRef": "evidence/law-coverage.json"
    },
    {
      "fieldPath": "artifacts.lawCapabilities",
      "artifactFamily": "law-capabilities",
      "path": "evidence/law-capabilities.json",
      "schemaVersion": "1.0.0",
      "sha256": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "evidenceRef": "evidence/law-capabilities.json"
    },
    {
      "fieldPath": "artifacts.contractBundleManifest",
      "artifactFamily": "contract-bundle-manifest",
      "path": "evidence/manifest.json",
      "schemaVersion": "1.0.0",
      "sha256": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "evidenceRef": "evidence/manifest.json"
    }
  ]
}"#
    );
}

fn evidence_bundle() -> HolmesLawEvidenceBundle {
    HolmesLawEvidenceBundle {
        schema_version: "1.0.0".to_owned(),
        bundle_id: "bundle-release".to_owned(),
        artifacts: LawEvidenceArtifacts {
            law_diff: artifact("evidence/law-diff.json", HASH_A),
            law_coverage: artifact("evidence/law-coverage.json", HASH_B),
            law_capabilities: artifact("evidence/law-capabilities.json", HASH_C),
            contract_bundle_manifest: artifact("evidence/manifest.json", HASH_D),
            policy: None,
            report: None,
            witness: None,
        },
        provenance: BundleProvenance {
            schema_hash: HASH_A.to_owned(),
            law_hash: HASH_B.to_owned(),
            policy_hash: Some(HASH_C.to_owned()),
            bundle_hash: HASH_D.to_owned(),
            source: "ci".to_owned(),
        },
    }
}

fn artifact(path: &str, sha256: &str) -> ArtifactRef {
    ArtifactRef {
        path: path.to_owned(),
        schema_version: Some("1.0.0".to_owned()),
        sha256: Some(sha256.to_owned()),
    }
}

fn contract_manifest(law_hash: &str) -> ContractBundleManifest {
    ContractBundleManifest {
        api_version: "wesley.contract-bundle-manifest/v1".to_owned(),
        schema_hash: HASH_A.to_owned(),
        law_hash: law_hash.to_owned(),
        law_document_hash: Some(HASH_E.to_owned()),
        profile_hash: HASH_C.to_owned(),
        bundle_hash: HASH_D.to_owned(),
        law_ir_codec: "wesley.law-ir.canonical-json.v1".to_owned(),
        bundle_hash_codec: "wesley.contract-bundle.hash-input.canonical-json.v1".to_owned(),
        compiler: "wesley-core".to_owned(),
        compiler_version: "0.0.5".to_owned(),
        law_entry_count: 4,
    }
}

fn semantic_findings() -> Vec<SemanticChangeFinding> {
    let report = JsonLawDiffIngestPort
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    wesley_holmes::semantic_change_findings_from_law_diff(
        &report,
        HASH_D,
        "evidence/law-diff.json",
        Some("release".to_owned()),
    )
    .expect("findings should construct")
}

fn coverage_decision(state: LawCoverageGateState) -> LawCoverageGateDecision {
    LawCoverageGateDecision {
        gate_id: "law-coverage:release:mutationFootprintLaw".to_owned(),
        profile: "release".to_owned(),
        category_id: "mutationFootprintLaw".to_owned(),
        category_label: Some("Mutation footprint law".to_owned()),
        state,
        state_label: state.label().to_owned(),
        required: true,
        covered: Some(3),
        total: Some(3),
        actual_percent: Some(100.0),
        warning_threshold: Some(90.0),
        failure_threshold: Some(80.0),
        missing_subjects: Vec::new(),
        omitted_missing_subject_count: 0,
        evidence_ref: Some("evidence/law-coverage.json".to_owned()),
        rationale: "coverage satisfies configured thresholds".to_owned(),
    }
}
