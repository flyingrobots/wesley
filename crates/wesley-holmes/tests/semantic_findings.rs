use wesley_holmes::{
    semantic_change_findings_from_law_diff, HolmesDiagnosticCode, JsonLawDiffIngestPort,
    LawDiffEventKind, LawDiffIngestPort, LawDiffReviewPosture, LawFindingSeverity,
    NormalizedLawDiffEvent, SemanticChangeFinding,
};

const CI_SEMANTIC_DIFF: &str =
    include_str!("../../../test/fixtures/weslaw/diff/ci-semantic-diff.json");
const BUNDLE_HASH: &str = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

#[test]
fn semantic_findings_preserve_wesley_event_classification_and_traceability() {
    let report = JsonLawDiffIngestPort
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    let findings = semantic_change_findings_from_law_diff(
        &report,
        BUNDLE_HASH,
        "artifacts/law-diff.json",
        Some("release".to_owned()),
    )
    .expect("findings should construct");

    assert_eq!(findings.len(), 3);
    let weakened = findings
        .iter()
        .find(|finding| finding.law_id.as_deref() == Some("echo.scalar.positiveInt.u32-positive"))
        .expect("weakened law finding should exist");
    assert_eq!(weakened.source_artifact_ref, "artifacts/law-diff.json");
    assert_eq!(weakened.bundle_hash_family, BUNDLE_HASH);
    assert_eq!(weakened.event_ref, "lawDiff.changes[0]");
    assert_eq!(
        weakened.law_id.as_deref(),
        Some("echo.scalar.positiveInt.u32-positive")
    );
    assert_eq!(weakened.subject.as_deref(), Some("scalar:PositiveInt"));
    assert_eq!(weakened.subject_kind.as_deref(), Some("scalar"));
    assert_eq!(
        weakened.change_posture,
        LawDiffReviewPosture::RequiresReview
    );
    assert_eq!(weakened.severity, LawFindingSeverity::Critical);
    assert_eq!(weakened.severity_label, "critical");
    assert!(weakened.summary.contains("LAW_WEAKENED"));
    assert_eq!(weakened.field_changes.len(), 3);

    let footprint = findings
        .iter()
        .find(|finding| finding.event_kind == LawDiffEventKind::FootprintExpanded)
        .expect("footprint finding should exist");
    assert_eq!(footprint.severity, LawFindingSeverity::Error);
    assert_eq!(footprint.added_reads, ["TextBlob"]);
    assert_eq!(footprint.added_creates, ["TickReceipt"]);
    assert_eq!(footprint.removed_forbids, ["Diagnostics"]);
}

#[test]
fn semantic_finding_ids_are_stable_and_distinguish_distinct_events() {
    let report = JsonLawDiffIngestPort
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    let first = semantic_change_findings_from_law_diff(
        &report,
        BUNDLE_HASH,
        "artifacts/law-diff.json",
        Some("release".to_owned()),
    )
    .expect("findings should construct");
    let second = semantic_change_findings_from_law_diff(
        &report,
        BUNDLE_HASH,
        "artifacts/law-diff.json",
        Some("release".to_owned()),
    )
    .expect("findings should construct");

    assert_eq!(first[0].finding_id, second[0].finding_id);
    assert_ne!(first[0].finding_id, first[1].finding_id);
    assert!(first[0].finding_id.starts_with("semantic-change:"));
}

#[test]
fn semantic_findings_are_sorted_by_severity_and_subject() {
    let report = JsonLawDiffIngestPort
        .ingest_law_diff(CI_SEMANTIC_DIFF.as_bytes())
        .report
        .expect("fixture should parse");

    let findings = semantic_change_findings_from_law_diff(
        &report,
        BUNDLE_HASH,
        "artifacts/law-diff.json",
        None,
    )
    .expect("findings should construct");

    assert_eq!(findings[0].severity, LawFindingSeverity::Critical);
    assert_eq!(findings[0].event_kind, LawDiffEventKind::LawWeakened);
    assert_eq!(findings[1].severity, LawFindingSeverity::Critical);
    assert_eq!(findings[1].event_kind, LawDiffEventKind::LawWeakened);
    assert_eq!(findings[2].severity, LawFindingSeverity::Error);
    assert_eq!(findings[2].event_kind, LawDiffEventKind::FootprintExpanded);
}

#[test]
fn semantic_finding_constructor_rejects_missing_event_identity() {
    let event = NormalizedLawDiffEvent {
        event_ref: " ".to_owned(),
        event_index: 0,
        api_version: "wesley.law-diff/v1".to_owned(),
        old_schema_hash: BUNDLE_HASH.to_owned(),
        new_schema_hash: BUNDLE_HASH.to_owned(),
        old_law_hash: BUNDLE_HASH.to_owned(),
        new_law_hash: BUNDLE_HASH.to_owned(),
        kind: LawDiffEventKind::LawChanged,
        law_id: Some("law.example".to_owned()),
        subject: Some("scalar:Example".to_owned()),
        law_kind: None,
        review_posture: LawDiffReviewPosture::RequiresReview,
        field_changes: Vec::new(),
        added_reads: Vec::new(),
        removed_reads: Vec::new(),
        added_writes: Vec::new(),
        removed_writes: Vec::new(),
        added_creates: Vec::new(),
        removed_creates: Vec::new(),
        added_forbids: Vec::new(),
        removed_forbids: Vec::new(),
    };

    let diagnostic = SemanticChangeFinding::from_normalized_event(
        BUNDLE_HASH,
        "artifacts/law-diff.json",
        None,
        Vec::new(),
        &event,
    )
    .expect_err("blank event ref should fail");

    assert_eq!(
        diagnostic.code,
        HolmesDiagnosticCode::HlawFindingMissingEventIdentity
    );
    assert_eq!(diagnostic.field_path.as_deref(), Some("eventRef"));
}
