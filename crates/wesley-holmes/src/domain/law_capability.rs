//! Typed Wesley law capability evidence accepted by Holmes.

use serde::{Deserialize, Serialize};

/// API version named by the Holmes PRD for law capability summaries.
pub const WESLEY_LAW_CAPABILITIES_API_VERSION: &str = "wesley.law-capabilities/v1";

/// Legacy API version accepted for pre-canonical capability report artifacts.
pub const WESLEY_LEGACY_CAPABILITY_REPORT_API_VERSION: &str = "wesley.capability-report/v1";

/// Machine-readable footprint capability summary emitted by Wesley.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCapabilityReport {
    /// Report API version.
    pub api_version: String,
    /// Whether the report is declaration-only and does not claim runtime enforcement.
    pub report_only: bool,
    /// Whether runtime enforcement evidence supports the reported posture.
    pub runtime_enforcement: bool,
    /// Human-readable note emitted by Wesley.
    pub note: String,
    /// Per-operation footprint summaries.
    pub footprints: Vec<LawCapabilityFootprint>,
}

impl LawCapabilityReport {
    /// Normalize operation capability rows for report sections and gates.
    pub fn normalized_operations(&self) -> Vec<NormalizedLawCapabilityOperation> {
        let mut operations = self
            .footprints
            .iter()
            .enumerate()
            .map(|(operation_index, footprint)| {
                footprint.normalized_operation(
                    operation_index,
                    self.report_only,
                    self.runtime_enforcement,
                )
            })
            .collect::<Vec<_>>();
        operations.sort_by(|left, right| {
            left.subject
                .cmp(&right.subject)
                .then_with(|| left.law_id.cmp(&right.law_id))
                .then_with(|| left.operation_index.cmp(&right.operation_index))
        });
        operations
    }
}

/// Operation footprint capability summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCapabilityFootprint {
    /// Stable law id that produced this summary.
    pub law_id: String,
    /// Operation subject coordinate.
    pub subject: String,
    /// Resource types read by the operation.
    #[serde(default)]
    pub reads: Vec<String>,
    /// Resource types written by the operation.
    #[serde(default)]
    pub writes: Vec<String>,
    /// Resource types created by the operation.
    #[serde(default)]
    pub creates: Vec<String>,
    /// Resource domains forbidden to the operation.
    #[serde(default)]
    pub forbids: Vec<String>,
    /// Bound input/resource slots when supplied by a richer artifact.
    #[serde(default)]
    pub slots: Vec<LawCapabilitySlot>,
    /// Closure-derived resource windows when supplied by a richer artifact.
    #[serde(default)]
    pub closures: Vec<LawCapabilityClosure>,
    /// Whether an otherwise empty footprint was intentionally authored.
    #[serde(default)]
    pub intentionally_empty: bool,
}

impl LawCapabilityFootprint {
    fn normalized_operation(
        &self,
        operation_index: usize,
        report_only: bool,
        runtime_enforcement: bool,
    ) -> NormalizedLawCapabilityOperation {
        NormalizedLawCapabilityOperation {
            operation_ref: format!("lawCapabilities.footprints[{operation_index}]"),
            operation_index,
            law_id: self.law_id.clone(),
            subject: self.subject.clone(),
            report_only,
            runtime_enforcement,
            wording_hint: wording_hint(report_only, runtime_enforcement).to_owned(),
            intentionally_empty: self.intentionally_empty,
            reads: sorted_strings(&self.reads),
            writes: sorted_strings(&self.writes),
            creates: sorted_strings(&self.creates),
            forbids: sorted_strings(&self.forbids),
            slots: sorted_slots(&self.slots),
            closures: sorted_closures(&self.closures),
        }
    }
}

/// Bound input/resource slot in a footprint summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCapabilitySlot {
    /// Slot name.
    pub name: String,
    /// Resource kind bound to the slot.
    pub kind: String,
    /// Argument path that binds the slot.
    pub bind_from_arg: String,
    /// Access modes granted for this slot.
    #[serde(default)]
    pub access: Vec<String>,
}

/// Closure-derived resource window in a footprint summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LawCapabilityClosure {
    /// Closure slot name.
    pub name: String,
    /// Source slot.
    pub from_slot: String,
    /// Closure operator id.
    pub operator: String,
    /// Argument bindings passed to the operator.
    #[serde(default)]
    pub arg_bindings: Vec<String>,
    /// Resource kinds read by the closure.
    #[serde(default)]
    pub reads: Vec<String>,
    /// Cardinality label.
    pub cardinality: String,
}

/// Normalized per-operation capability posture.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedLawCapabilityOperation {
    /// Stable operation reference inside the parsed capability report.
    pub operation_ref: String,
    /// Zero-based operation index in Wesley's emitted capability order.
    pub operation_index: usize,
    /// Stable law id that produced this summary.
    pub law_id: String,
    /// Operation subject coordinate.
    pub subject: String,
    /// Whether the summary is declaration-only.
    pub report_only: bool,
    /// Whether runtime enforcement evidence supports the reported posture.
    pub runtime_enforcement: bool,
    /// Renderer-facing wording constraint for the posture.
    pub wording_hint: String,
    /// Whether all empty resource groups were intentionally authored.
    pub intentionally_empty: bool,
    /// Resource types read by the operation.
    pub reads: Vec<String>,
    /// Resource types written by the operation.
    pub writes: Vec<String>,
    /// Resource types created by the operation.
    pub creates: Vec<String>,
    /// Resource domains forbidden to the operation.
    pub forbids: Vec<String>,
    /// Bound input/resource slots.
    pub slots: Vec<LawCapabilitySlot>,
    /// Closure-derived resource windows.
    pub closures: Vec<LawCapabilityClosure>,
}

fn wording_hint(report_only: bool, runtime_enforcement: bool) -> &'static str {
    if runtime_enforcement {
        "runtime enforcement evidence present"
    } else if report_only {
        "report-only footprint declaration; do not imply runtime enforcement"
    } else {
        "capability posture is explicitly not marked report-only"
    }
}

fn sorted_strings(values: &[String]) -> Vec<String> {
    let mut values = values.to_vec();
    values.sort();
    values.dedup();
    values
}

fn sorted_slots(slots: &[LawCapabilitySlot]) -> Vec<LawCapabilitySlot> {
    let mut slots = slots.to_vec();
    slots.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| left.kind.cmp(&right.kind))
            .then_with(|| left.bind_from_arg.cmp(&right.bind_from_arg))
    });
    for slot in &mut slots {
        slot.access = sorted_strings(&slot.access);
    }
    slots
}

fn sorted_closures(closures: &[LawCapabilityClosure]) -> Vec<LawCapabilityClosure> {
    let mut closures = closures.to_vec();
    closures.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| left.from_slot.cmp(&right.from_slot))
            .then_with(|| left.operator.cmp(&right.operator))
    });
    for closure in &mut closures {
        closure.arg_bindings = sorted_strings(&closure.arg_bindings);
        closure.reads = sorted_strings(&closure.reads);
    }
    closures
}
