use wesley_core::{
    CapabilityExecutionMode, CapabilityPortabilityFloor, HostFunctionPolicy,
    ModuleTargetDescriptor, ModuleTargetRegistry,
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
            requested_host_imports: Vec::new(),
        },
        ModuleTargetDescriptor {
            module: "beta-module".to_string(),
            target: "beta".to_string(),
            is_default: false,
            execution_mode: CapabilityExecutionMode::ExternalProcess,
            portability_floor: CapabilityPortabilityFloor::ExternalProcess,
            requested_host_imports: vec!["stdio".to_string()],
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
            requested_host_imports: Vec::new(),
        },
        ModuleTargetDescriptor {
            module: "second".to_string(),
            target: "api".to_string(),
            is_default: false,
            execution_mode: CapabilityExecutionMode::RustNative,
            portability_floor: CapabilityPortabilityFloor::HostNative,
            requested_host_imports: Vec::new(),
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
        requested_host_imports: Vec::new(),
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
        requested_host_imports: vec!["clock.now".to_string()],
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
