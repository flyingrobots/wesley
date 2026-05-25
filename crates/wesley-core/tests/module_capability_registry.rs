use wesley_core::{
    CapabilityContractVersion, CapabilityExecutionMode, CapabilityPortabilityFloor,
    CapabilityRuntimeModel, CapabilityVersionRequirement, HermeticCapabilityFixture,
    HostCapabilityContract, HostFunctionPolicy, ModuleTargetDescriptor, ModuleTargetRegistry,
    RuntimeResourcePolicy,
};

#[test]
fn registry_reports_no_module_default_target_as_an_error() {
    let registry = ModuleTargetRegistry::default();
    let error = registry
        .resolve_target(None)
        .expect_err("empty registry should not resolve a default target");

    assert_eq!(
        error.to_string(),
        "no module targets are registered; load an external target module"
    );
}

#[test]
fn registry_resolves_default_and_explicit_targets() {
    let registry = ModuleTargetRegistry::from_targets(vec![
        ModuleTargetDescriptor {
            module: "alpha-module".to_string(),
            target: "alpha".to_string(),
            is_default: true,
            execution_mode: CapabilityExecutionMode::RustNative,
            portability_floor: CapabilityPortabilityFloor::HostNative,
            required_contract: CapabilityVersionRequirement::current(),
            runtime_model: CapabilityRuntimeModel::Stateless,
            requested_host_imports: Vec::new(),
            requested_resource_handles: Vec::new(),
        },
        ModuleTargetDescriptor {
            module: "beta-module".to_string(),
            target: "beta".to_string(),
            is_default: false,
            execution_mode: CapabilityExecutionMode::ExternalProcess,
            portability_floor: CapabilityPortabilityFloor::ExternalProcess,
            required_contract: CapabilityVersionRequirement::current(),
            runtime_model: CapabilityRuntimeModel::ResourceHandles,
            requested_host_imports: vec!["stdio".to_string()],
            requested_resource_handles: vec!["declared-session".to_string()],
        },
    ])
    .expect("targets should register");

    assert_eq!(registry.resolve_target(None).unwrap().target, "alpha");
    assert_eq!(
        registry
            .resolve_target(Some("beta"))
            .expect("explicit target should resolve")
            .module,
        "beta-module"
    );
}

#[test]
fn registry_rejects_duplicate_target_names() {
    let error = ModuleTargetRegistry::from_targets(vec![
        ModuleTargetDescriptor {
            module: "first".to_string(),
            target: "api".to_string(),
            is_default: false,
            execution_mode: CapabilityExecutionMode::RustNative,
            portability_floor: CapabilityPortabilityFloor::HostNative,
            required_contract: CapabilityVersionRequirement::current(),
            runtime_model: CapabilityRuntimeModel::Stateless,
            requested_host_imports: Vec::new(),
            requested_resource_handles: Vec::new(),
        },
        ModuleTargetDescriptor {
            module: "second".to_string(),
            target: "api".to_string(),
            is_default: false,
            execution_mode: CapabilityExecutionMode::RustNative,
            portability_floor: CapabilityPortabilityFloor::HostNative,
            required_contract: CapabilityVersionRequirement::current(),
            runtime_model: CapabilityRuntimeModel::Stateless,
            requested_host_imports: Vec::new(),
            requested_resource_handles: Vec::new(),
        },
    ])
    .expect_err("duplicate targets should fail");

    assert_eq!(
        error.to_string(),
        "duplicate module target 'api' from modules 'first' and 'second'"
    );
}

#[test]
fn registry_reports_requested_granted_and_denied_targets() {
    let registry = ModuleTargetRegistry::from_targets(vec![ModuleTargetDescriptor {
        module: "alpha-module".to_string(),
        target: "alpha".to_string(),
        is_default: true,
        execution_mode: CapabilityExecutionMode::Wasm,
        portability_floor: CapabilityPortabilityFloor::PortableWasm,
        required_contract: CapabilityVersionRequirement::current(),
        runtime_model: CapabilityRuntimeModel::Stateless,
        requested_host_imports: Vec::new(),
        requested_resource_handles: Vec::new(),
    }])
    .expect("target should register");

    let report = registry.capability_report(["alpha", "beta"]);

    assert_eq!(report.requested, vec!["alpha", "beta"]);
    assert_eq!(report.granted, vec!["alpha"]);
    assert_eq!(report.denied, vec!["beta"]);
}

#[test]
fn pure_wasm_host_policy_denies_ambient_imports_before_execution() {
    let policy = HostFunctionPolicy::pure();
    let target = ModuleTargetDescriptor {
        module: "clocked-wasm-module".to_string(),
        target: "clocked".to_string(),
        is_default: true,
        execution_mode: CapabilityExecutionMode::Wasm,
        portability_floor: CapabilityPortabilityFloor::PortableWasm,
        required_contract: CapabilityVersionRequirement::current(),
        runtime_model: CapabilityRuntimeModel::Stateless,
        requested_host_imports: vec!["clock.now".to_string()],
        requested_resource_handles: Vec::new(),
    };

    let report = policy.evaluate(&target);
    assert_eq!(report.requested, vec!["clock.now"]);
    assert_eq!(report.granted, Vec::<String>::new());
    assert_eq!(report.denied, vec!["clock.now"]);

    let error = policy
        .reject_unavailable_imports_before_execution(&target)
        .expect_err("unavailable host import should reject before execution");
    assert_eq!(
        error.to_string(),
        "module target 'clocked' requested unavailable host imports: clock.now"
    );
}

#[test]
fn host_contract_reports_incompatible_capability_abi_before_execution() {
    let host = HostCapabilityContract::current();
    let target = ModuleTargetDescriptor {
        module: "future-wasm-module".to_string(),
        target: "future-wasm".to_string(),
        is_default: true,
        execution_mode: CapabilityExecutionMode::Wasm,
        portability_floor: CapabilityPortabilityFloor::PortableWasm,
        required_contract: CapabilityVersionRequirement::new(
            "wesley-capability-abi",
            CapabilityContractVersion::new(0, 2, 0),
            CapabilityContractVersion::new(0, 3, 0),
        ),
        runtime_model: CapabilityRuntimeModel::Stateless,
        requested_host_imports: Vec::new(),
        requested_resource_handles: Vec::new(),
    };

    let report = host.evaluate_contract(&target);
    assert!(!report.accepted);
    assert_eq!(report.diagnostics.len(), 1);
    assert_eq!(report.diagnostics[0].code, "WASM_ABI_UNSUPPORTED");
    assert_eq!(report.diagnostics[0].target, "future-wasm");
    assert_eq!(report.diagnostics[0].host_version, "0.1.0");
    assert_eq!(
        report.diagnostics[0].required,
        "wesley-capability-abi >=0.2.0 <0.3.0"
    );

    let error = host
        .reject_incompatible_contract_before_execution(&target)
        .expect_err("future ABI requirements must reject before execution");
    assert_eq!(
        error.to_string(),
        "module target 'future-wasm' requires incompatible capability contract: WASM_ABI_UNSUPPORTED"
    );
}

#[test]
fn stateless_runtime_policy_rejects_future_resource_handles() {
    let policy = RuntimeResourcePolicy::stateless_default();
    let target = ModuleTargetDescriptor {
        module: "stateful-wasm-module".to_string(),
        target: "stateful-wasm".to_string(),
        is_default: true,
        execution_mode: CapabilityExecutionMode::Wasm,
        portability_floor: CapabilityPortabilityFloor::PortableWasm,
        required_contract: CapabilityVersionRequirement::current(),
        runtime_model: CapabilityRuntimeModel::ResourceHandles,
        requested_host_imports: Vec::new(),
        requested_resource_handles: vec!["content-cache".to_string()],
    };

    let report = policy.evaluate(&target);
    assert_eq!(report.model, CapabilityRuntimeModel::Stateless);
    assert_eq!(report.requested, vec!["content-cache"]);
    assert_eq!(report.denied, vec!["content-cache"]);

    let error = policy
        .reject_resource_handles_before_execution(&target)
        .expect_err("stateless default policy must reject resource handles");
    assert_eq!(
        error.to_string(),
        "module target 'stateful-wasm' requested unavailable resource handles: content-cache"
    );
}

#[test]
fn hermetic_cross_host_fixtures_accept_identical_outputs() {
    let fixtures = vec![
        HermeticCapabilityFixture::new(
            "rust-native",
            "portable-lower",
            "sha256:input",
            "sha256:output",
        ),
        HermeticCapabilityFixture::new("wasm", "portable-lower", "sha256:input", "sha256:output"),
        HermeticCapabilityFixture::new(
            "external-process",
            "portable-lower",
            "sha256:input",
            "sha256:output",
        ),
    ];

    let report = HermeticCapabilityFixture::verify_cross_host_outputs(fixtures)
        .expect("identical fixture outputs should verify");

    assert_eq!(report.target, "portable-lower");
    assert_eq!(
        report.hosts,
        vec!["external-process", "rust-native", "wasm"]
    );
    assert_eq!(report.output_digest, "sha256:output");
}

#[test]
fn hermetic_cross_host_fixtures_reject_host_specific_outputs() {
    let fixtures = vec![
        HermeticCapabilityFixture::new(
            "rust-native",
            "portable-lower",
            "sha256:input",
            "sha256:output-a",
        ),
        HermeticCapabilityFixture::new("wasm", "portable-lower", "sha256:input", "sha256:output-b"),
    ];

    let error = HermeticCapabilityFixture::verify_cross_host_outputs(fixtures)
        .expect_err("host-specific output digests should fail the hermetic fixture");

    assert_eq!(
        error.to_string(),
        "module target 'portable-lower' is not hermetic for input sha256:input"
    );
}
