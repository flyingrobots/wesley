//! Typed Wesley law coverage evidence accepted by Holmes.

use serde::{Deserialize, Serialize};

/// API version supported by the first Holmes law coverage ingest port.
pub const WESLEY_LAW_COVERAGE_API_VERSION: &str = "wesley.law-coverage/v1";

/// Machine-readable category/profile-aware coverage report emitted by Wesley.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LawCoverageReport {
    /// Report API version.
    pub api_version: String,
    /// Coverage profile identifier.
    pub profile: String,
    /// Total number of required subjects considered by the profile.
    pub required_total: usize,
    /// Number of required subjects covered by law.
    pub required_covered: usize,
    /// Required-subject coverage percentage emitted by Wesley.
    pub required_percent: f64,
    /// Per-category coverage records.
    pub categories: Vec<LawCoverageCategory>,
}

impl LawCoverageReport {
    /// Normalize coverage evidence for gate and report construction.
    pub fn normalized_profile(
        &self,
        missing_subject_display_limit: usize,
    ) -> NormalizedLawCoverageProfile {
        NormalizedLawCoverageProfile {
            profile: self.profile.clone(),
            required_total: self.required_total,
            required_covered: self.required_covered,
            required_percent: percentage(self.required_covered, self.required_total),
            categories: self
                .categories
                .iter()
                .enumerate()
                .map(|(category_index, category)| {
                    category.normalized_category(category_index, missing_subject_display_limit)
                })
                .collect(),
        }
    }
}

/// Per-category law coverage record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LawCoverageCategory {
    /// Stable category identifier.
    pub id: String,
    /// Human-readable category label.
    pub label: String,
    /// Whether this category is required in the active profile.
    pub required: bool,
    /// Total subjects considered in this category.
    pub total: usize,
    /// Covered subjects in this category.
    pub covered: usize,
    /// Subject coordinates missing required law in this category.
    pub missing_subjects: Vec<String>,
}

impl LawCoverageCategory {
    fn normalized_category(
        &self,
        category_index: usize,
        missing_subject_display_limit: usize,
    ) -> NormalizedLawCoverageCategory {
        let mut missing_subjects = self.missing_subjects.clone();
        missing_subjects.sort();
        let missing_count = missing_subjects.len();
        let displayed_missing_subjects = missing_subjects
            .iter()
            .take(missing_subject_display_limit)
            .cloned()
            .collect::<Vec<_>>();

        NormalizedLawCoverageCategory {
            category_ref: format!("lawCoverage.categories[{category_index}]"),
            category_index,
            id: self.id.clone(),
            label: self.label.clone(),
            required: self.required,
            total: self.total,
            covered: self.covered,
            percent: percentage(self.covered, self.total),
            missing_count,
            missing_subjects,
            displayed_missing_subjects,
            omitted_missing_subject_count: missing_count
                .saturating_sub(missing_subject_display_limit),
        }
    }
}

/// Normalized coverage evidence for one profile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedLawCoverageProfile {
    /// Coverage profile identifier.
    pub profile: String,
    /// Total number of required subjects considered by the profile.
    pub required_total: usize,
    /// Number of required subjects covered by law.
    pub required_covered: usize,
    /// Required-subject coverage percentage rounded like Wesley CLI output.
    pub required_percent: f64,
    /// Deterministically normalized category records.
    pub categories: Vec<NormalizedLawCoverageCategory>,
}

impl NormalizedLawCoverageProfile {
    /// Return a normalized category by stable id.
    pub fn category(&self, category_id: &str) -> Option<&NormalizedLawCoverageCategory> {
        self.categories
            .iter()
            .find(|category| category.id == category_id)
    }
}

/// Normalized per-category coverage evidence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedLawCoverageCategory {
    /// Stable category reference inside the parsed law coverage report.
    pub category_ref: String,
    /// Zero-based category index in Wesley's emitted coverage order.
    pub category_index: usize,
    /// Stable category identifier.
    pub id: String,
    /// Human-readable category label.
    pub label: String,
    /// Whether this category is required in the active profile.
    pub required: bool,
    /// Total subjects considered in this category.
    pub total: usize,
    /// Covered subjects in this category.
    pub covered: usize,
    /// Category coverage percentage rounded like Wesley CLI output.
    pub percent: f64,
    /// Total missing subject count.
    pub missing_count: usize,
    /// All missing subject coordinates, sorted for deterministic reporting.
    pub missing_subjects: Vec<String>,
    /// Missing subject coordinates retained for inline display.
    pub displayed_missing_subjects: Vec<String>,
    /// Missing subject count omitted from inline display.
    pub omitted_missing_subject_count: usize,
}

/// Calculate Wesley's one-decimal coverage percentage.
pub fn percentage(covered: usize, total: usize) -> f64 {
    if total == 0 {
        100.0
    } else {
        ((covered as f64 / total as f64) * 1000.0).round() / 10.0
    }
}
