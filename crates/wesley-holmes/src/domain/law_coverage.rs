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
