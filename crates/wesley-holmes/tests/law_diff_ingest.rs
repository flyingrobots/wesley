use wesley_holmes::{
    HolmesDiagnosticCode, JsonLawDiffIngestPort, LawDiffEventKind, LawDiffIngestPort,
    LawDiffIngestStatus,
};

const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");

#[test]
fn law_diff_ingest_accepts_wesley_law_diff_v1_json() {
    let result = JsonLawDiffIngestPort.ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes());

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
fn law_diff_report_normalizes_events_without_reclassifying_wesley_kind() {
    let result = JsonLawDiffIngestPort.ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes());
    let report = result.report.expect("valid law diff should parse");

    let records = report.normalized_events();

    assert_eq!(records.len(), 3);
    assert_eq!(records[0].event_ref, "lawDiff.changes[0]");
    assert_eq!(records[0].event_index, 0);
    assert_eq!(records[0].kind, LawDiffEventKind::LawWeakened);
    assert_eq!(
        records[0].law_id.as_deref(),
        Some("echo.scalar.positiveInt.u32-positive")
    );
    assert_eq!(records[0].subject.as_deref(), Some("scalar:PositiveInt"));
    assert_eq!(
        records[0].old_law_hash,
        "sha256:88fcbb7fb07cc0bb5dfa30252ec61badb3a8dff1be71c0f20ae21031e4e80f51"
    );
    assert_eq!(
        records[0].new_law_hash,
        "sha256:ba4a878e94a961bbbe68b421aa2829f39e9e464a4d3e4647dc8d4ccb0c55eab7"
    );
    assert_eq!(records[2].event_ref, "lawDiff.changes[2]");
    assert_eq!(records[2].kind, LawDiffEventKind::FootprintExpanded);
    assert_eq!(records[2].added_reads, ["TextBlob"]);
}

#[test]
fn law_diff_normalized_events_preserve_repeated_law_ids_as_distinct_records() {
    let repeated_law_id = format!(
        r#"{{
  "apiVersion": "wesley.law-diff/v1",
  "oldSchemaHash": "sha256:{hash_a}",
  "newSchemaHash": "sha256:{hash_a}",
  "oldLawHash": "sha256:{hash_b}",
  "newLawHash": "sha256:{hash_c}",
  "changes": [
    {{
      "kind": "LAW_WEAKENED",
      "lawId": "echo.scalar.positiveInt.u32-positive",
      "subject": "scalar:PositiveInt",
      "lawKind": "scalarSemantics",
      "reviewPosture": "requires-review"
    }},
    {{
      "kind": "LAW_TAGS_CHANGED",
      "lawId": "echo.scalar.positiveInt.u32-positive",
      "subject": "scalar:PositiveInt",
      "lawKind": "scalarSemantics",
      "reviewPosture": "requires-review"
    }}
  ]
}}"#,
        hash_a = "a".repeat(64),
        hash_b = "b".repeat(64),
        hash_c = "c".repeat(64)
    );

    let result = JsonLawDiffIngestPort.ingest_law_diff(repeated_law_id.as_bytes());
    let records = result
        .report
        .expect("valid repeated law id fixture should parse")
        .normalized_events();

    assert_eq!(records.len(), 2);
    assert_eq!(records[0].event_ref, "lawDiff.changes[0]");
    assert_eq!(records[1].event_ref, "lawDiff.changes[1]");
    assert_eq!(records[0].law_id, records[1].law_id);
    assert_ne!(records[0].event_ref, records[1].event_ref);
    assert_eq!(records[0].kind, LawDiffEventKind::LawWeakened);
    assert_eq!(records[1].kind, LawDiffEventKind::LawTagsChanged);
}

#[test]
fn law_diff_ingest_rejects_unsupported_api_version() {
    let unsupported = CI_SEMANTIC_DIFF.replace("wesley.law-diff/v1", "wesley.law-diff/v2");

    let result = JsonLawDiffIngestPort.ingest_law_diff(unsupported.as_bytes());

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
    let result = JsonLawDiffIngestPort.ingest_law_diff(b"{not-json");

    assert_eq!(result.status, LawDiffIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawDiffMalformedJson,
    );
}

#[test]
fn law_diff_ingest_rejects_unknown_event_kind() {
    let unknown_kind = CI_SEMANTIC_DIFF.replace("LAW_WEAKENED", "QUANTUM_LAW_SHIFT");

    let result = JsonLawDiffIngestPort.ingest_law_diff(unknown_kind.as_bytes());

    assert_eq!(result.status, LawDiffIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawDiffUnknownEventKind,
    );
    assert_diagnostic_field(&result.diagnostics, "changes[0].kind");
}

#[test]
fn law_diff_ingest_rejects_duplicate_law_id_event_identity() {
    let duplicate = format!(
        r#"{{
  "apiVersion": "wesley.law-diff/v1",
  "oldSchemaHash": "sha256:{hash_a}",
  "newSchemaHash": "sha256:{hash_a}",
  "oldLawHash": "sha256:{hash_b}",
  "newLawHash": "sha256:{hash_c}",
  "changes": [
    {{
      "kind": "LAW_WEAKENED",
      "lawId": "echo.scalar.positiveInt.u32-positive",
      "subject": "scalar:PositiveInt",
      "lawKind": "scalarSemantics",
      "reviewPosture": "requires-review"
    }},
    {{
      "kind": "LAW_WEAKENED",
      "lawId": "echo.scalar.positiveInt.u32-positive",
      "subject": "scalar:PositiveInt",
      "lawKind": "scalarSemantics",
      "reviewPosture": "requires-review"
    }}
  ]
}}"#,
        hash_a = "a".repeat(64),
        hash_b = "b".repeat(64),
        hash_c = "c".repeat(64)
    );

    let result = JsonLawDiffIngestPort.ingest_law_diff(duplicate.as_bytes());

    assert_eq!(result.status, LawDiffIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawDiffDuplicateEvent,
    );
    assert_diagnostic_field(&result.diagnostics, "changes[1].lawId");
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
