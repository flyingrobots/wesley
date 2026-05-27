//! Typed Wesley law diff evidence accepted by Holmes.

use serde::{Deserialize, Serialize};

/// API version supported by the first Holmes law diff ingest port.
pub const WESLEY_LAW_DIFF_API_VERSION: &str = "wesley.law-diff/v1";

/// Machine-readable semantic diff report emitted by `wesley law diff --json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawDiffReport {
    /// Report API version.
    pub api_version: String,
    /// Old document schema hash anchor.
    pub old_schema_hash: String,
    /// New document schema hash anchor.
    pub new_schema_hash: String,
    /// Old semantic Law IR hash.
    pub old_law_hash: String,
    /// New semantic Law IR hash.
    pub new_law_hash: String,
    /// Semantic change events in Wesley's emitted review order.
    pub changes: Vec<LawDiffEvent>,
}

/// Single semantic law diff event preserved from Wesley output.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawDiffEvent {
    /// Event classification supplied by Wesley.
    pub kind: LawDiffEventKind,
    /// Stable law id affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_id: Option<String>,
    /// Subject coordinate affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Law kind affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_kind: Option<LawDiffLawKind>,
    /// Review posture emitted by Wesley.
    pub review_posture: LawDiffReviewPosture,
    /// Field-level changes when a law body changed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub field_changes: Vec<LawDiffFieldChange>,
    /// Footprint resources newly read.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_reads: Vec<String>,
    /// Footprint resources no longer read.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_reads: Vec<String>,
    /// Footprint resources newly written.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_writes: Vec<String>,
    /// Footprint resources no longer written.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_writes: Vec<String>,
    /// Footprint resources newly created.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_creates: Vec<String>,
    /// Footprint resources no longer created.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_creates: Vec<String>,
    /// Footprint resources newly forbidden.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_forbids: Vec<String>,
    /// Footprint resources no longer forbidden.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_forbids: Vec<String>,
}

/// Law diff event classifications emitted by Wesley.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LawDiffEventKind {
    /// Bundle-level semantic fields changed.
    LawBundleChanged,
    /// Semantic registry facts changed.
    RegistryChanged,
    /// New active law entry.
    LawAdded,
    /// Active law entry removed.
    LawRemoved,
    /// Existing law tags changed.
    LawTagsChanged,
    /// Existing law was monotonically strengthened.
    LawStrengthened,
    /// Existing law was monotonically weakened.
    LawWeakened,
    /// Existing law changed outside a narrower v1 event class.
    LawChanged,
    /// Scalar semantic body changed.
    ScalarSemanticsChanged,
    /// Variant law body changed.
    VariantLawChanged,
    /// Footprint reach expanded.
    FootprintExpanded,
    /// Footprint reach contracted.
    FootprintContracted,
    /// Footprint changed in mixed or structural ways.
    FootprintChanged,
    /// Channel version changed.
    ChannelVersionChanged,
    /// Channel law changed without a channel-version change.
    ChannelLawChanged,
    /// Typed invariant predicate changed.
    PredicateChanged,
    /// A law no longer binds to the active schema or law registry.
    BindingBroken,
    /// Schema hash anchor changed.
    SchemaHashRebound,
}

impl LawDiffEventKind {
    /// Parse Wesley's stable event-kind string.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "LAW_BUNDLE_CHANGED" => Some(Self::LawBundleChanged),
            "REGISTRY_CHANGED" => Some(Self::RegistryChanged),
            "LAW_ADDED" => Some(Self::LawAdded),
            "LAW_REMOVED" => Some(Self::LawRemoved),
            "LAW_TAGS_CHANGED" => Some(Self::LawTagsChanged),
            "LAW_STRENGTHENED" => Some(Self::LawStrengthened),
            "LAW_WEAKENED" => Some(Self::LawWeakened),
            "LAW_CHANGED" => Some(Self::LawChanged),
            "SCALAR_SEMANTICS_CHANGED" => Some(Self::ScalarSemanticsChanged),
            "VARIANT_LAW_CHANGED" => Some(Self::VariantLawChanged),
            "FOOTPRINT_EXPANDED" => Some(Self::FootprintExpanded),
            "FOOTPRINT_CONTRACTED" => Some(Self::FootprintContracted),
            "FOOTPRINT_CHANGED" => Some(Self::FootprintChanged),
            "CHANNEL_VERSION_CHANGED" => Some(Self::ChannelVersionChanged),
            "CHANNEL_LAW_CHANGED" => Some(Self::ChannelLawChanged),
            "PREDICATE_CHANGED" => Some(Self::PredicateChanged),
            "BINDING_BROKEN" => Some(Self::BindingBroken),
            "SCHEMA_HASH_REBOUND" => Some(Self::SchemaHashRebound),
            _ => None,
        }
    }
}

/// Law body kind affected by a semantic diff event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LawDiffLawKind {
    /// Scalar semantic law.
    ScalarSemantics,
    /// Variant or discriminated-input law.
    VariantLaw,
    /// Operation footprint law.
    FootprintLaw,
    /// Channel or protocol law.
    ChannelLaw,
    /// Typed invariant law.
    InvariantLaw,
}

/// Review posture supplied by Wesley for a diff event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LawDiffReviewPosture {
    /// The semantic change requires review.
    RequiresReview,
}

/// Field-level semantic law diff.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LawDiffFieldChange {
    /// Law body path that changed.
    pub path: String,
    /// Previous canonical value.
    pub old: serde_json::Value,
    /// New canonical value.
    pub new: serde_json::Value,
}
