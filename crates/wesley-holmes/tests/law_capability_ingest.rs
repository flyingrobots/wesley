use wesley_holmes::{
    HolmesDiagnosticCode, JsonLawCapabilityIngestPort, LawCapabilityIngestPort,
    LawCapabilityIngestStatus,
};

const CAPABILITY_REPORT: &str = r#"{
  "apiVersion": "wesley.law-capabilities/v1",
  "reportOnly": true,
  "runtimeEnforcement": false,
  "note": "Footprint capabilities are report-only in weslaw v1; no runtime enforcement is claimed.",
  "footprints": [
    {
      "lawId": "operation.replaceRange.footprint",
      "subject": "operation:Mutation.replaceRange",
      "reads": [
        "TextBlob",
        "Selection"
      ],
      "writes": [
        "TextBlob"
      ],
      "creates": [
        "TickReceipt"
      ],
      "forbids": [
        "Diagnostics"
      ]
    },
    {
      "lawId": "operation.snapshot.footprint",
      "subject": "operation:Query.snapshot",
      "reads": [
        "TextBlob"
      ],
      "writes": [],
      "creates": [],
      "forbids": []
    }
  ]
}"#;

#[test]
fn law_capability_ingest_accepts_current_wesley_capability_report_json() {
    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(CAPABILITY_REPORT.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Valid);
    assert!(result.diagnostics.is_empty());

    let report = result
        .report
        .expect("valid law capability JSON should produce a report");
    assert_eq!(report.api_version, "wesley.law-capabilities/v1");
    assert!(report.report_only);
    assert!(!report.runtime_enforcement);
    assert_eq!(report.footprints.len(), 2);
    assert_eq!(report.footprints[0].reads, ["TextBlob", "Selection"]);
}

#[test]
fn law_capability_report_normalizes_operations_and_posture() {
    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(CAPABILITY_REPORT.as_bytes());
    let report = result.report.expect("valid report should parse");

    let operations = report.normalized_operations();

    assert_eq!(operations.len(), 2);
    assert_eq!(operations[0].subject, "operation:Mutation.replaceRange");
    assert_eq!(operations[0].operation_ref, "lawCapabilities.footprints[0]");
    assert!(operations[0].report_only);
    assert!(!operations[0].runtime_enforcement);
    assert_eq!(
        operations[0].wording_hint,
        "report-only footprint declaration; do not imply runtime enforcement"
    );
    assert_eq!(operations[0].reads, ["Selection", "TextBlob"]);
    assert_eq!(operations[0].writes, ["TextBlob"]);
    assert_eq!(operations[0].creates, ["TickReceipt"]);
    assert_eq!(operations[0].forbids, ["Diagnostics"]);
}

#[test]
fn law_capability_ingest_rejects_missing_posture_fields() {
    let missing_posture = CAPABILITY_REPORT.replace("  \"reportOnly\": true,\n", "");

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(missing_posture.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityMissingPosture,
    );
    assert_diagnostic_field(&result.diagnostics, "reportOnly");
}

#[test]
fn law_capability_ingest_rejects_legacy_capability_report_alias() {
    let legacy =
        CAPABILITY_REPORT.replace("wesley.law-capabilities/v1", "wesley.capability-report/v1");

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(legacy.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityUnsupportedVersion,
    );
    assert_diagnostic_field(&result.diagnostics, "apiVersion");
}

#[test]
fn law_capability_ingest_rejects_contradictory_resource_posture() {
    let contradictory = CAPABILITY_REPORT.replace(
        r#""forbids": [
        "Diagnostics"
      ]"#,
        r#""forbids": [
        "Diagnostics",
        "TextBlob"
      ]"#,
    );

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(contradictory.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityContradictoryResourcePosture,
    );
    assert_diagnostic_field(&result.diagnostics, "footprints[0].writes");
}

#[test]
fn law_capability_ingest_rejects_forbids_overlapping_all_touched_resources() {
    let contradictory = r#"{
  "apiVersion": "wesley.law-capabilities/v1",
  "reportOnly": true,
  "runtimeEnforcement": false,
  "footprints": [
    {
      "lawId": "operation.replaceRange.footprint",
      "subject": "operation:Mutation.replaceRange",
      "reads": [
        "TextBlob"
      ],
      "writes": [],
      "creates": [],
      "forbids": [
        "Cursor",
        "DerivedRead",
        "TextBlob"
      ],
      "slots": [
        {
          "name": "cursor",
          "kind": "Cursor",
          "bindFromArg": "input.cursor",
          "access": [
            "read"
          ]
        }
      ],
      "closures": [
        {
          "name": "visibleRange",
          "fromSlot": "cursor",
          "operator": "window",
          "argBindings": [
            "cursor"
          ],
          "reads": [
            "DerivedRead"
          ],
          "cardinality": "many"
        }
      ]
    }
  ]
}"#;

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(contradictory.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityContradictoryResourcePosture,
    );
    assert_diagnostic_field(&result.diagnostics, "footprints[0].reads");
    assert_diagnostic_field(&result.diagnostics, "footprints[0].slots[0].kind");
    assert_diagnostic_field(&result.diagnostics, "footprints[0].closures[0].reads");
}

#[test]
fn law_capability_ingest_requires_explicit_empty_footprint() {
    let empty = r#"{
  "apiVersion": "wesley.law-capabilities/v1",
  "reportOnly": true,
  "runtimeEnforcement": false,
  "footprints": [
    {
      "lawId": "operation.noop.footprint",
      "subject": "operation:Mutation.noop",
      "reads": [],
      "writes": [],
      "creates": [],
      "forbids": []
    }
  ]
}"#;

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(empty.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityImplicitEmptyFootprint,
    );

    let explicit_empty = empty.replace(
        "      \"forbids\": []",
        "      \"forbids\": [],\n      \"intentionallyEmpty\": true",
    );
    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(explicit_empty.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Valid);
}

#[test]
fn law_capability_ingest_rejects_unsupported_api_version() {
    let unsupported =
        CAPABILITY_REPORT.replace("wesley.law-capabilities/v1", "wesley.law-capabilities/v2");

    let result = JsonLawCapabilityIngestPort.ingest_law_capabilities(unsupported.as_bytes());

    assert_eq!(result.status, LawCapabilityIngestStatus::Invalid);
    assert!(result.report.is_none());
    assert_diagnostic(
        &result.diagnostics,
        HolmesDiagnosticCode::HlawCapabilityUnsupportedVersion,
    );
    assert_diagnostic_field(&result.diagnostics, "apiVersion");
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
