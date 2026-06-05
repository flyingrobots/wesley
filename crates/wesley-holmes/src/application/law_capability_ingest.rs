//! JSON ingest boundary for Wesley law capability artifacts.

use std::collections::BTreeSet;

use serde::Deserialize;

use crate::domain::{
    HolmesDiagnostic, HolmesDiagnosticCode, HolmesSeverity, LawCapabilityClosure,
    LawCapabilityFootprint, LawCapabilityReport, LawCapabilitySlot,
    WESLEY_LAW_CAPABILITIES_API_VERSION, WESLEY_LEGACY_CAPABILITY_REPORT_API_VERSION,
};

/// Validation status for law capability ingest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LawCapabilityIngestStatus {
    /// Law capability JSON was accepted and normalized into a typed report.
    Valid,
    /// Law capability JSON was rejected before Holmes assessment.
    Invalid,
}

/// Result of ingesting a Wesley law capability artifact.
#[derive(Debug, Clone, PartialEq)]
pub struct LawCapabilityIngestResult {
    /// Ingest status.
    pub status: LawCapabilityIngestStatus,
    /// Deterministically ordered ingest diagnostics.
    pub diagnostics: Vec<HolmesDiagnostic>,
    /// Parsed law capability report when ingest succeeded.
    pub report: Option<LawCapabilityReport>,
}

impl LawCapabilityIngestResult {
    fn valid(report: LawCapabilityReport) -> Self {
        Self {
            status: LawCapabilityIngestStatus::Valid,
            diagnostics: Vec::new(),
            report: Some(report),
        }
    }

    fn invalid(diagnostics: Vec<HolmesDiagnostic>) -> Self {
        Self {
            status: LawCapabilityIngestStatus::Invalid,
            diagnostics,
            report: None,
        }
    }
}

/// Input port for Wesley law capability JSON artifacts.
pub trait LawCapabilityIngestPort {
    /// Ingest raw law capability bytes into a typed Holmes report boundary.
    fn ingest_law_capabilities(&self, bytes: &[u8]) -> LawCapabilityIngestResult;
}

/// JSON implementation of the law capability ingest port.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct JsonLawCapabilityIngestPort;

impl LawCapabilityIngestPort for JsonLawCapabilityIngestPort {
    fn ingest_law_capabilities(&self, bytes: &[u8]) -> LawCapabilityIngestResult {
        let raw = match serde_json::from_slice::<RawLawCapabilityReport>(bytes) {
            Ok(raw) => raw,
            Err(err) => {
                return LawCapabilityIngestResult::invalid(vec![HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCapabilityMalformedJson,
                    HolmesSeverity::Error,
                    format!("law capability artifact is not valid JSON: {err}"),
                )
                .for_family("law-capabilities")]);
            }
        };

        let mut diagnostics = Vec::new();
        if raw.api_version != WESLEY_LAW_CAPABILITIES_API_VERSION
            && raw.api_version != WESLEY_LEGACY_CAPABILITY_REPORT_API_VERSION
        {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCapabilityUnsupportedVersion,
                    HolmesSeverity::Error,
                    format!(
                        "unsupported law capability apiVersion {}; expected {}",
                        raw.api_version, WESLEY_LAW_CAPABILITIES_API_VERSION
                    ),
                )
                .for_family("law-capabilities")
                .at_field("apiVersion"),
            );
        }

        let Some(report_only) = raw.report_only else {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCapabilityMissingPosture,
                    HolmesSeverity::Error,
                    "law capability artifact must explicitly set reportOnly",
                )
                .for_family("law-capabilities")
                .at_field("reportOnly"),
            );
            return LawCapabilityIngestResult::invalid(diagnostics);
        };
        let Some(runtime_enforcement) = raw.runtime_enforcement else {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCapabilityMissingPosture,
                    HolmesSeverity::Error,
                    "law capability artifact must explicitly set runtimeEnforcement",
                )
                .for_family("law-capabilities")
                .at_field("runtimeEnforcement"),
            );
            return LawCapabilityIngestResult::invalid(diagnostics);
        };

        if report_only && runtime_enforcement {
            diagnostics.push(
                HolmesDiagnostic::new(
                    HolmesDiagnosticCode::HlawCapabilityMissingPosture,
                    HolmesSeverity::Error,
                    "law capability artifact cannot claim reportOnly and runtimeEnforcement without separate enforcement evidence",
                )
                .for_family("law-capabilities")
                .at_field("runtimeEnforcement"),
            );
        }

        let footprints = raw
            .footprints
            .into_iter()
            .enumerate()
            .map(|(index, footprint)| {
                validate_footprint(index, &footprint, &mut diagnostics);
                LawCapabilityFootprint {
                    law_id: footprint.law_id,
                    subject: footprint.subject,
                    reads: footprint.reads,
                    writes: footprint.writes,
                    creates: footprint.creates,
                    forbids: footprint.forbids,
                    slots: footprint.slots,
                    closures: footprint.closures,
                    intentionally_empty: footprint.intentionally_empty,
                }
            })
            .collect::<Vec<_>>();

        if diagnostics.is_empty() {
            LawCapabilityIngestResult::valid(LawCapabilityReport {
                api_version: WESLEY_LAW_CAPABILITIES_API_VERSION.to_owned(),
                report_only,
                runtime_enforcement,
                note: raw.note.unwrap_or_default(),
                footprints,
            })
        } else {
            LawCapabilityIngestResult::invalid(diagnostics)
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawLawCapabilityReport {
    api_version: String,
    #[serde(default)]
    report_only: Option<bool>,
    #[serde(default)]
    runtime_enforcement: Option<bool>,
    #[serde(default)]
    note: Option<String>,
    #[serde(default)]
    footprints: Vec<RawLawCapabilityFootprint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawLawCapabilityFootprint {
    law_id: String,
    subject: String,
    #[serde(default)]
    reads: Vec<String>,
    #[serde(default)]
    writes: Vec<String>,
    #[serde(default)]
    creates: Vec<String>,
    #[serde(default)]
    forbids: Vec<String>,
    #[serde(default)]
    slots: Vec<LawCapabilitySlot>,
    #[serde(default)]
    closures: Vec<LawCapabilityClosure>,
    #[serde(default)]
    intentionally_empty: bool,
}

fn validate_footprint(
    index: usize,
    footprint: &RawLawCapabilityFootprint,
    diagnostics: &mut Vec<HolmesDiagnostic>,
) {
    if footprint.law_id.trim().is_empty() {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCapabilityMalformedJson,
                HolmesSeverity::Error,
                "law capability footprint lawId must not be blank",
            )
            .for_family("law-capabilities")
            .at_field(format!("footprints[{index}].lawId")),
        );
    }
    if footprint.subject.trim().is_empty() {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCapabilityMalformedJson,
                HolmesSeverity::Error,
                "law capability footprint subject must not be blank",
            )
            .for_family("law-capabilities")
            .at_field(format!("footprints[{index}].subject")),
        );
    }

    let forbids = footprint
        .forbids
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    for (field, resources) in [
        ("reads", &footprint.reads),
        ("writes", &footprint.writes),
        ("creates", &footprint.creates),
    ] {
        reject_forbidden_resource_overlaps(
            field,
            resources,
            &forbids,
            diagnostics,
            format!("footprints[{index}].{field}"),
        );
    }

    for (slot_index, slot) in footprint.slots.iter().enumerate() {
        if forbids.contains(slot.kind.as_str()) {
            diagnostics.push(contradictory_resource_diagnostic(
                "slot kind",
                &slot.kind,
                format!("footprints[{index}].slots[{slot_index}].kind"),
            ));
        }
    }

    for (closure_index, closure) in footprint.closures.iter().enumerate() {
        reject_forbidden_resource_overlaps(
            "closure reads",
            &closure.reads,
            &forbids,
            diagnostics,
            format!("footprints[{index}].closures[{closure_index}].reads"),
        );
    }

    let has_resource_posture = !footprint.reads.is_empty()
        || !footprint.writes.is_empty()
        || !footprint.creates.is_empty()
        || !footprint.forbids.is_empty()
        || !footprint.slots.is_empty()
        || !footprint.closures.is_empty();
    if !has_resource_posture && !footprint.intentionally_empty {
        diagnostics.push(
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawCapabilityImplicitEmptyFootprint,
                HolmesSeverity::Error,
                "law capability footprint with no resources must set intentionallyEmpty",
            )
            .for_family("law-capabilities")
            .at_field(format!("footprints[{index}]")),
        );
    }
}

fn reject_forbidden_resource_overlaps(
    field: &str,
    resources: &[String],
    forbids: &BTreeSet<&str>,
    diagnostics: &mut Vec<HolmesDiagnostic>,
    field_path: String,
) {
    for resource in resources {
        if forbids.contains(resource.as_str()) {
            diagnostics.push(contradictory_resource_diagnostic(
                field,
                resource,
                field_path.clone(),
            ));
        }
    }
}

fn contradictory_resource_diagnostic(
    field: &str,
    resource: &str,
    field_path: String,
) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawCapabilityContradictoryResourcePosture,
        HolmesSeverity::Error,
        format!("law capability resource {resource:?} appears in both {field} and forbids"),
    )
    .for_family("law-capabilities")
    .at_field(field_path)
}
