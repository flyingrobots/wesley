//! JSON ingest boundary for Wesley law coverage artifacts.

use crate::domain::{
    percentage, HolmesDiagnostic, HolmesDiagnosticCode, HolmesSeverity, LawCoverageReport,
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

        let diagnostics = coverage_count_diagnostics(&report);
        if diagnostics.is_empty() {
            LawCoverageIngestResult::valid(report)
        } else {
            LawCoverageIngestResult::invalid(diagnostics)
        }
    }
}

fn coverage_count_diagnostics(report: &LawCoverageReport) -> Vec<HolmesDiagnostic> {
    let mut diagnostics = Vec::new();

    if report.required_covered > report.required_total {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
                HolmesSeverity::Error,
                "law coverage requiredCovered must not exceed requiredTotal",
            )
            .for_family("law-coverage")
            .at_field("requiredCovered"),
        );
    }

    let required_total = report
        .categories
        .iter()
        .filter(|category| category.required)
        .map(|category| category.total)
        .sum::<usize>();
    if report.required_total != required_total {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
                HolmesSeverity::Error,
                "law coverage requiredTotal must equal the sum of required category totals",
            )
            .for_family("law-coverage")
            .at_field("requiredTotal"),
        );
    }

    let required_covered = report
        .categories
        .iter()
        .filter(|category| category.required)
        .map(|category| category.covered)
        .sum::<usize>();
    if report.required_covered != required_covered {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
                HolmesSeverity::Error,
                "law coverage requiredCovered must equal the sum of required category covered counts",
            )
            .for_family("law-coverage")
            .at_field("requiredCovered"),
        );
    }

    let expected_required_percent = percentage(report.required_covered, report.required_total);
    if (report.required_percent - expected_required_percent).abs() > 0.000_001 {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
                HolmesSeverity::Error,
                format!(
                    "law coverage requiredPercent must be {expected_required_percent:.1} for the supplied required counts"
                ),
            )
            .for_family("law-coverage")
            .at_field("requiredPercent"),
        );
    }

    for (index, category) in report.categories.iter().enumerate() {
        if category.covered > category.total {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCoverageInconsistentCounts,
                    HolmesSeverity::Error,
                    "law coverage category covered count must not exceed total count",
                )
                .for_family("law-coverage")
                .at_field(format!("categories[{index}].covered")),
            );
        }

        let expected_missing = category.total.saturating_sub(category.covered);
        if category.missing_subjects.len() != expected_missing {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCoverageMissingCountMismatch,
                    HolmesSeverity::Error,
                    format!(
                        "law coverage category missingSubjects length must be {expected_missing} for supplied counts"
                    ),
                )
                .for_family("law-coverage")
                .at_field(format!("categories[{index}].missingSubjects")),
            );
        }
    }

    diagnostics
}
