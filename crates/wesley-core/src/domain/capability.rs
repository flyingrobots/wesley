//! Rust-native module capability descriptors and host policy checks.
//!
//! This module intentionally models capability metadata and pre-execution
//! decisions only. It does not load dynamic modules, execute WASM, or preserve
//! the legacy Node module loader shape.

use std::{
    collections::{BTreeMap, BTreeSet},
    fmt,
};

/// Stable name of the first Wesley capability ABI.
pub const WESLEY_CAPABILITY_ABI: &str = "wesley-capability-abi";

/// Current capability ABI version supported by the Rust host policy layer.
pub const CURRENT_CAPABILITY_ABI_VERSION: CapabilityContractVersion =
    CapabilityContractVersion::new(0, 1, 0);

/// Semver-like capability contract version.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityContractVersion {
    /// Major version.
    pub major: u64,
    /// Minor version.
    pub minor: u64,
    /// Patch version.
    pub patch: u64,
}

impl CapabilityContractVersion {
    /// Builds a capability contract version.
    pub const fn new(major: u64, minor: u64, patch: u64) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}

impl fmt::Display for CapabilityContractVersion {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// Capability ABI version range required by a module target.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityVersionRequirement {
    /// Capability ABI name.
    pub abi: String,
    /// Inclusive minimum ABI version.
    pub minimum: CapabilityContractVersion,
    /// Exclusive maximum ABI version.
    pub maximum_exclusive: CapabilityContractVersion,
}

impl CapabilityVersionRequirement {
    /// Builds a capability ABI range.
    pub fn new(
        abi: impl Into<String>,
        minimum: CapabilityContractVersion,
        maximum_exclusive: CapabilityContractVersion,
    ) -> Self {
        Self {
            abi: abi.into(),
            minimum,
            maximum_exclusive,
        }
    }

    /// Returns the current first-profile compatibility range.
    pub fn current() -> Self {
        Self::new(
            WESLEY_CAPABILITY_ABI,
            CURRENT_CAPABILITY_ABI_VERSION,
            CapabilityContractVersion::new(0, 2, 0),
        )
    }

    /// Whether the named ABI version satisfies this range.
    pub fn allows(&self, abi: &str, version: CapabilityContractVersion) -> bool {
        self.abi == abi && self.minimum <= version && version < self.maximum_exclusive
    }
}

impl fmt::Display for CapabilityVersionRequirement {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} >={} <{}",
            self.abi, self.minimum, self.maximum_exclusive
        )
    }
}

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

/// Runtime state model declared by a module capability.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CapabilityRuntimeModel {
    /// Capability output must depend only on its explicit input envelope.
    #[default]
    Stateless,
    /// Capability requests explicit host-created resource handles.
    ResourceHandles,
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
    /// Capability ABI range required by this target.
    #[serde(default = "CapabilityVersionRequirement::current")]
    pub required_contract: CapabilityVersionRequirement,
    /// Runtime state model needed by this target.
    #[serde(default)]
    pub runtime_model: CapabilityRuntimeModel,
    /// Host imports requested by this target, using stable dotted import names.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub requested_host_imports: Vec<String>,
    /// Explicit resource handles requested by this target.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub requested_resource_handles: Vec<String>,
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

/// Host-side capability contract support.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostCapabilityContract {
    /// Host profile name.
    pub host: String,
    /// Supported capability ABI name.
    pub abi: String,
    /// Supported capability ABI version.
    pub version: CapabilityContractVersion,
}

impl HostCapabilityContract {
    /// Returns the current Rust host contract.
    pub fn current() -> Self {
        Self {
            host: "wesley-rust-host".to_string(),
            abi: WESLEY_CAPABILITY_ABI.to_string(),
            version: CURRENT_CAPABILITY_ABI_VERSION,
        }
    }

    /// Evaluates one target's capability contract against this host.
    pub fn evaluate_contract(&self, target: &ModuleTargetDescriptor) -> CapabilityContractReport {
        let mut diagnostics = Vec::new();

        if target.required_contract.abi != self.abi {
            diagnostics.push(CapabilityContractDiagnostic {
                code: "MODULE_CONTRACT_ABI_MISMATCH".to_string(),
                target: target.target.clone(),
                host: self.host.clone(),
                host_version: self.version.to_string(),
                required: target.required_contract.to_string(),
            });
        } else if !target.required_contract.allows(&self.abi, self.version) {
            diagnostics.push(CapabilityContractDiagnostic {
                code: "WASM_ABI_UNSUPPORTED".to_string(),
                target: target.target.clone(),
                host: self.host.clone(),
                host_version: self.version.to_string(),
                required: target.required_contract.to_string(),
            });
        }

        CapabilityContractReport {
            target: target.target.clone(),
            host: self.host.clone(),
            host_version: self.version.to_string(),
            required: target.required_contract.to_string(),
            accepted: diagnostics.is_empty(),
            diagnostics,
        }
    }

    /// Rejects a target before execution when the capability contract is incompatible.
    pub fn reject_incompatible_contract_before_execution(
        &self,
        target: &ModuleTargetDescriptor,
    ) -> Result<CapabilityContractReport, ModuleCapabilityError> {
        let report = self.evaluate_contract(target);
        if report.accepted {
            Ok(report)
        } else {
            Err(ModuleCapabilityError::IncompatibleCapabilityContract {
                target: target.target.clone(),
                diagnostic_codes: report
                    .diagnostics
                    .iter()
                    .map(|diagnostic| diagnostic.code.clone())
                    .collect(),
            })
        }
    }
}

/// Compatibility report for a target capability contract.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityContractReport {
    /// Target being evaluated.
    pub target: String,
    /// Host profile used for the decision.
    pub host: String,
    /// Host capability ABI version.
    pub host_version: String,
    /// Required capability ABI range.
    pub required: String,
    /// Whether the target can run under the host contract.
    pub accepted: bool,
    /// Typed compatibility diagnostics.
    pub diagnostics: Vec<CapabilityContractDiagnostic>,
}

/// Typed compatibility diagnostic emitted before execution.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityContractDiagnostic {
    /// Stable diagnostic code.
    pub code: String,
    /// Target that failed compatibility.
    pub target: String,
    /// Host profile used for the decision.
    pub host: String,
    /// Host capability ABI version.
    pub host_version: String,
    /// Required capability ABI range.
    pub required: String,
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

/// Runtime resource policy used before running a capability.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeResourcePolicy {
    model: CapabilityRuntimeModel,
    allowed_resource_handles: BTreeSet<String>,
}

impl RuntimeResourcePolicy {
    /// Returns the default stateless policy that denies all resource handles.
    pub fn stateless_default() -> Self {
        Self {
            model: CapabilityRuntimeModel::Stateless,
            allowed_resource_handles: BTreeSet::new(),
        }
    }

    /// Returns a future resource-handle profile with an explicit allowlist.
    pub fn allowing_resource_handles(handles: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            model: CapabilityRuntimeModel::ResourceHandles,
            allowed_resource_handles: handles.into_iter().map(Into::into).collect(),
        }
    }

    /// Evaluates a target's requested resource handles against this policy.
    pub fn evaluate(&self, target: &ModuleTargetDescriptor) -> RuntimeResourceReport {
        let requested = sorted_unique(&target.requested_resource_handles);
        let mut granted = Vec::new();
        let mut denied = Vec::new();

        for requested_handle in &requested {
            if self.model == CapabilityRuntimeModel::ResourceHandles
                && self.allowed_resource_handles.contains(requested_handle)
            {
                granted.push(requested_handle.clone());
            } else {
                denied.push(requested_handle.clone());
            }
        }

        RuntimeResourceReport {
            model: self.model,
            target: target.target.clone(),
            requested,
            granted,
            denied,
        }
    }

    /// Rejects a target before execution when required resource handles are unavailable.
    pub fn reject_resource_handles_before_execution(
        &self,
        target: &ModuleTargetDescriptor,
    ) -> Result<RuntimeResourceReport, ModuleCapabilityError> {
        let report = self.evaluate(target);
        if report.denied.is_empty() {
            Ok(report)
        } else {
            Err(ModuleCapabilityError::DeniedResourceHandles {
                target: target.target.clone(),
                denied: report.denied,
            })
        }
    }
}

/// Runtime resource policy report for one target.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeResourceReport {
    /// Runtime model used for the decision.
    pub model: CapabilityRuntimeModel,
    /// Target whose resource handles were evaluated.
    pub target: String,
    /// Resource handles requested by the target.
    pub requested: Vec<String>,
    /// Requested resource handles granted by policy.
    pub granted: Vec<String>,
    /// Requested resource handles denied by policy.
    pub denied: Vec<String>,
}

/// One deterministic host fixture for cross-host capability checks.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HermeticCapabilityFixture {
    /// Host profile that produced the fixture.
    pub host: String,
    /// Target capability under test.
    pub target: String,
    /// Canonical input envelope digest.
    pub input_digest: String,
    /// Canonical output envelope digest.
    pub output_digest: String,
}

impl HermeticCapabilityFixture {
    /// Builds a hermetic host fixture.
    pub fn new(
        host: impl Into<String>,
        target: impl Into<String>,
        input_digest: impl Into<String>,
        output_digest: impl Into<String>,
    ) -> Self {
        Self {
            host: host.into(),
            target: target.into(),
            input_digest: input_digest.into(),
            output_digest: output_digest.into(),
        }
    }

    /// Verifies that all fixtures for one target/input agree across hosts.
    pub fn verify_cross_host_outputs(
        fixtures: impl IntoIterator<Item = HermeticCapabilityFixture>,
    ) -> Result<HermeticCapabilityReport, ModuleCapabilityError> {
        let fixtures = fixtures.into_iter().collect::<Vec<_>>();
        let Some(first) = fixtures.first() else {
            return Err(ModuleCapabilityError::EmptyHermeticFixtures);
        };

        let target = first.target.clone();
        let input_digest = first.input_digest.clone();

        if fixtures
            .iter()
            .any(|fixture| fixture.target != target || fixture.input_digest != input_digest)
        {
            return Err(ModuleCapabilityError::MixedHermeticFixtureInputs);
        }

        let output_digests = fixtures
            .iter()
            .map(|fixture| fixture.output_digest.clone())
            .collect::<BTreeSet<_>>();

        if output_digests.len() != 1 {
            return Err(ModuleCapabilityError::NonHermeticCapabilityFixture {
                target,
                input_digest,
                output_digests: output_digests.into_iter().collect(),
            });
        }

        Ok(HermeticCapabilityReport {
            target,
            input_digest,
            output_digest: output_digests.into_iter().next().unwrap_or_default(),
            hosts: fixtures
                .iter()
                .map(|fixture| fixture.host.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        })
    }
}

/// Verified cross-host hermetic capability report.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HermeticCapabilityReport {
    /// Target capability under test.
    pub target: String,
    /// Canonical input envelope digest.
    pub input_digest: String,
    /// Shared canonical output envelope digest.
    pub output_digest: String,
    /// Host profiles that produced identical output.
    pub hosts: Vec<String>,
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
    /// A target requested an incompatible capability contract.
    #[error(
        "module target '{target}' requires incompatible capability contract: {}",
        diagnostic_codes.join(", ")
    )]
    IncompatibleCapabilityContract {
        /// Target with an incompatible contract.
        target: String,
        /// Diagnostic codes explaining the incompatibility.
        diagnostic_codes: Vec<String>,
    },
    /// A target requested unavailable resource handles.
    #[error(
        "module target '{target}' requested unavailable resource handles: {}",
        denied.join(", ")
    )]
    DeniedResourceHandles {
        /// Target that requested denied resource handles.
        target: String,
        /// Denied resource handle names.
        denied: Vec<String>,
    },
    /// No hermetic fixtures were provided.
    #[error("no hermetic capability fixtures were provided")]
    EmptyHermeticFixtures,
    /// Hermetic fixtures mixed targets or input digests.
    #[error("hermetic capability fixtures must use one target and input digest")]
    MixedHermeticFixtureInputs,
    /// Host fixtures produced different output digests for the same target/input.
    #[error("module target '{target}' is not hermetic for input {input_digest}")]
    NonHermeticCapabilityFixture {
        /// Target under test.
        target: String,
        /// Input digest under test.
        input_digest: String,
        /// Divergent output digests.
        output_digests: Vec<String>,
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
