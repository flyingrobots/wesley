use wesley_holmes::{
    HolmesDiagnosticCode, JsonLawDiffIngestPort, LawDiffEventKind, LawDiffIngestPort,
    LawDiffIngestStatus,
};

const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");

#[test]
fn law_diff_ingest_accepts_wesley_law_diff_v1_json() {
    let result = JsonLawDiffIngestPort::default().ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes());

    assert_eq!(result.status, LawDiffIngestStatus::Valid);
    assert!(result.diagnostics.is_empty());

    let report = result
        .report
        .expect("valid law diff should produce a report");
    assert_eq!(report.api_version, "wesley.law-diff/v1");
    assert_eq!(
        report.old_schema_hash,
        "sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6"
    );
    assert_eq!(
        report.new_law_hash,
        "sha256:ba4a878e94a961bbbe68b421aa2829f39e9e464a4d3e4647dc8d4ccb0c55eab7"
    );
    assert_eq!(report.changes.len(), 3);

    let positive_int = &report.changes[0];
    assert_eq!(positive_int.kind, LawDiffEventKind::LawWeakened);
    assert_eq!(
        positive_int.law_id.as_deref(),
        Some("echo.scalar.positiveInt.u32-positive")
    );
    assert_eq!(positive_int.subject.as_deref(), Some("scalar:PositiveInt"));
    assert_eq!(positive_int.field_changes.len(), 3);
    assert_eq!(positive_int.field_changes[0].path, "body.minInclusive");

    let footprint = &report.changes[2];
    assert_eq!(footprint.kind, LawDiffEventKind::FootprintExpanded);
    assert_eq!(
        footprint.law_id.as_deref(),
        Some("jedit.op.replaceRangeAsTick.footprint")
    );
    assert_eq!(footprint.added_reads, ["TextBlob"]);
    assert_eq!(footprint.added_creates, ["TickReceipt"]);
    assert_eq!(footprint.removed_forbids, ["Diagnostics"]);
}

#[test]
fn law_diff_ingest_rejects_unsupported_api_version() {
    let unsupported = CI_SEMANTIC_DIFF.replace("wesley.law-diff/v1", "wesley.law-diff/v2");

    let result = JsonLawDiffIngestPort::default().ingest_law_diff(unsupported.as_bytes());

    assert_eq!(result.status, LawDiffIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawDiffUnsupportedVersion,
    );
    assert_diagnostic_field(&result.diagnostics, "apiVersion");
}

#[test]
fn law_diff_ingest_rejects_malformed_json_without_findings() {
    let result = JsonLawDiffIngestPort::default().ingest_law_diff(b"{not-json");

    assert_eq!(result.status, LawDiffIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawDiffMalformedJson,
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
