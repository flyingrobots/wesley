use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn help_exits_zero_without_footprint_command() {
    let output = wesley().arg("--help").output().expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("Wesley native CLI"));
    assert!(stdout.contains("normalize-sdl"));
    assert!(stdout.contains("schema lower"));
    assert!(stdout.contains("schema operations"));
    assert!(stdout.contains("schema diff"));
    assert!(stdout.contains("config validate"));
    assert!(stdout.contains("config changed-schemas"));
    assert!(stdout.contains("target verify"));
    assert!(stdout.contains("doctor"));
    assert!(stdout.contains("emit rust"));
    assert!(stdout.contains("emit typescript"));
    assert!(stdout.contains("emit le-binary-typescript"));
    assert!(stdout.contains("operation selections"));
    assert!(!stdout.contains("check-footprint"));
    assert!(!stdout.contains("init-law"));
    assert!(!stdout.contains("law validate"));
}

#[test]
fn target_verify_accepts_descriptor_without_execution() {
    let dir = temp_dir("target-verify-valid");
    let descriptor = dir.join("target-descriptor.json");
    std::fs::write(
        &descriptor,
        valid_target_descriptor_json("./bin/hello-wesley-target"),
    )
    .expect("descriptor should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["target", "verify"])
        .arg("target-descriptor.json")
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["valid"], true);
    assert_eq!(report["descriptor"]["name"], "hello-wesley-target");
    assert_eq!(
        report["descriptor"]["apiVersion"],
        "wesley.target-descriptor/v1"
    );
    assert_eq!(report["diagnostics"].as_array().unwrap().len(), 0);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn target_verify_does_not_execute_descriptor_program() {
    let dir = temp_dir("target-verify-no-exec");
    let bin_dir = dir.join("bin");
    std::fs::create_dir_all(&bin_dir).expect("bin dir should create");
    let marker = dir.join("should-not-exist");
    let program = bin_dir.join("hello-wesley-target");
    std::fs::write(&program, format!("#!/bin/sh\ntouch {}\n", marker.display()))
        .expect("program should write");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = std::fs::metadata(&program)
            .expect("program metadata should read")
            .permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&program, permissions).expect("program mode should update");
    }
    let descriptor = dir.join("target-descriptor.json");
    std::fs::write(
        &descriptor,
        valid_target_descriptor_json("./bin/hello-wesley-target"),
    )
    .expect("descriptor should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["target", "verify", "target-descriptor.json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    assert!(
        !marker.exists(),
        "target verify must not execute descriptor command programs"
    );

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn target_verify_reports_deterministic_diagnostics_for_unsafe_descriptor() {
    let dir = temp_dir("target-verify-unsafe");
    let descriptor = dir.join("target-descriptor.json");
    std::fs::write(
        &descriptor,
        r#"
{
  "apiVersion": "wesley.target-descriptor/v1",
  "name": "../not-safe",
  "protocol": {
    "kind": "shell",
    "version": "wesley.target-process/v2"
  },
  "command": {
    "program": "hello-wesley-target",
    "args": ["--request-stdin"]
  },
  "execution": {
    "timeoutMs": 0
  },
  "capabilities": {
    "inputs": [],
    "outputs": [],
    "requiresNetwork": true,
    "requiresAmbientFilesystem": true
  },
  "outputs": {
    "defaultOutDir": "../generated"
  }
}
"#,
    )
    .expect("descriptor should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["target", "verify", "target-descriptor.json", "--json"])
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["valid"], false);
    let codes = report["diagnostics"]
        .as_array()
        .expect("diagnostics should be an array")
        .iter()
        .map(|diagnostic| diagnostic["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert!(codes.contains(&"target.name.path_unsafe"));
    assert!(codes.contains(&"target.protocol.kind_unsupported"));
    assert!(codes.contains(&"target.protocol.version_unsupported"));
    assert!(codes.contains(&"target.command.program_bare"));
    assert!(codes.contains(&"target.execution.timeout_out_of_range"));
    assert!(codes.contains(&"target.capability.input_missing"));
    assert!(codes.contains(&"target.capability.output_missing"));
    assert!(codes.contains(&"target.capability.network_denied"));
    assert!(codes.contains(&"target.capability.ambient_filesystem_denied"));
    assert!(codes.contains(&"target.output.default_dir_unsafe"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn target_verify_rejects_windows_drive_like_paths() {
    let dir = temp_dir("target-verify-windows-drive");
    let descriptor = dir.join("target-descriptor.json");
    std::fs::write(
        &descriptor,
        r#"
{
  "apiVersion": "wesley.target-descriptor/v1",
  "name": "hello:target",
  "protocol": {
    "kind": "external-process",
    "version": "wesley.target-process/v1"
  },
  "command": {
    "program": "C:/tools/hello-wesley-target",
    "args": ["--request-stdin"]
  },
  "execution": {
    "timeoutMs": 30000
  },
  "capabilities": {
    "inputs": ["wesley.l1-ir/v1"],
    "outputs": ["wesley.target-artifact-manifest/v1"],
    "requiresNetwork": false,
    "requiresAmbientFilesystem": false
  },
  "outputs": {
    "defaultOutDir": "C:/generated"
  }
}
"#,
    )
    .expect("descriptor should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["target", "verify", "target-descriptor.json", "--json"])
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    let codes = report["diagnostics"]
        .as_array()
        .expect("diagnostics should be an array")
        .iter()
        .map(|diagnostic| diagnostic["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert!(codes.contains(&"target.name.path_unsafe"));
    assert!(codes.contains(&"target.command.program_unsafe"));
    assert!(codes.contains(&"target.output.default_dir_unsafe"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn target_verify_reports_descriptor_parse_errors() {
    let dir = temp_dir("target-verify-malformed");
    let descriptor = dir.join("target-descriptor.json");
    std::fs::write(&descriptor, "{").expect("descriptor should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["target", "verify", "target-descriptor.json", "--json"])
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    assert!(
        output.stdout.is_empty(),
        "malformed descriptor input must not emit a validation report"
    );
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stderr.contains("failed to parse target descriptor"));
    assert!(stderr.contains("target-descriptor.json"));
    assert!(!stderr.contains("failed to serialize JSON output"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn config_validate_and_changed_schemas_emit_domain_free_manifest_reports() {
    let dir = temp_dir("config-manifest");
    std::fs::create_dir_all(dir.join("schemas/core")).expect("schema dir should create");
    std::fs::create_dir_all(dir.join("schemas/audit")).expect("schema dir should create");
    std::fs::write(
        dir.join("schemas/core/schema.graphql"),
        "type Query { core: String }\n",
    )
    .expect("core schema should write");
    std::fs::write(
        dir.join("schemas/audit/schema.graphql"),
        "type Query { audit: String }\n",
    )
    .expect("audit schema should write");
    let config = dir.join("wesley.config.json");
    std::fs::write(
        &config,
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": [
            {
              "id": "core",
              "path": "schemas/core/schema.graphql",
              "rebuildOnGlobs": ["schemas/core/**"]
            },
            {
              "id": "audit",
              "path": "schemas/audit/schema.graphql",
              "rebuildOnGlobs": ["schemas/audit/**"]
            }
          ],
          "targets": [
            {
              "name": "rust-models",
              "module": "wesley.emit.rust",
              "exclusiveGroup": "model-emitter",
              "default": true
            }
          ]
        }
        "#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["config", "validate", "--config"])
        .arg("wesley.config.json")
        .arg("--json")
        .output()
        .expect("wesley should run");
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["valid"], true);
    assert_eq!(
        report["manifest"]["schemaPaths"].as_array().unwrap().len(),
        2
    );

    let output = wesley()
        .current_dir(&dir)
        .args(["config", "changed-schemas", "--config"])
        .arg("wesley.config.json")
        .args(["--changed", "schemas/core/types.graphql", "--json"])
        .output()
        .expect("wesley should run");
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["selectedSchemaPaths"].as_array().unwrap().len(), 1);
    assert_eq!(report["selectedSchemaPaths"][0]["id"], "core");
    assert_eq!(
        report["selectedSchemaPaths"][0]["bundleDir"],
        ".wesley-cache/core"
    );
    assert!(report["selectedSchemaPaths"][0]["reason"]
        .as_str()
        .unwrap()
        .contains("schemas/core/**"));
}

#[test]
fn config_yaml_manifest_changed_schemas_selects_matching_schema() {
    let dir = temp_dir("config-yaml-manifest");
    std::fs::create_dir_all(dir.join("schemas/core")).expect("core schema dir should create");
    std::fs::create_dir_all(dir.join("schemas/audit")).expect("audit schema dir should create");
    std::fs::write(
        dir.join("schemas/core/schema.graphql"),
        "type Query { core: String }\n",
    )
    .expect("core schema should write");
    std::fs::write(
        dir.join("schemas/audit/schema.graphql"),
        "type Query { audit: String }\n",
    )
    .expect("audit schema should write");
    let config = dir.join("wesley.config.yaml");
    std::fs::write(
        &config,
        r#"
apiVersion: wesley.project-manifest/v1
schemaPaths:
  - id: core
    path: schemas/core/schema.graphql
    rebuildOnGlobs:
      - schemas/core/**
  - id: audit
    path: schemas/audit/schema.graphql
    rebuildOnGlobs:
      - schemas/audit/**
targets:
  - name: rust-models
    module: wesley.emit.rust
    exclusiveGroup: model-emitter
    default: true
"#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["config", "validate", "--config"])
        .arg("wesley.config.yaml")
        .arg("--json")
        .output()
        .expect("wesley should run");
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["valid"], true);
    assert_eq!(
        report["manifest"]["schemaPaths"].as_array().unwrap().len(),
        2
    );

    let output = wesley()
        .current_dir(&dir)
        .args(["config", "changed-schemas", "--config"])
        .arg("wesley.config.yaml")
        .args(["--changed", "schemas/audit/types.graphql", "--json"])
        .output()
        .expect("wesley should run");
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["selectedSchemaPaths"].as_array().unwrap().len(), 1);
    assert_eq!(report["selectedSchemaPaths"][0]["id"], "audit");
    assert_eq!(
        report["selectedSchemaPaths"][0]["path"],
        "schemas/audit/schema.graphql"
    );
    assert!(report["selectedSchemaPaths"][0]["reason"]
        .as_str()
        .unwrap()
        .contains("schemas/audit/**"));
}

#[test]
fn config_changed_schemas_resolves_manifest_relative_paths_before_selection() {
    let dir = temp_dir("config-manifest-relative");
    let project_dir = dir.join("project");
    std::fs::create_dir_all(project_dir.join("schema")).expect("schema dir should create");
    std::fs::write(
        project_dir.join("schema/schema.graphql"),
        "type Query { nested: String }\n",
    )
    .expect("schema should write");
    let config = project_dir.join("wesley.config.json");
    std::fs::write(
        &config,
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": [
            {
              "id": "nested",
              "path": "schema/schema.graphql",
              "rebuildOnGlobs": ["schema/**"]
            }
          ],
          "bundleDir": ".cache"
        }
        "#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["config", "changed-schemas", "--config"])
        .arg("project/wesley.config.json")
        .args(["--changed", "project/schema/types.graphql", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["selectedSchemaPaths"].as_array().unwrap().len(), 1);
    assert_eq!(report["selectedSchemaPaths"][0]["id"], "nested");
    assert_eq!(
        report["selectedSchemaPaths"][0]["path"],
        "project/schema/schema.graphql"
    );
    assert_eq!(
        report["selectedSchemaPaths"][0]["bundleDir"],
        "project/.cache"
    );
    assert!(report["selectedSchemaPaths"][0]["reason"]
        .as_str()
        .unwrap()
        .contains("project/schema/**"));
}

#[test]
fn schema_commands_discover_single_schema_manifest_when_schema_flag_is_omitted() {
    let dir = temp_dir("config-discovery");
    std::fs::create_dir_all(dir.join("schema")).expect("schema dir should create");
    std::fs::write(
        dir.join("schema/schema.graphql"),
        "type Query { health: Boolean }\n",
    )
    .expect("schema should write");
    std::fs::write(
        dir.join("wesley.config.json"),
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": ["schema/schema.graphql"]
        }
        "#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["schema", "hash", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert!(report["schemaHash"].as_str().unwrap().len() == 64);
}

#[test]
fn schema_lower_reports_missing_schema_path() {
    let dir = temp_dir("missing-schema-path");
    let missing_schema = dir.join("missing-schema.graphql");

    let output = wesley()
        .args(["schema", "lower", "--schema"])
        .arg(&missing_schema)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stdout.is_empty());
    assert!(stderr.contains("failed to access schema"));
    assert!(stderr.contains("missing-schema.graphql"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn removed_footprint_checker_is_not_a_wesley_command() {
    let output = wesley()
        .arg("check-footprint")
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(2));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stdout.is_empty());
    assert!(stderr.contains("unknown command 'check-footprint'"));
}

#[test]
fn removed_weslaw_commands_are_not_wesley_commands() {
    for command in ["law", "init-law"] {
        let output = wesley().arg(command).output().expect("wesley should run");

        assert_eq!(
            output.status.code(),
            Some(2),
            "{command} must be rejected as an unsupported command"
        );
        let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
        let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
        assert!(stdout.is_empty());
        assert!(stderr.contains(&format!("unknown command '{command}'")));
    }

    let output = wesley()
        .args(["emit", "rust", "--law", "retired.weslaw.yaml"])
        .output()
        .expect("wesley should run");
    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stderr.contains("unknown option '--law' for `emit rust`"));
}

#[test]
fn nested_command_help_exits_zero() {
    let output = wesley()
        .args(["schema", "lower", "--help"])
        .output()
        .expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("wesley schema lower --schema <path>"));
}

#[test]
fn doctor_help_exits_zero() {
    let output = wesley()
        .args(["doctor", "--help"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");

    assert!(stdout.contains("Wesley native doctor"));
    assert!(stdout.contains("wesley doctor [--json]"));
    assert!(stdout.contains("Rust-native health checks only"));
    assert!(stderr.is_empty());
}

#[test]
fn doctor_reports_rust_native_health_checks_as_text() {
    let output = wesley().arg("doctor").output().expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");

    assert!(stdout.contains("[pass] wesley-cli "));
    assert!(stdout.contains("[pass] wesley-core lowerer accepts minimal SDL"));
    assert!(stdout.contains("[pass] normalized SDL hash evidence is available"));
    assert!(stdout.contains("[pass] wesley-emit-rust "));
    assert!(stdout.contains("[pass] wesley-emit-typescript "));
    assert!(!stdout.contains("Node.js"));
    assert!(!stdout.contains("wesley.config.mjs"));
    assert!(!stdout.contains("Plugins"));
    assert!(stderr.is_empty());
}

#[test]
fn doctor_reports_rust_native_health_checks_as_json() {
    let output = wesley()
        .args(["doctor", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(report["ok"], true);
    assert_eq!(report["executionMode"], "rust-native");
    assert_eq!(
        report["checks"]
            .as_array()
            .expect("checks should be array")
            .len(),
        5
    );
    assert_eq!(report["checks"][0]["id"], "native-cli");
    assert_eq!(report["checks"][1]["id"], "rust-core-lowering");
    assert_eq!(report["checks"][2]["id"], "normalized-sdl-hash");
    assert_eq!(report["checks"][3]["id"], "rust-emitter");
    assert_eq!(report["checks"][4]["id"], "typescript-emitter");
    assert!(stderr.is_empty());
}

#[test]
fn normalize_sdl_emits_sorted_consolidated_sdl() {
    assert_normalized_sdl_fixture("extension-folded");
}

#[test]
fn normalize_sdl_preserves_semantic_directives_descriptions_and_defaults() {
    assert_normalized_sdl_fixture("directives-and-defaults");
}

#[test]
fn normalize_sdl_hash_emits_sha256_evidence() {
    let output = wesley()
        .args(["normalize-sdl", "--schema"])
        .arg(fixture(
            "test/fixtures/normalized-sdl/directives-and-defaults.graphql",
        ))
        .arg("--hash")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    let expected = std::fs::read_to_string(fixture(
        "test/fixtures/normalized-sdl/directives-and-defaults.normalized.sha256",
    ))
    .expect("normalized SDL hash fixture should read");

    assert_eq!(stdout.trim(), expected.trim());
    assert!(stderr.is_empty());
}

#[test]
fn schema_lower_emits_l1_ir_json() {
    let output = wesley()
        .args(["schema", "lower", "--schema"])
        .arg(fixture("test/fixtures/ir-parity/small-schema.graphql"))
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let json: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(json["version"], "1.0.0");
    assert_eq!(json["types"][0]["name"], "User");
    assert_eq!(json["types"][0]["kind"], "OBJECT");
}

#[test]
fn schema_hash_matches_l1_hash_fixture() {
    let output = wesley()
        .args(["schema", "hash", "--schema"])
        .arg(fixture("test/fixtures/ir-parity/small-schema.graphql"))
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let expected = std::fs::read_to_string(fixture("test/fixtures/ir-parity/small-schema.l1.hash"))
        .expect("hash fixture should read");

    assert_eq!(stdout.trim(), expected.trim());
}

#[test]
fn schema_operations_emit_root_operation_catalog_as_json() {
    let output = wesley()
        .args(["schema", "operations", "--schema"])
        .arg(fixture("test/fixtures/consumer-models/jedit-rope.graphql"))
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let operations: serde_json::Value =
        serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(
        operations
            .as_array()
            .expect("operations should be array")
            .len(),
        5
    );

    let create_buffer = operations
        .as_array()
        .expect("operations should be array")
        .iter()
        .find(|operation| operation["fieldName"] == "createBufferWorldline")
        .expect("createBufferWorldline should be present");
    assert_eq!(create_buffer["operationType"], "MUTATION");
    assert_eq!(create_buffer["rootTypeName"], "Mutation");
    assert_eq!(
        create_buffer["arguments"][0]["type"]["base"],
        "CreateBufferWorldlineInput"
    );
    assert_eq!(
        create_buffer["resultType"]["base"],
        "CreateBufferWorldlineResult"
    );
    assert_eq!(
        create_buffer["directives"]["wes_op"]["name"],
        "createBufferWorldline"
    );
    assert_eq!(
        create_buffer["directives"]["wes_footprint"]["creates"][0],
        "BufferWorldline"
    );

    let text_window = operations
        .as_array()
        .expect("operations should be array")
        .iter()
        .find(|operation| operation["fieldName"] == "textWindow")
        .expect("textWindow should be present");
    assert_eq!(text_window["operationType"], "QUERY");
    assert_eq!(text_window["rootTypeName"], "Query");
    assert_eq!(
        text_window["arguments"][0]["type"]["base"],
        "TextWindowInput"
    );
    assert_eq!(text_window["resultType"]["base"], "TextWindowReading");
}

#[test]
fn schema_diff_emits_l1_delta_as_json() {
    let old_schema = temp_file(
        "schema-diff-old.graphql",
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
          name: String
        }
        "#,
    );
    let new_schema = temp_file(
        "schema-diff-new.graphql",
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
          handle: String
        }

        type Team {
          id: ID!
        }
        "#,
    );

    let output = wesley()
        .args(["schema", "diff", "--old"])
        .arg(&old_schema)
        .arg("--new")
        .arg(&new_schema)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let json: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(json["addedTypes"][0]["name"], "Team");
    assert_eq!(json["modifiedTypes"][0]["name"], "Viewer");
    assert_eq!(
        json["modifiedTypes"][0]["fieldChanges"][0]["name"],
        "handle"
    );

    let _ = std::fs::remove_file(old_schema);
    let _ = std::fs::remove_file(new_schema);
}

#[test]
fn schema_diff_exit_code_reports_breaking_changes() {
    let old_schema = temp_file(
        "schema-diff-breaking-old.graphql",
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
          name: String
        }
        "#,
    );
    let new_schema = temp_file(
        "schema-diff-breaking-new.graphql",
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }
        "#,
    );

    let output = wesley()
        .args([
            "schema",
            "diff",
            "--format",
            "summary",
            "--breaking-only",
            "--exit-code",
            "--old",
        ])
        .arg(&old_schema)
        .arg("--new")
        .arg(&new_schema)
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert_eq!(stdout.trim(), "1 breaking");
    assert!(stderr.is_empty());

    let _ = std::fs::remove_file(old_schema);
    let _ = std::fs::remove_file(new_schema);
}

#[test]
fn schema_diff_can_compare_worktree_schema_against_git_revision() {
    let repo = temp_dir("schema-diff-git-against");
    run_git(&repo, ["init"]);
    run_git(&repo, ["config", "user.email", "wesley@example.test"]);
    run_git(&repo, ["config", "user.name", "Wesley CLI Test"]);

    let schema = repo.join("schema.graphql");
    std::fs::write(
        &schema,
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
          name: String
        }
        "#,
    )
    .expect("schema should write");
    run_git(&repo, ["add", "schema.graphql"]);
    run_git(&repo, ["commit", "-m", "initial schema"]);

    std::fs::write(
        &schema,
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
          handle: String
        }
        "#,
    )
    .expect("schema should write");

    let output = wesley()
        .current_dir(&repo)
        .args([
            "schema",
            "diff",
            "--schema",
            "schema.graphql",
            "--against",
            "HEAD",
            "--format",
            "summary",
        ])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert_eq!(stdout.trim(), "1 breaking, 1 safe");

    let _ = std::fs::remove_dir_all(repo);
}

#[test]
fn schema_diff_base_alias_accepts_absolute_schema_paths() {
    let repo = temp_dir("schema-diff-git-base");
    run_git(&repo, ["init"]);
    run_git(&repo, ["config", "user.email", "wesley@example.test"]);
    run_git(&repo, ["config", "user.name", "Wesley CLI Test"]);

    let schema = repo.join("schema.graphql");
    std::fs::write(
        &schema,
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }
        "#,
    )
    .expect("schema should write");
    run_git(&repo, ["add", "schema.graphql"]);
    run_git(&repo, ["commit", "-m", "initial schema"]);

    std::fs::write(
        &schema,
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }

        type Team {
          id: ID!
        }
        "#,
    )
    .expect("schema should write");

    let output = wesley()
        .current_dir(std::env::temp_dir())
        .args(["schema", "diff", "--schema"])
        .arg(&schema)
        .args(["--base", "HEAD", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let json: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(json["addedTypes"][0]["name"], "Team");

    let _ = std::fs::remove_dir_all(repo);
}

#[test]
fn emit_typescript_writes_ast_generated_declarations() {
    let dir = temp_dir("emit-typescript");
    let schema = dir.join("schema.graphql");
    let out = dir.join("generated").join("types.ts");

    std::fs::write(
        &schema,
        r#"
        scalar DateTime

        type User {
          id: ID!
          name: String
          createdAt: DateTime!
        }

        enum Role {
          ADMIN
          MEMBER
        }
        "#,
    )
    .expect("schema should write");

    let output = wesley()
        .args(["emit", "typescript", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&out)
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    let generated = std::fs::read_to_string(&out).expect("output should read");

    assert!(stdout.is_empty());
    assert!(stderr.is_empty());
    assert!(generated.contains("export type DateTime = unknown;"));
    assert!(generated.contains("export type Role = \"ADMIN\" | \"MEMBER\";"));
    assert!(generated.contains("export interface User {"));
    assert!(generated.contains("  id: string;"));
    assert!(generated.contains("  name: string | null;"));
    assert!(generated.contains("  createdAt: DateTime;"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn emit_rust_writes_ast_generated_models() {
    let dir = temp_dir("emit-rust");
    let schema = dir.join("schema.graphql");
    let out = dir.join("generated").join("model.rs");

    std::fs::write(
        &schema,
        r#"
        enum Role {
          ADMIN
          READ_ONLY
        }

        type User {
          id: ID!
          displayName: String
          roles: [Role!]!
        }
        "#,
    )
    .expect("schema should write");

    let output = wesley()
        .args(["emit", "rust", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&out)
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    let generated = std::fs::read_to_string(&out).expect("output should read");

    assert!(stdout.is_empty());
    assert!(stderr.is_empty());
    assert!(generated.contains("pub enum Role {"));
    assert!(generated.contains("#[serde(rename = \"READ_ONLY\")]"));
    assert!(generated.contains("ReadOnly,"));
    assert!(generated.contains("pub struct User {"));
    assert!(generated.contains("#[serde(rename = \"displayName\")]"));
    assert!(generated.contains("pub display_name: Option<String>,"));
    assert!(generated.contains("pub roles: Vec<Role>,"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn emit_commands_write_deterministic_metadata_sidecars() {
    let dir = temp_dir("emit-metadata");
    let schema = dir.join("schema.graphql");
    let rust_out = dir.join("generated").join("model.rs");
    let typescript_out = dir.join("generated").join("types.ts");
    let rust_metadata = dir.join("generated").join("model.metadata.json");
    let typescript_metadata = dir.join("generated").join("types.metadata.json");

    std::fs::write(
        &schema,
        r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }
        "#,
    )
    .expect("schema should write");

    let rust_output = wesley()
        .args(["emit", "rust", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&rust_out)
        .arg("--metadata-out")
        .arg(&rust_metadata)
        .output()
        .expect("wesley should run");
    assert_success(&rust_output);

    let typescript_output = wesley()
        .args(["emit", "typescript", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&typescript_out)
        .arg("--metadata-out")
        .arg(&typescript_metadata)
        .output()
        .expect("wesley should run");
    assert_success(&typescript_output);

    let rust_json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&rust_metadata).expect("Rust metadata should read"),
    )
    .expect("Rust metadata should be JSON");
    let typescript_json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&typescript_metadata).expect("TypeScript metadata should read"),
    )
    .expect("TypeScript metadata should be JSON");

    assert_eq!(rust_json["schemaHash"], typescript_json["schemaHash"]);
    assert_eq!(
        rust_json["schemaHash"]
            .as_str()
            .expect("schema hash should be a string")
            .len(),
        64
    );
    assert_eq!(
        rust_json["schemaHashQualified"],
        format!(
            "sha256:{}",
            rust_json["schemaHash"]
                .as_str()
                .expect("schema hash should be a string")
        )
    );
    assert_eq!(
        typescript_json["schemaHashQualified"],
        rust_json["schemaHashQualified"]
    );
    assert_eq!(rust_json["generator"], "wesley-emit-rust");
    assert_eq!(typescript_json["generator"], "wesley-emit-typescript");
    assert_eq!(
        rust_json["generatorVersion"],
        wesley_emit_rust::GENERATOR_VERSION
    );
    assert_eq!(
        typescript_json["generatorVersion"],
        wesley_emit_typescript::GENERATOR_VERSION
    );
    assert_eq!(rust_json["executionMode"], "rust-native");
    assert_eq!(typescript_json["executionMode"], "rust-native");
    for retired_field in [
        "lawHash",
        "lawDocumentHash",
        "profileHash",
        "bundleHash",
        "lawIrCodec",
    ] {
        assert!(
            rust_json.get(retired_field).is_none(),
            "Rust metadata must not carry retired field {retired_field}"
        );
        assert!(
            typescript_json.get(retired_field).is_none(),
            "TypeScript metadata must not carry retired field {retired_field}"
        );
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn emit_commands_include_jedit_operation_bindings() {
    let dir = temp_dir("emit-jedit-operation-bindings");
    let rust_out = dir.join("generated").join("model.rs");
    let typescript_out = dir.join("generated").join("types.ts");
    let schema = fixture("test/fixtures/consumer-models/jedit-rope.graphql");

    let rust_output = wesley()
        .args(["emit", "rust", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&rust_out)
        .output()
        .expect("wesley should run");
    assert_success(&rust_output);

    let typescript_output = wesley()
        .args(["emit", "typescript", "--schema"])
        .arg(&schema)
        .arg("--out")
        .arg(&typescript_out)
        .output()
        .expect("wesley should run");
    assert_success(&typescript_output);

    let generated_rust = std::fs::read_to_string(&rust_out).expect("Rust output should read");
    let generated_typescript =
        std::fs::read_to_string(&typescript_out).expect("TypeScript output should read");

    assert!(generated_rust.contains("pub struct MutationCreateBufferWorldlineRequest {"));
    assert!(generated_rust.contains("pub input: CreateBufferWorldlineInput,"));
    assert!(generated_rust
        .contains("pub type MutationCreateBufferWorldlineResponse = CreateBufferWorldlineResult;"));
    assert!(generated_rust.contains("pub const OPERATION_TYPE: &'static str = \"MUTATION\";"));
    assert!(
        generated_rust.contains("pub const FIELD_NAME: &'static str = \"createBufferWorldline\";")
    );
    assert!(!generated_rust.contains("pub struct Mutation {"));

    assert!(
        generated_typescript.contains("export interface MutationCreateBufferWorldlineRequest {")
    );
    assert!(generated_typescript.contains("  input: CreateBufferWorldlineInput;"));
    assert!(generated_typescript.contains(
        "export type MutationCreateBufferWorldlineResponse = CreateBufferWorldlineResult;"
    ));
    assert!(
        generated_typescript.contains("export const mutationCreateBufferWorldlineOperation = {")
    );
    assert!(generated_typescript.contains("  operationType: \"MUTATION\","));
    assert!(generated_typescript.contains("  fieldName: \"createBufferWorldline\","));
    assert!(!generated_typescript.contains("export interface Mutation {"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn operation_selections_emit_response_paths_as_json() {
    let operation = temp_file(
        "response-paths.graphql",
        r#"
        query Viewer {
          viewer {
            id
            profile {
              handle
            }
          }
        }
        "#,
    );

    let output = wesley()
        .args(["operation", "selections", "--operation"])
        .arg(&operation)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let selections: Vec<String> = serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(
        selections,
        vec![
            "viewer".to_string(),
            "viewer.id".to_string(),
            "viewer.profile".to_string(),
            "viewer.profile.handle".to_string(),
        ]
    );

    let _ = std::fs::remove_file(operation);
}

#[test]
fn operation_selections_can_use_schema_coordinates() {
    let schema = temp_file(
        "schema-coordinates-schema.graphql",
        r#"
        type Query {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
          profile: Profile!
        }

        type Profile {
          handle: String!
        }
        "#,
    );
    let operation = temp_file(
        "schema-coordinates-operation.graphql",
        r#"
        query Viewer {
          viewer {
            id
            profile {
              handle
            }
          }
        }
        "#,
    );

    let output = wesley()
        .args(["operation", "selections", "--schema"])
        .arg(&schema)
        .arg("--operation")
        .arg(&operation)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let selections: Vec<String> = serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(
        selections,
        vec![
            "Query.viewer".to_string(),
            "Viewer.id".to_string(),
            "Viewer.profile".to_string(),
            "Profile.handle".to_string(),
        ]
    );

    let _ = std::fs::remove_file(schema);
    let _ = std::fs::remove_file(operation);
}

#[test]
fn operation_directive_args_emit_generic_directive_data() {
    let operation = temp_file(
        "directive-args.graphql",
        r#"
        query Viewer @wes_footprint(reads: ["viewer", "viewer.id"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args([
            "operation",
            "directive-args",
            "--operation",
            operation.to_str().expect("temp path should be utf8"),
            "--directive",
            "@wes_footprint",
            "--json",
        ])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let directives: serde_json::Value =
        serde_json::from_str(&stdout).expect("stdout should be json");

    assert_eq!(directives[0]["directiveName"], "wes_footprint");
    assert_eq!(
        directives[0]["arguments"]["reads"],
        serde_json::json!(["viewer", "viewer.id"])
    );
    assert_eq!(directives[0]["arguments"]["writes"], serde_json::json!([]));

    let _ = std::fs::remove_file(operation);
}

fn wesley() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_wesley"));
    clear_git_repository_environment(&mut command);
    command
}

fn assert_normalized_sdl_fixture(name: &str) {
    let output = wesley()
        .args(["normalize-sdl", "--schema"])
        .arg(fixture(format!(
            "test/fixtures/normalized-sdl/{name}.graphql"
        )))
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    let expected = std::fs::read_to_string(fixture(format!(
        "test/fixtures/normalized-sdl/{name}.normalized.graphql"
    )))
    .expect("normalized SDL fixture should read");

    assert_eq!(stdout, expected);
    assert!(stderr.is_empty());
}

fn assert_success(output: &std::process::Output) {
    if !output.status.success() {
        panic!(
            "expected success, got {:?}\nstdout:\n{}\nstderr:\n{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

fn fixture(relative: impl AsRef<std::path::Path>) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative)
}

fn temp_file(name: &str, content: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "wesley-cli-test-{}-{nanos}-{name}",
        std::process::id()
    ));
    std::fs::write(&path, content).expect("temp file should write");
    path
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "wesley-cli-test-{}-{nanos}-{name}",
        std::process::id()
    ));
    std::fs::create_dir_all(&path).expect("temp directory should create");
    path
}

fn valid_target_descriptor_json(program: &str) -> String {
    format!(
        r#"{{
  "apiVersion": "wesley.target-descriptor/v1",
  "name": "hello-wesley-target",
  "protocol": {{
    "kind": "external-process",
    "version": "wesley.target-process/v1"
  }},
  "command": {{
    "program": "{program}",
    "args": ["--request-stdin"]
  }},
  "execution": {{
    "timeoutMs": 30000
  }},
  "capabilities": {{
    "inputs": ["wesley.l1-ir/v1", "wesley.schema-operations/v1"],
    "outputs": ["wesley.target-artifact-manifest/v1"],
    "requiresNetwork": false,
    "requiresAmbientFilesystem": false
  }},
  "outputs": {{
    "defaultOutDir": "generated/hello"
  }}
}}
"#
    )
}

fn run_git<const N: usize>(repo: &std::path::Path, args: [&str; N]) {
    let mut command = Command::new("git");
    command.current_dir(repo).args(args);
    clear_git_repository_environment(&mut command);
    let output = command.output().expect("git should run");

    if !output.status.success() {
        panic!(
            "git command failed with {:?}\nstdout:\n{}\nstderr:\n{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

fn clear_git_repository_environment(command: &mut Command) {
    // Git hooks export their repository context; fixture repos must discover
    // identity and worktree state from their own current directory.
    for variable in [
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_PREFIX",
        "GIT_WORK_TREE",
    ] {
        command.env_remove(variable);
    }
}
