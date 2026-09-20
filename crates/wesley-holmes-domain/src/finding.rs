//! Holmes semantic findings derived from Wesley law diff evidence.

use serde::{Deserialize, Serialize};

use super::diagnostic::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};
use super::law_diff::{
    LawDiffEventKind, LawDiffFieldChange, LawDiffReport, LawDiffReviewPosture,
    NormalizedLawDiffEvent,
};

/// Reviewer-facing severity assigned to a semantic change finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LawFindingSeverity {
    /// Informational change.
    Info,
    /// Advisory change that should be visible but does not imply risk by itself.
    Advisory,
    /// Warning change that deserves reviewer attention.
    Warning,
    /// Error-level change under the default Holmes mapping.
    Error,
    /// Critical change under the default Holmes mapping.
    Critical,
}

impl LawFindingSeverity {
    /// Return a lowercase label for renderer-neutral output.
    pub fn label(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Advisory => "advisory",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Critical => "critical",
        }
    }

    fn rank_desc(self) -> u8 {
        match self {
            Self::Critical => 0,
            Self::Error => 1,
            Self::Warning => 2,
            Self::Advisory => 3,
            Self::Info => 4,
        }
    }
}

/// Renderer-neutral Holmes finding for one Wesley semantic law change.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticChangeFinding {
    /// Stable Holmes finding id.
    pub finding_id: String,
    /// Stable event reference inside the source law diff report.
    pub event_ref: String,
    /// Zero-based event index in Wesley's emitted diff order.
    pub event_index: usize,
    /// Source artifact reference supplied by the caller.
    pub source_artifact_ref: String,
    /// Manifest or bundle hash family used for finding id derivation.
    pub bundle_hash_family: String,
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
    /// Wesley event classification preserved exactly.
    pub event_kind: LawDiffEventKind,
    /// Wesley review posture preserved exactly.
    pub change_posture: LawDiffReviewPosture,
    /// Default Holmes severity before later policy overrides.
    pub severity: LawFindingSeverity,
    /// Stable text severity label.
    pub severity_label: String,
    /// Stable law id affected by the event when Wesley supplied one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_id: Option<String>,
    /// Subject coordinate affected by the event when Wesley supplied one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Subject kind derived from the subject coordinate.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<String>,
    /// Optional active assessment profile.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    /// Optional classifier tags reserved for later policy mapping.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Bounded summary suitable for tables and comments.
    pub summary: String,
    /// Renderer-neutral detail text.
    pub details: String,
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

impl SemanticChangeFinding {
    /// Construct one finding from a normalized Wesley law diff event.
    pub fn from_normalized_event(
        bundle_hash_family: impl Into<String>,
        source_artifact_ref: impl Into<String>,
        profile: Option<String>,
        tags: Vec<String>,
        event: &NormalizedLawDiffEvent,
    ) -> HolmesResult<Self> {
        if event.event_ref.trim().is_empty() {
            return Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawFindingMissingEventIdentity,
                HolmesSeverity::Error,
                "semantic change finding requires a non-empty event reference",
            )
            .for_family("law-diff")
            .at_field("eventRef"));
        }

        let bundle_hash_family = bundle_hash_family.into();
        let source_artifact_ref = source_artifact_ref.into();
        let severity = default_severity_for_event(event.kind);
        let subject_kind = event.subject.as_deref().and_then(subject_kind);
        let summary = summary_for_event(event);
        let details = details_for_event(event);
        let finding_id = stable_finding_id(&bundle_hash_family, event);

        Ok(Self {
            finding_id,
            event_ref: event.event_ref.clone(),
            event_index: event.event_index,
            source_artifact_ref,
            bundle_hash_family,
            api_version: event.api_version.clone(),
            old_schema_hash: event.old_schema_hash.clone(),
            new_schema_hash: event.new_schema_hash.clone(),
            old_law_hash: event.old_law_hash.clone(),
            new_law_hash: event.new_law_hash.clone(),
            event_kind: event.kind,
            change_posture: event.review_posture,
            severity,
            severity_label: severity.label().to_owned(),
            law_id: event.law_id.clone(),
            subject: event.subject.clone(),
            subject_kind,
            profile,
            tags,
            summary,
            details,
            field_changes: event.field_changes.clone(),
            added_reads: sorted_strings(&event.added_reads),
            removed_reads: sorted_strings(&event.removed_reads),
            added_writes: sorted_strings(&event.added_writes),
            removed_writes: sorted_strings(&event.removed_writes),
            added_creates: sorted_strings(&event.added_creates),
            removed_creates: sorted_strings(&event.removed_creates),
            added_forbids: sorted_strings(&event.added_forbids),
            removed_forbids: sorted_strings(&event.removed_forbids),
        })
    }
}

/// Build sorted semantic change findings for a parsed law diff report.
pub fn semantic_change_findings_from_law_diff(
    report: &LawDiffReport,
    bundle_hash_family: impl Into<String>,
    source_artifact_ref: impl Into<String>,
    profile: Option<String>,
) -> HolmesResult<Vec<SemanticChangeFinding>> {
    let bundle_hash_family = bundle_hash_family.into();
    let source_artifact_ref = source_artifact_ref.into();
    let mut findings = report
        .normalized_events()
        .iter()
        .map(|event| {
            SemanticChangeFinding::from_normalized_event(
                bundle_hash_family.clone(),
                source_artifact_ref.clone(),
                profile.clone(),
                Vec::new(),
                event,
            )
        })
        .collect::<HolmesResult<Vec<_>>>()?;
    sort_semantic_change_findings(&mut findings);
    Ok(findings)
}

/// Sort semantic change findings by the default deterministic review order.
pub fn sort_semantic_change_findings(findings: &mut [SemanticChangeFinding]) {
    findings.sort_by(|left, right| {
        left.severity
            .rank_desc()
            .cmp(&right.severity.rank_desc())
            .then_with(|| left.subject_kind.cmp(&right.subject_kind))
            .then_with(|| left.subject.cmp(&right.subject))
            .then_with(|| left.law_id.cmp(&right.law_id))
            .then_with(|| left.event_kind.cmp(&right.event_kind))
            .then_with(|| left.event_index.cmp(&right.event_index))
    });
}

/// Return the first default Holmes severity for a Wesley law diff event kind.
pub fn default_severity_for_event(kind: LawDiffEventKind) -> LawFindingSeverity {
    match kind {
        LawDiffEventKind::BindingBroken
        | LawDiffEventKind::LawRemoved
        | LawDiffEventKind::LawWeakened => LawFindingSeverity::Critical,
        LawDiffEventKind::FootprintExpanded | LawDiffEventKind::SchemaHashRebound => {
            LawFindingSeverity::Error
        }
        LawDiffEventKind::ChannelLawChanged
        | LawDiffEventKind::ChannelVersionChanged
        | LawDiffEventKind::FootprintChanged
        | LawDiffEventKind::LawBundleChanged
        | LawDiffEventKind::LawChanged
        | LawDiffEventKind::PredicateChanged
        | LawDiffEventKind::RegistryChanged
        | LawDiffEventKind::ScalarSemanticsChanged
        | LawDiffEventKind::VariantLawChanged => LawFindingSeverity::Warning,
        LawDiffEventKind::FootprintContracted
        | LawDiffEventKind::LawAdded
        | LawDiffEventKind::LawStrengthened
        | LawDiffEventKind::LawTagsChanged => LawFindingSeverity::Advisory,
    }
}

fn stable_finding_id(bundle_hash_family: &str, event: &NormalizedLawDiffEvent) -> String {
    let identity = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        bundle_hash_family,
        event.event_ref,
        event.event_index,
        event.kind.as_str(),
        event.law_id.as_deref().unwrap_or(""),
        event.subject.as_deref().unwrap_or("")
    );
    format!("semantic-change:{:016x}", fnv1a64(identity.as_bytes()))
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn summary_for_event(event: &NormalizedLawDiffEvent) -> String {
    let target = event
        .subject
        .as_deref()
        .or(event.law_id.as_deref())
        .unwrap_or("law bundle");
    format!("{} requires review for {target}", event.kind.as_str())
}

fn details_for_event(event: &NormalizedLawDiffEvent) -> String {
    let mut parts = Vec::new();
    if !event.field_changes.is_empty() {
        parts.push(format!("{} field change(s)", event.field_changes.len()));
    }
    push_resource_detail(&mut parts, "added reads", &event.added_reads);
    push_resource_detail(&mut parts, "removed reads", &event.removed_reads);
    push_resource_detail(&mut parts, "added writes", &event.added_writes);
    push_resource_detail(&mut parts, "removed writes", &event.removed_writes);
    push_resource_detail(&mut parts, "added creates", &event.added_creates);
    push_resource_detail(&mut parts, "removed creates", &event.removed_creates);
    push_resource_detail(&mut parts, "added forbids", &event.added_forbids);
    push_resource_detail(&mut parts, "removed forbids", &event.removed_forbids);

    if parts.is_empty() {
        format!(
            "Wesley emitted {} with no additional payload",
            event.kind.as_str()
        )
    } else {
        parts.join("; ")
    }
}

fn push_resource_detail(parts: &mut Vec<String>, label: &'static str, values: &[String]) {
    if !values.is_empty() {
        parts.push(format!("{label}: {}", sorted_strings(values).join(", ")));
    }
}

fn subject_kind(subject: &str) -> Option<String> {
    subject.split_once(':').map(|(kind, _)| kind.to_owned())
}

fn sorted_strings(values: &[String]) -> Vec<String> {
    let mut values = values.to_vec();
    values.sort();
    values.dedup();
    values
}
