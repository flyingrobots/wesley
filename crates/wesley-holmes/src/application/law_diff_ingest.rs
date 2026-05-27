//! JSON ingest boundary for Wesley law diff artifacts.

use serde::Deserialize;

use crate::domain::{
    HolmesDiagnostic, HolmesDiagnosticCode, HolmesSeverity, LawDiffEvent, LawDiffEventKind,
    LawDiffFieldChange, LawDiffLawKind, LawDiffReport, LawDiffReviewPosture,
    WESLEY_LAW_DIFF_API_VERSION,
};

/// Validation status for law diff ingest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LawDiffIngestStatus {
    /// Law diff JSON was accepted and normalized into a typed report.
    Valid,
    /// Law diff JSON was rejected before Holmes assessment.
    Invalid,
}

/// Result of ingesting a Wesley law diff artifact.
#[derive(Debug, Clone, PartialEq)]
pub struct LawDiffIngestResult {
    /// Ingest status.
    pub status: LawDiffIngestStatus,
    /// Deterministically ordered ingest diagnostics.
    pub diagnostics: Vec<HolmesDiagnostic>,
    /// Parsed law diff report when ingest succeeded.
    pub report: Option<LawDiffReport>,
}

impl LawDiffIngestResult {
    fn valid(report: LawDiffReport) -> Self {
        Self {
            status: LawDiffIngestStatus::Valid,
            diagnostics: Vec::new(),
            report: Some(report),
        }
    }

    fn invalid(diagnostics: Vec<HolmesDiagnostic>) -> Self {
        Self {
            status: LawDiffIngestStatus::Invalid,
            diagnostics,
            report: None,
        }
    }
}

/// Input port for `wesley.law-diff/v1` JSON artifacts.
pub trait LawDiffIngestPort {
    /// Ingest raw law diff bytes into a typed Holmes report boundary.
    fn ingest_law_diff(&self, bytes: &[u8]) -> LawDiffIngestResult;
}

/// JSON implementation of the law diff ingest port.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct JsonLawDiffIngestPort;

impl LawDiffIngestPort for JsonLawDiffIngestPort {
    fn ingest_law_diff(&self, bytes: &[u8]) -> LawDiffIngestResult {
        let raw = match serde_json::from_slice::<RawLawDiffReport>(bytes) {
            Ok(raw) => raw,
            Err(err) => {
                return LawDiffIngestResult::invalid(vec![HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawDiffMalformedJson,
                    HolmesSeverity::Error,
                    format!("law diff artifact is not valid wesley.law-diff/v1 JSON: {err}"),
                )
                .for_family("law-diff")]);
            }
        };

        let mut diagnostics = Vec::new();
        if raw.api_version != WESLEY_LAW_DIFF_API_VERSION {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawDiffUnsupportedVersion,
                    HolmesSeverity::Error,
                    format!(
                        "unsupported law diff apiVersion {}; expected {}",
                        raw.api_version, WESLEY_LAW_DIFF_API_VERSION
                    ),
                )
                .for_family("law-diff")
                .at_field("apiVersion"),
            );
        }

        for (field_path, value) in [
            ("oldSchemaHash", raw.old_schema_hash.as_str()),
            ("newSchemaHash", raw.new_schema_hash.as_str()),
            ("oldLawHash", raw.old_law_hash.as_str()),
            ("newLawHash", raw.new_law_hash.as_str()),
        ] {
            if !is_canonical_sha256(value) {
                diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawDiffHashMalformed,
                        HolmesSeverity::Error,
                        "law diff hash must use sha256:<64 lowercase hex>",
                    )
                    .for_family("law-diff")
                    .at_field(field_path),
                );
            }
        }

        let mut changes = Vec::with_capacity(raw.changes.len());
        for (index, raw_event) in raw.changes.into_iter().enumerate() {
            let Some(kind) = LawDiffEventKind::parse(&raw_event.kind) else {
                diagnostics.push(
                    HolmesDiagnostic::new(
                        HolmesDiagnosticCode::HlawDiffUnknownEventKind,
                        HolmesSeverity::Error,
                        format!("unknown law diff event kind {:?}", raw_event.kind),
                    )
                    .for_family("law-diff")
                    .at_field(format!("changes[{index}].kind")),
                );
                continue;
            };

            changes.push(LawDiffEvent {
                kind,
                law_id: raw_event.law_id,
                subject: raw_event.subject,
                law_kind: raw_event.law_kind,
                review_posture: raw_event.review_posture,
                field_changes: raw_event.field_changes,
                added_reads: raw_event.added_reads,
                removed_reads: raw_event.removed_reads,
                added_writes: raw_event.added_writes,
                removed_writes: raw_event.removed_writes,
                added_creates: raw_event.added_creates,
                removed_creates: raw_event.removed_creates,
                added_forbids: raw_event.added_forbids,
                removed_forbids: raw_event.removed_forbids,
            });
        }

        if diagnostics.is_empty() {
            LawDiffIngestResult::valid(LawDiffReport {
                api_version: raw.api_version,
                old_schema_hash: raw.old_schema_hash,
                new_schema_hash: raw.new_schema_hash,
                old_law_hash: raw.old_law_hash,
                new_law_hash: raw.new_law_hash,
                changes,
            })
        } else {
            LawDiffIngestResult::invalid(diagnostics)
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawLawDiffReport {
    api_version: String,
    old_schema_hash: String,
    new_schema_hash: String,
    old_law_hash: String,
    new_law_hash: String,
    changes: Vec<RawLawDiffEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawLawDiffEvent {
    kind: String,
    #[serde(default)]
    law_id: Option<String>,
    #[serde(default)]
    subject: Option<String>,
    #[serde(default)]
    law_kind: Option<LawDiffLawKind>,
    review_posture: LawDiffReviewPosture,
    #[serde(default)]
    field_changes: Vec<LawDiffFieldChange>,
    #[serde(default)]
    added_reads: Vec<String>,
    #[serde(default)]
    removed_reads: Vec<String>,
    #[serde(default)]
    added_writes: Vec<String>,
    #[serde(default)]
    removed_writes: Vec<String>,
    #[serde(default)]
    added_creates: Vec<String>,
    #[serde(default)]
    removed_creates: Vec<String>,
    #[serde(default)]
    added_forbids: Vec<String>,
    #[serde(default)]
    removed_forbids: Vec<String>,
}

fn is_canonical_sha256(value: &str) -> bool {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return false;
    };
    hex.len() == 64
        && hex
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
