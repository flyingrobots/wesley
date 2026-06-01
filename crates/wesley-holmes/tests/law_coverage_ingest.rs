use wesley_holmes::{
    HolmesDiagnosticCode, JsonLawCoverageIngestPort, LawCoverageIngestPort, LawCoverageIngestStatus,
};

const RELEASE_COVERAGE: &str = r#"{
  "apiVersion": "wesley.law-coverage/v1",
  "profile": "release",
  "requiredTotal": 6,
  "requiredCovered": 1,
  "requiredPercent": 16.7,
  "categories": [
    {
      "id": "customScalarSemantics",
      "label": "Custom scalar semantic law",
      "required": true,
      "total": 3,
      "covered": 0,
      "missingSubjects": [
        "scalar:Hash",
        "scalar:PositiveInt",
        "scalar:WorldlineTick"
      ]
    },
    {
      "id": "mutationFootprintLaw",
      "label": "Mutation footprint law",
      "required": true,
      "total": 1,
      "covered": 1,
      "missingSubjects": []
    }
  ]
}"#;

#[test]
fn law_coverage_ingest_accepts_wesley_law_coverage_v1_json() {
    let result =
        JsonLawCoverageIngestPort::default().ingest_law_coverage(RELEASE_COVERAGE.as_bytes());

    assert_eq!(result.status, LawCoverageIngestStatus::Valid);
    assert!(result.diagnostics.is_empty());

    let report = result
        .report
        .expect("valid law coverage should produce a report");
    assert_eq!(report.api_version, "wesley.law-coverage/v1");
    assert_eq!(report.profile, "release");
    assert_eq!(report.required_total, 6);
    assert_eq!(report.required_covered, 1);
    assert_eq!(report.categories.len(), 2);
    assert_eq!(report.categories[0].id, "customScalarSemantics");
    assert!(report.categories[0].required);
    assert_eq!(report.categories[0].missing_subjects.len(), 3);
    assert_eq!(report.categories[1].id, "mutationFootprintLaw");
    assert!(report.categories[1].missing_subjects.is_empty());
}

#[test]
fn law_coverage_ingest_rejects_unsupported_api_version() {
    let unsupported = RELEASE_COVERAGE.replace("wesley.law-coverage/v1", "wesley.law-coverage/v2");

    let result = JsonLawCoverageIngestPort::default().ingest_law_coverage(unsupported.as_bytes());

    assert_eq!(result.status, LawCoverageIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCoverageUnsupportedVersion,
    );
    assert_diagnostic_field(&result.diagnostics, "apiVersion");
}

#[test]
fn law_coverage_ingest_rejects_malformed_json() {
    let result = JsonLawCoverageIngestPort::default().ingest_law_coverage(b"{broken");

    assert_eq!(result.status, LawCoverageIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCoverageMalformedJson,
    );
}

fn assert_diagnostic(diagnostics: &[wesley_holmes::HolmesDiagnostic], code: HolmesDiagnosticCode) {
    assert!(
        diagnostics.iter().any(|diagnostic| diagnostic.code == code),
        "expected {code:?} in {diagnostics:#?}"
    );
}

fn assert_diagnostic_field(diagnostics: &[wesley_holmes::HolmesDiagnostic], field_path: &str) {
    assert!(
        diagnostics
            .iter()
            .any(|diagnostic| diagnostic.field_path.as_deref() == Some(field_path)),
        "expected field {field_path:?} in {diagnostics:#?}"
    );
}
