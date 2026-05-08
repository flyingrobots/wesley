use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn help_exits_zero_without_footprint_command() {
    let output = wesley().arg("--help").output().expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("Wesley native CLI"));
    assert!(stdout.contains("schema lower"));
    assert!(stdout.contains("schema diff"));
    assert!(stdout.contains("operation selections"));
    assert!(!stdout.contains("check-footprint"));
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
    Command::new(env!("CARGO_BIN_EXE_wesley"))
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

fn fixture(relative: &str) -> std::path::PathBuf {
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
