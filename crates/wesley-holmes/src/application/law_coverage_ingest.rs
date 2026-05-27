//! JSON ingest boundary for Wesley law coverage artifacts.

use crate::domain::{
    HolmesDiagnostic, HolmesDiagnosticCode, HolmesSeverity, LawCoverageReport,
    WESLEY_LAW_COVERAGE_API_VERSION,
};

/// Validation status for law coverage ingest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LawCoverageIngestStatus {
    /// Law coverage JSON was accepted and normalized into a typed report.
    Valid,
    /// Law coverage JSON was rejected before Holmes assessment.
    Invalid,
}

/// Result of ingesting a Wesley law coverage artifact.
#[derive(Debug, Clone, PartialEq)]
pub struct LawCoverageIngestResult {
    /// Ingest status.
    pub status: LawCoverageIngestStatus,
    /// Deterministically ordered ingest diagnostics.
    pub diagnostics: Vec<HolmesDiagnostic>,
    /// Parsed law coverage report when ingest succeeded.
    pub report: Option<LawCoverageReport>,
}

impl LawCoverageIngestResult {
    fn valid(report: LawCoverageReport) -> Self {
        Self {
            status: LawCoverageIngestStatus::Valid,
            diagnostics: Vec::new(),
            report: Some(report),
        }
    }

    fn invalid(diagnostics: Vec<HolmesDiagnostic>) -> Self {
        Self {
            status: LawCoverageIngestStatus::Invalid,
            diagnostics,
            report: None,
        }
    }
}

/// Input port for `wesley.law-coverage/v1` JSON artifacts.
pub trait LawCoverageIngestPort {
    /// Ingest raw law coverage bytes into a typed Holmes report boundary.
    fn ingest_law_coverage(&self, bytes: &[u8]) -> LawCoverageIngestResult;
}

/// JSON implementation of the law coverage ingest port.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct JsonLawCoverageIngestPort;

impl LawCoverageIngestPort for JsonLawCoverageIngestPort {
    fn ingest_law_coverage(&self, bytes: &[u8]) -> LawCoverageIngestResult {
        let report = match serde_json::from_slice::<LawCoverageReport>(bytes) {
            Ok(report) => report,
            Err(err) => {
                return LawCoverageIngestResult::invalid(vec![HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCoverageMalformedJson,
                    HolmesSeverity::Error,
                    format!(
                        "law coverage artifact is not valid wesley.law-coverage/v1 JSON: {err}"
                    ),
                )
                .for_family("law-coverage")]);
            }
        };

        if report.api_version != WESLEY_LAW_COVERAGE_API_VERSION {
            return LawCoverageIngestResult::invalid(vec![HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCoverageUnsupportedVersion,
                HolmesSeverity::Error,
                format!(
                    "unsupported law coverage apiVersion {}; expected {}",
                    report.api_version, WESLEY_LAW_COVERAGE_API_VERSION
                ),
            )
            .for_family("law-coverage")
            .at_field("apiVersion")]);
        }

        LawCoverageIngestResult::valid(report)
    }
}
