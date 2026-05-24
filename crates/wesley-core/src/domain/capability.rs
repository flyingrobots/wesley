//! Rust-native module capability descriptors and host policy checks.
//!
//! This module intentionally models capability metadata and pre-execution
//! decisions only. It does not load dynamic modules, execute WASM, or preserve
//! the legacy Node module loader shape.

use std::collections::{BTreeMap, BTreeSet};

/// Execution mode declared by a module capability.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CapabilityExecutionMode {
    /// Capability is implemented in Rust and runs in the native host.
    RustNative,
    /// Capability is implemented as a portable WASM component.
    Wasm,
    /// Capability runs through an explicit external process protocol.
    ExternalProcess,
}

/// Minimum portability floor promised by a module capability.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CapabilityPortabilityFloor {
    /// Capability is only expected to run in the current native host.
    HostNative,
    /// Capability is portable across hosts that implement the WASM ABI profile.
    PortableWasm,
    /// Capability requires an external process protocol and is not in-process.
    ExternalProcess,
}

/// Module-provided target capability metadata.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleTargetDescriptor {
    /// Name of the module that contributes the target.
    pub module: String,
    /// Stable target name selected by `wesley compile` or a future Rust verb.
    pub target: String,
    /// Whether this target is the default target when no explicit target is requested.
    pub is_default: bool,
    /// Execution mode needed to run this target capability.
    pub execution_mode: CapabilityExecutionMode,
    /// Minimum portability floor promised by this target capability.
    pub portability_floor: CapabilityPortabilityFloor,
    /// Host imports requested by this target, using stable dotted import names.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub requested_host_imports: Vec<String>,
}

/// Deterministic module target registry for Rust-native dispatch planning.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct ModuleTargetRegistry {
    targets: BTreeMap<String, ModuleTargetDescriptor>,
}

impl ModuleTargetRegistry {
    /// Builds a registry from module target descriptors.
    pub fn from_targets(
        targets: impl IntoIterator<Item = ModuleTargetDescriptor>,
    ) -> Result<Self, ModuleCapabilityError> {
        let mut registry = Self::default();
        for target in targets {
            registry.register(target)?;
        }

        Ok(registry)
    }

    /// Registers one target descriptor.
    pub fn register(
        &mut self,
        target: ModuleTargetDescriptor,
    ) -> Result<(), ModuleCapabilityError> {
        if let Some(existing) = self.targets.get(&target.target) {
            return Err(ModuleCapabilityError::DuplicateTarget {
                target: target.target,
                first_module: existing.module.clone(),
                second_module: target.module,
            });
        }

        self.targets.insert(target.target.clone(), target);
        Ok(())
    }

    /// Resolves an explicit target, or the single default target when none is requested.
    pub fn resolve_target(
        &self,
        requested: Option<&str>,
    ) -> Result<&ModuleTargetDescriptor, ModuleCapabilityError> {
        if self.targets.is_empty() {
            return Err(ModuleCapabilityError::NoTargets);
        }

        if let Some(requested) = requested {
            return self.targets.get(requested).ok_or_else(|| {
                ModuleCapabilityError::UnknownTarget {
                    target: requested.to_string(),
                    available: self.targets.keys().cloned().collect(),
                }
            });
        }

        let defaults = self
            .targets
            .values()
            .filter(|target| target.is_default)
            .collect::<Vec<_>>();

        match defaults.as_slice() {
            [target] => Ok(target),
            [] => Err(ModuleCapabilityError::NoDefaultTarget {
                available: self.targets.keys().cloned().collect(),
            }),
            targets => Err(ModuleCapabilityError::MultipleDefaultTargets {
                targets: targets.iter().map(|target| target.target.clone()).collect(),
            }),
        }
    }

    /// Builds a report that names requested, granted, and denied target capabilities.
    pub fn capability_report(
        &self,
        requested: impl IntoIterator<Item = impl AsRef<str>>,
    ) -> CapabilityReport {
        let mut requested_targets = Vec::new();
        let mut granted = Vec::new();
        let mut denied = Vec::new();

        for target in requested {
            let target = target.as_ref().to_string();
            requested_targets.push(target.clone());
            if self.targets.contains_key(&target) {
                granted.push(target);
            } else {
                denied.push(target);
            }
        }

        CapabilityReport {
            requested: requested_targets,
            granted,
            denied,
        }
    }
}

/// Requested/granted/denied capability report.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityReport {
    /// Capabilities requested by the caller.
    pub requested: Vec<String>,
    /// Requested capabilities the registry can grant.
    pub granted: Vec<String>,
    /// Requested capabilities absent from the registry.
    pub denied: Vec<String>,
}

/// Host function policy used before running a WASM capability.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostFunctionPolicy {
    profile: String,
    allowed_imports: BTreeSet<String>,
}

impl HostFunctionPolicy {
    /// Returns the default pure profile that denies all ambient host imports.
    pub fn pure() -> Self {
        Self {
            profile: "pure".to_string(),
            allowed_imports: BTreeSet::new(),
        }
    }

    /// Returns a profile with an explicit allowlist of host imports.
    pub fn allowing(
        profile: impl Into<String>,
        imports: impl IntoIterator<Item = impl Into<String>>,
    ) -> Self {
        Self {
            profile: profile.into(),
            allowed_imports: imports.into_iter().map(Into::into).collect(),
        }
    }

    /// Evaluates a target's requested host imports against this policy.
    pub fn evaluate(&self, target: &ModuleTargetDescriptor) -> HostImportReport {
        let requested = sorted_unique(&target.requested_host_imports);
        let mut granted = Vec::new();
        let mut denied = Vec::new();

        for requested_import in &requested {
            if self.allowed_imports.contains(requested_import) {
                granted.push(requested_import.clone());
            } else {
                denied.push(requested_import.clone());
            }
        }

        HostImportReport {
            profile: self.profile.clone(),
            target: target.target.clone(),
            requested,
            granted,
            denied,
        }
    }

    /// Rejects a target before execution when required host imports are unavailable.
    pub fn reject_unavailable_imports_before_execution(
        &self,
        target: &ModuleTargetDescriptor,
    ) -> Result<HostImportReport, ModuleCapabilityError> {
        let report = self.evaluate(target);
        if report.denied.is_empty() {
            Ok(report)
        } else {
            Err(ModuleCapabilityError::DeniedHostImports {
                target: target.target.clone(),
                denied: report.denied,
            })
        }
    }
}

/// Host import policy report for one target.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostImportReport {
    /// Host policy profile used for the decision.
    pub profile: String,
    /// Target whose imports were evaluated.
    pub target: String,
    /// Host imports requested by the target.
    pub requested: Vec<String>,
    /// Requested imports granted by policy.
    pub granted: Vec<String>,
    /// Requested imports denied by policy.
    pub denied: Vec<String>,
}

/// Module capability registry and host policy errors.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ModuleCapabilityError {
    /// No module targets are registered.
    #[error("no module targets are registered; load an external target module")]
    NoTargets,
    /// Two modules contributed the same target name.
    #[error(
        "duplicate module target '{target}' from modules '{first_module}' and '{second_module}'"
    )]
    DuplicateTarget {
        /// Duplicate target name.
        target: String,
        /// Module that registered the target first.
        first_module: String,
        /// Module that attempted to register the duplicate target.
        second_module: String,
    },
    /// Requested target is absent from the registry.
    #[error("unknown module target '{target}'; available targets: {}", available.join(", "))]
    UnknownTarget {
        /// Requested target name.
        target: String,
        /// Available target names.
        available: Vec<String>,
    },
    /// No target is marked as default.
    #[error("no default module target is registered; available targets: {}", available.join(", "))]
    NoDefaultTarget {
        /// Available target names.
        available: Vec<String>,
    },
    /// More than one target is marked as default.
    #[error("multiple default module targets are registered: {}", targets.join(", "))]
    MultipleDefaultTargets {
        /// Target names marked as default.
        targets: Vec<String>,
    },
    /// A target requested unavailable host imports.
    #[error("module target '{target}' requested unavailable host imports: {}", denied.join(", "))]
    DeniedHostImports {
        /// Target that requested denied imports.
        target: String,
        /// Denied host import names.
        denied: Vec<String>,
    },
}

fn sorted_unique(values: &[String]) -> Vec<String> {
    values
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}
