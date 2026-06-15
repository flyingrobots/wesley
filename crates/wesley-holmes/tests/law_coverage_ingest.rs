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
    },
    {
      "id": "variantInputLaw",
      "label": "Input variant law",
      "required": true,
      "total": 1,
      "covered": 0,
      "missingSubjects": [
        "input:PlaybackModeInput"
      ]
    },
    {
      "id": "channelLaw",
      "label": "Channel law",
      "required": true,
      "total": 1,
      "covered": 0,
      "missingSubjects": [
        "channel:TTD@1"
      ]
    }
  ]
}"#;

#[test]
fn law_coverage_ingest_accepts_wesley_law_coverage_v1_json() {
    let result = JsonLawCoverageIngestPort.ingest_law_coverage(RELEASE_COVERAGE.as_bytes());

    assert_eq!(result.status, LawCoverageIngestStatus::Valid);
    assert!(result.diagnostics.is_empty());

    let report = result
        .report
        .expect("valid law coverage should produce a report");
    assert_eq!(report.api_version, "wesley.law-coverage/v1");
    assert_eq!(report.profile, "release");
    assert_eq!(report.required_total, 6);
    assert_eq!(report.required_covered, 1);
    assert_eq!(report.categories.len(), 4);
    assert_eq!(report.categories[0].id, "customScalarSemantics");
    assert!(report.categories[0].required);
    assert_eq!(report.categories[0].missing_subjects.len(), 3);
    assert_eq!(report.categories[1].id, "mutationFootprintLaw");
    assert!(report.categories[1].missing_subjects.is_empty());
}

#[test]
fn law_coverage_report_normalizes_percentages_subjects_and_omitted_counts() {
    let result = JsonLawCoverageIngestPort.ingest_law_coverage(RELEASE_COVERAGE.as_bytes());
    let report = result
        .report
        .expect("valid law coverage should produce a report");

    let normalized = report.normalized_profile(2);

    assert_eq!(normalized.profile, "release");
    assert_eq!(normalized.required_total, 6);
    assert_eq!(normalized.required_covered, 1);
    assert_eq!(normalized.required_percent, 16.7);
    let scalar = normalized
        .category("customScalarSemantics")
        .expect("scalar category should normalize");
    assert_eq!(scalar.category_ref, "lawCoverage.categories[0]");
    assert_eq!(scalar.percent, 0.0);
    assert_eq!(scalar.missing_count, 3);
    assert_eq!(
        scalar.missing_subjects,
        ["scalar:Hash", "scalar:PositiveInt", "scalar:WorldlineTick"]
    );
    assert_eq!(
        scalar.displayed_missing_subjects,
        ["scalar:Hash", "scalar:PositiveInt"]
    );
    assert_eq!(scalar.omitted_missing_subject_count, 1);
    let mutation = normalized
        .category("mutationFootprintLaw")
        .expect("mutation category should normalize");
    assert_eq!(mutation.percent, 100.0);
    assert_eq!(mutation.omitted_missing_subject_count, 0);
}

#[test]
fn law_coverage_ingest_rejects_covered_counts_above_totals() {
    let inconsistent = RELEASE_COVERAGE.replace("\"covered\": 1", "\"covered\": 2");

    let result = JsonLawCoverageIngestPort.ingest_law_coverage(inconsistent.as_bytes());

    assert_eq!(result.status, LawCoverageIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
    );
    assert_diagnostic_field(&result.diagnostics, "categories[1].covered");
}

#[test]
fn law_coverage_ingest_rejects_missing_subject_count_mismatch() {
    let mismatch = RELEASE_COVERAGE.replace(
        r#""missingSubjects": [
        "scalar:Hash",
        "scalar:PositiveInt",
        "scalar:WorldlineTick"
      ]"#,
        r#""missingSubjects": [
        "scalar:Hash",
        "scalar:PositiveInt"
      ]"#,
    );

    let result = JsonLawCoverageIngestPort.ingest_law_coverage(mismatch.as_bytes());

    assert_eq!(result.status, LawCoverageIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCoverageMissingCountMismatch,
    );
    assert_diagnostic_field(&result.diagnostics, "categories[0].missingSubjects");
}

#[test]
fn law_coverage_ingest_rejects_unsupported_api_version() {
    let unsupported = RELEASE_COVERAGE.replace("wesley.law-coverage/v1", "wesley.law-coverage/v2");

    let result = JsonLawCoverageIngestPort.ingest_law_coverage(unsupported.as_bytes());

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
    let result = JsonLawCoverageIngestPort.ingest_law_coverage(b"{broken");

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
